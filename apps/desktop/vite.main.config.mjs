import { defineConfig } from "vite";
import { builtinModules } from "node:module";
// Pure JavaScript dependencies must travel with the worker. Forge only copies
// the Vite output, and workspace node_modules are not part of the installer.
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        "electron",
        ...builtinModules,
        ...builtinModules.map((name) => `node:${name}`),
      ],
    },
  },
});
