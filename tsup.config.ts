import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "cli/index": "src/cli/index.ts",
    "core/index": "src/core/index.ts",
  },
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: true,
  treeshake: true,
  minify: false,
});
