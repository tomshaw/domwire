import type AbstractComponent from "./AbstractComponent";

interface AlpineLike {
    magic: (name: string, fn: (el: HTMLElement) => unknown) => void;
}

declare global {
    interface Window {
        Alpine?: AlpineLike;
    }
    interface HTMLElement {
        _component?: AbstractComponent;
    }
}

export interface AlpineMagicOptions {
    selector?: string;
    name?: string;
}

export function registerAlpineMagic(options: AlpineMagicOptions = {}): void {
    const selector = options.selector ?? "[data-component]";
    const magicName = options.name ?? "component";

    const register = () => {
        window.Alpine?.magic(
            magicName,
            (el) =>
                (el.closest(selector) as HTMLElement | null)?._component ??
                null,
        );
    };

    if (window.Alpine?.magic) {
        register();
    } else {
        document.addEventListener("alpine:init", register, { once: true });
    }
}
