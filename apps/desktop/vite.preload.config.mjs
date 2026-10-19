import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
export default defineConfig({ build: { rollupOptions: { external: ['electron', 'youtubei.js', ...builtinModules, ...builtinModules.map((name) => `node:${name}`)] } } });
