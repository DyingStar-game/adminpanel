import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

/** BFF reached by the Vite dev server proxy (same container in `make up`). */
const BFF_URL = process.env.BFF_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries every page loads, in their own chunks: none passes the 500 kB warning, and
        // they stay cached across releases of the app code. Map and orbit libraries are left to
        // their route chunks (loaded on demand).
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            {
              // The table library only serves the explorer: left to its route.
              name: 'tanstack',
              test: /node_modules[\\/]@tanstack[\\/](?!react-table|table-core)/,
            },
            { name: 'radix', test: /node_modules[\\/](@radix-ui|radix-ui)[\\/]/ },
            { name: 'i18n', test: /node_modules[\\/](i18next|react-i18next)[\\/]/ },
            { name: 'zod', test: /node_modules[\\/]zod[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // File events are unreliable through the Docker bind mount (missed edits served stale
    // modules): the dev container turns polling on with VITE_WATCH_POLLING.
    watch: process.env.VITE_WATCH_POLLING === 'true' ? { usePolling: true, interval: 300 } : {},
    // `changeOrigin: false` keeps the browser's Host (localhost:5173): the BFF builds the sign-in
    // callback from it and compares it with the Origin of writes (ADR 0023). Vite's string
    // shorthand would rewrite it to the BFF's own port.
    proxy: {
      '/api': { target: BFF_URL, changeOrigin: false },
      '/auth': { target: BFF_URL, changeOrigin: false },
      '/health': BFF_URL,
    },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
