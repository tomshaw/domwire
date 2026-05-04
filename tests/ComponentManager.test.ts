import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ComponentManager from "../src/ComponentManager";
import AbstractComponent from "../src/AbstractComponent";

const calls: string[] = [];

class Recorder extends AbstractComponent {
    beforeCreate() {
        calls.push("beforeCreate");
    }
    created() {
        calls.push("created");
    }
    beforeMount() {
        calls.push("beforeMount");
    }
    mounted() {
        calls.push("mounted");
    }
    beforeDestroy() {
        calls.push("beforeDestroy");
    }
    destroy() {
        calls.push("destroy");
    }
}

class OptionsCapture extends AbstractComponent {
    static lastOptions: Record<string, unknown> | null = null;
    mounted() {
        OptionsCapture.lastOptions = this.options;
    }
}

class Throws extends AbstractComponent {
    constructor(el: HTMLElement, options: Record<string, unknown>) {
        super(el, options);
        throw new Error("ctor failed");
    }
}

beforeEach(() => {
    document.body.innerHTML = "";
    calls.length = 0;
    OptionsCapture.lastOptions = null;
});

afterEach(() => {
    document.body.innerHTML = "";
});

describe("ComponentManager.boot", () => {
    it("instantiates a component and runs init lifecycle in order", async () => {
        document.body.innerHTML = `<div data-component="recorder"></div>`;
        const manager = new ComponentManager({
            registry: { Recorder: async () => ({ default: Recorder }) },
        });

        await manager.boot();

        expect(calls).toEqual([
            "beforeCreate",
            "created",
            "beforeMount",
            "mounted",
        ]);
        const el = document.querySelector("div") as HTMLElement;
        expect(el._component).toBeInstanceOf(Recorder);
        expect(manager.instances.get(el)).toBeInstanceOf(Recorder);
    });

    it("parses data-options as JSON and passes them to the component", async () => {
        document.body.innerHTML = `<div data-component="opts" data-options='{"foo":"bar","n":42}'></div>`;
        const manager = new ComponentManager({
            registry: { Opts: async () => ({ default: OptionsCapture }) },
        });

        await manager.boot();

        expect(OptionsCapture.lastOptions).toEqual({ foo: "bar", n: 42 });
    });

    it("falls back to {} when data-options is invalid JSON", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        document.body.innerHTML = `<div data-component="opts" data-options="not json"></div>`;
        const manager = new ComponentManager({
            registry: { Opts: async () => ({ default: OptionsCapture }) },
        });

        await manager.boot();

        expect(OptionsCapture.lastOptions).toEqual({});
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it("honors namespace from data-options", async () => {
        document.body.innerHTML = `<div data-component="recorder" data-options='{"namespace":"admin"}'></div>`;
        const namespaced = vi.fn(async () => ({ default: Recorder }));
        const manager = new ComponentManager({
            registry: { "admin/Recorder": namespaced },
        });

        await manager.boot();

        expect(namespaced).toHaveBeenCalledOnce();
    });

    it("calls onMissing when component is not in registry", async () => {
        document.body.innerHTML = `<div data-component="ghost"></div>`;
        const onMissing = vi.fn();
        const manager = new ComponentManager({ registry: {}, onMissing });

        await manager.boot();

        expect(onMissing).toHaveBeenCalledWith("ghost", expect.any(HTMLElement));
    });

    it("calls onError when component constructor throws", async () => {
        document.body.innerHTML = `<div data-component="throws"></div>`;
        const onError = vi.fn();
        const manager = new ComponentManager({
            registry: { Throws: async () => ({ default: Throws }) },
            onError,
        });

        await manager.boot();

        expect(onError).toHaveBeenCalledWith(
            "throws",
            expect.any(Error),
            expect.any(HTMLElement),
        );
    });

    it("respects a custom selector", async () => {
        document.body.innerHTML = `
            <div data-component="recorder"></div>
            <div data-widget="recorder"></div>
        `;
        const manager = new ComponentManager({
            selector: "[data-widget]",
            registry: { Recorder: async () => ({ default: Recorder }) },
        });

        // Components keyed by data-component still — selector only changes
        // which elements are *picked up*. Re-emit for the widget element:
        const widget = document.querySelector("[data-widget]") as HTMLElement;
        widget.dataset.component = "recorder";

        await manager.boot();

        expect(manager.instances.size).toBe(1);
        expect(manager.instances.has(widget)).toBe(true);
    });
});

describe("ComponentManager.destroy", () => {
    it("destroyComponent runs teardown lifecycle and clears _component", async () => {
        document.body.innerHTML = `<div data-component="recorder"></div>`;
        const manager = new ComponentManager({
            registry: { Recorder: async () => ({ default: Recorder }) },
        });
        await manager.boot();
        const el = document.querySelector("div") as HTMLElement;
        calls.length = 0;

        manager.destroyComponent(el);

        expect(calls).toEqual(["beforeDestroy", "destroy"]);
        expect(el._component).toBeUndefined();
        expect(manager.instances.has(el)).toBe(false);
    });

    it("destroyAll tears down every instance", async () => {
        document.body.innerHTML = `
            <div data-component="recorder"></div>
            <div data-component="recorder"></div>
        `;
        const manager = new ComponentManager({
            registry: { Recorder: async () => ({ default: Recorder }) },
        });
        await manager.boot();

        manager.destroyAll();

        expect(manager.instances.size).toBe(0);
    });
});

describe("ComponentManager.observe", () => {
    const flush = () => new Promise((r) => setTimeout(r, 0));

    it("initializes nodes added after boot", async () => {
        const manager = new ComponentManager({
            registry: { Recorder: async () => ({ default: Recorder }) },
        });
        await manager.boot();
        manager.observe();

        const el = document.createElement("div");
        el.dataset.component = "recorder";
        document.body.appendChild(el);

        await flush();
        await flush();

        expect(el._component).toBeInstanceOf(Recorder);
        manager.unobserve();
    });

    it("initializes nested [data-component] inside an added subtree", async () => {
        const manager = new ComponentManager({
            registry: { Recorder: async () => ({ default: Recorder }) },
        });
        await manager.boot();
        manager.observe();

        const wrapper = document.createElement("section");
        wrapper.innerHTML = `<div class="inner" data-component="recorder"></div>`;
        document.body.appendChild(wrapper);

        await flush();
        await flush();

        const inner = wrapper.querySelector(".inner") as HTMLElement;
        expect(inner._component).toBeInstanceOf(Recorder);
        manager.unobserve();
    });

    it("destroys components when their nodes are removed", async () => {
        document.body.innerHTML = `<div data-component="recorder"></div>`;
        const manager = new ComponentManager({
            registry: { Recorder: async () => ({ default: Recorder }) },
        });
        await manager.boot();
        manager.observe();

        const el = document.querySelector("div") as HTMLElement;
        calls.length = 0;
        el.remove();

        await flush();
        await flush();

        expect(calls).toEqual(["beforeDestroy", "destroy"]);
        expect(manager.instances.has(el)).toBe(false);
        manager.unobserve();
    });

    it("destroys nested components when their ancestor is removed", async () => {
        document.body.innerHTML = `<section><div data-component="recorder"></div></section>`;
        const manager = new ComponentManager({
            registry: { Recorder: async () => ({ default: Recorder }) },
        });
        await manager.boot();
        manager.observe();

        const inner = document.querySelector(
            "[data-component]",
        ) as HTMLElement;
        const wrapper = document.querySelector("section") as HTMLElement;
        calls.length = 0;
        wrapper.remove();

        await flush();
        await flush();

        expect(calls).toEqual(["beforeDestroy", "destroy"]);
        expect(manager.instances.has(inner)).toBe(false);
        manager.unobserve();
    });

    it("unobserve stops processing further mutations", async () => {
        const manager = new ComponentManager({
            registry: { Recorder: async () => ({ default: Recorder }) },
        });
        await manager.boot();
        manager.observe();
        manager.unobserve();

        const el = document.createElement("div");
        el.dataset.component = "recorder";
        document.body.appendChild(el);

        await flush();
        await flush();

        expect(el._component).toBeUndefined();
    });
});
