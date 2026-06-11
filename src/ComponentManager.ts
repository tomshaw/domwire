import ComponentLoader from "./ComponentLoader";
import type { ComponentRegistry } from "./ComponentLoader";
import type AbstractComponent from "./AbstractComponent";

declare global {
    interface HTMLElement {
        _component?: AbstractComponent;
    }
}

type LifecycleHook =
    | "beforeCreate"
    | "created"
    | "beforeMount"
    | "mounted"
    | "beforeDestroy"
    | "destroy";

export interface ComponentManagerOptions {
    selector?: string;
    registry?: ComponentRegistry;
    loader?: ComponentLoader;
    onMissing?: (name: string, el: HTMLElement) => void;
    onError?: (name: string, err: unknown, el: HTMLElement) => void;
}

export default class ComponentManager {
    selector: string;
    loader: ComponentLoader;
    instances: Map<HTMLElement, AbstractComponent>;

    private readonly onMissing: (name: string, el: HTMLElement) => void;
    private readonly onError: (
        name: string,
        err: unknown,
        el: HTMLElement,
    ) => void;
    private observer: MutationObserver | null = null;
    private pending: Map<HTMLElement, Promise<void>> = new Map();

    constructor(options: ComponentManagerOptions = {}) {
        this.selector = options.selector ?? "[data-component]";
        this.loader =
            options.loader ?? new ComponentLoader(options.registry ?? {});
        this.instances = new Map();
        this.onMissing =
            options.onMissing ??
            ((name) => console.warn(`[domwire] Component "${name}" not found.`));
        this.onError =
            options.onError ??
            ((name, err) =>
                console.error(`[domwire] Failed to initialize "${name}":`, err));
    }

    async boot(root: Document | HTMLElement = document): Promise<void> {
        const elements = Array.from(
            root.querySelectorAll<HTMLElement>(this.selector),
        );
        await Promise.all(elements.map((el) => this.initializeComponent(el)));
    }

    observe(root: Document | HTMLElement = document): void {
        if (this.observer) return;

        this.observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                m.addedNodes.forEach((node) => {
                    if (!(node instanceof HTMLElement)) return;
                    if (node.matches(this.selector)) {
                        void this.initializeComponent(node);
                    }
                    node.querySelectorAll<HTMLElement>(this.selector).forEach(
                        (el) => void this.initializeComponent(el),
                    );
                });
                m.removedNodes.forEach((node) => {
                    if (!(node instanceof HTMLElement)) return;
                    // A node that is back in the document by the time this
                    // callback runs was moved, not removed — keep its instance.
                    if (node.isConnected) return;
                    if (this.instances.has(node)) this.destroyComponent(node);
                    node.querySelectorAll<HTMLElement>(this.selector).forEach(
                        (el) => {
                            if (this.instances.has(el))
                                this.destroyComponent(el);
                        },
                    );
                });
            }
        });

        const target = root instanceof Document ? root.documentElement : root;
        this.observer.observe(target, { childList: true, subtree: true });
    }

    unobserve(): void {
        this.observer?.disconnect();
        this.observer = null;
    }

    initializeComponent(el: HTMLElement): Promise<void> {
        if (this.instances.has(el)) return Promise.resolve();

        const pending = this.pending.get(el);
        if (pending) return pending;

        const name = el.dataset.component;
        if (!name) return Promise.resolve();

        const promise = this.doInitialize(el, name).finally(() => {
            this.pending.delete(el);
        });
        this.pending.set(el, promise);
        return promise;
    }

    private async doInitialize(el: HTMLElement, name: string): Promise<void> {
        const options = parseOptions(el);
        const namespace =
            typeof options.namespace === "string" ? options.namespace : null;

        let ComponentClass;
        try {
            ComponentClass = await this.loader.load(name, namespace);
        } catch (err) {
            this.onError(name, err, el);
            return;
        }
        if (!ComponentClass) {
            this.onMissing(name, el);
            return;
        }

        // The element may have left the DOM while its module loaded; mounting
        // it now would leak, since its removal has already been processed.
        if (this.observer && !el.isConnected) return;

        try {
            const instance = new ComponentClass(el, options);
            callLifecycle(instance, [
                "beforeCreate",
                "created",
                "beforeMount",
                "mounted",
            ]);
            this.instances.set(el, instance);
            el._component = instance;
        } catch (err) {
            this.onError(name, err, el);
        }
    }

    destroyComponent(el: HTMLElement): void {
        const instance = this.instances.get(el);
        if (!instance) return;

        callLifecycle(instance, ["beforeDestroy", "destroy"]);
        delete el._component;
        this.instances.delete(el);
    }

    destroyAll(): void {
        for (const [el] of this.instances) {
            this.destroyComponent(el);
        }
    }
}

function parseOptions(el: HTMLElement): Record<string, unknown> {
    const raw = el.dataset.options;
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
        console.warn("[domwire] Invalid JSON in data-options:", raw, err);
        return {};
    }
}

function callLifecycle(
    instance: AbstractComponent,
    hooks: readonly LifecycleHook[],
): void {
    for (const hook of hooks) {
        const fn = instance[hook];
        if (typeof fn === "function") fn.call(instance);
    }
}
