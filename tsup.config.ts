import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts", "src/alpine.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2020",
    treeshake: true,
});
