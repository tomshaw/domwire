import type AbstractComponent from "./AbstractComponent";
import type { ComponentOptions } from "./AbstractComponent";

export type ComponentConstructor<
    TOptions extends ComponentOptions = ComponentOptions,
> = new (el: HTMLElement, options: TOptions) => AbstractComponent<TOptions>;

export type ComponentImporter = () => Promise<{
    default: ComponentConstructor;
}>;

export type ComponentRegistry = Record<string, ComponentImporter>;

function toPascalCase(str: string): string {
    return str.replace(/(^\w|-\w)/g, (m) => m.replace(/-/, "").toUpperCase());
}

export default class ComponentLoader {
    constructor(private readonly registry: ComponentRegistry) {}

    async load(
        name: string,
        namespace: string | null = null,
    ): Promise<ComponentConstructor | null> {
        const key = namespace
            ? `${namespace}/${toPascalCase(name)}`
            : toPascalCase(name);

        const importer = this.registry[key];
        if (!importer) return null;

        try {
            const module = await importer();
            return module.default;
        } catch (err) {
            console.error(`[domwire] Failed to import "${key}":`, err);
            return null;
        }
    }
}
