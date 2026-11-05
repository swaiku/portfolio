import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://jrmy.ch',
  integrations: [svelte()],
  vite: {
    plugins: [tailwindcss()],
    // pre-bundle up front so the dev server doesn't re-optimise (and reload the page) mid-bake
    optimizeDeps: { include: ['three/webgpu', 'three/tsl', '@threlte/core/webgpu'] },
    // the renderer chunk (three/webgpu + the scene) is ~1.15 MB on its own and cannot split below 500 kB; it loads only
    // once a GPU is found (Planet.svelte). The limit sits just above it, so anything that grows past it still warns
    build: { chunkSizeWarningLimit: 1200 },
  },
});
