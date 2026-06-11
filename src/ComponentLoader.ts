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

    /**
     * Resolves a component name to its constructor. Returns `null` when the
     * name has no registry entry; rejects when the importer itself fails, so
     * callers can tell a missing component from a failed import.
     */
    async load(
        name: string,
        namespace: string | null = null,
    ): Promise<ComponentConstructor | null> {
        const key = namespace
            ? `${namespace}/${toPascalCase(name)}`
            : toPascalCase(name);

        const importer = this.registry[key];
        if (!importer) return null;

        const module = await importer();
        return module.default;
    }
}
