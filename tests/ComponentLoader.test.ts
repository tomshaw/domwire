import { describe, expect, it, vi } from "vitest";
import ComponentLoader from "../src/ComponentLoader";
import AbstractComponent from "../src/AbstractComponent";

class Dummy extends AbstractComponent {}

describe("ComponentLoader", () => {
    it("converts kebab-case names to PascalCase registry keys", async () => {
        const importer = vi.fn(async () => ({ default: Dummy }));
        const loader = new ComponentLoader({ UserCard: importer });

        const result = await loader.load("user-card");

        expect(result).toBe(Dummy);
        expect(importer).toHaveBeenCalledOnce();
    });

    it("handles multi-segment kebab-case", async () => {
        const importer = vi.fn(async () => ({ default: Dummy }));
        const loader = new ComponentLoader({ FooBarBaz: importer });

        const result = await loader.load("foo-bar-baz");

        expect(result).toBe(Dummy);
    });

    it("scopes lookups by namespace", async () => {
        const adminImporter = vi.fn(async () => ({ default: Dummy }));
        const publicImporter = vi.fn(async () => ({ default: Dummy }));
        const loader = new ComponentLoader({
            "admin/UserCard": adminImporter,
            UserCard: publicImporter,
        });

        await loader.load("user-card", "admin");

        expect(adminImporter).toHaveBeenCalledOnce();
        expect(publicImporter).not.toHaveBeenCalled();
    });

    it("returns null for unknown names without throwing", async () => {
        const loader = new ComponentLoader({});
        expect(await loader.load("nope")).toBeNull();
    });

    it("rejects when the importer throws, so failures are distinguishable from missing entries", async () => {
        const loader = new ComponentLoader({
            Bad: async () => {
                throw new Error("boom");
            },
        });

        await expect(loader.load("bad")).rejects.toThrow("boom");
    });
});
