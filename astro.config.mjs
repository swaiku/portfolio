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
  },
});
