export type ComponentOptions = Record<string, unknown>;

export default abstract class AbstractComponent<
    TOptions extends ComponentOptions = ComponentOptions,
    TElement extends HTMLElement = HTMLElement,
> {
    el: TElement;
    options: TOptions;

    constructor(el: TElement, options: TOptions = {} as TOptions) {
        this.el = el;
        this.options = options;
    }

    beforeCreate(): void {}
    created(): void {}
    beforeMount(): void {}
    mounted(): void {}
    beforeDestroy(): void {}
    destroy(): void {}
}
