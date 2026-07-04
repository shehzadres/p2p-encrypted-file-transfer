import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@':        path.resolve(__dirname, './src'),
      '@shared':  path.resolve(__dirname, '../shared'),
      // Fix libsodium-wrappers ESM build: it imports a sibling './libsodium.mjs'
      // that doesn't exist in its own package — point it at the real location.
      './libsodium.mjs': path.resolve(
        __dirname,
        '../node_modules/libsodium/dist/modules-esm/libsodium.mjs'
      ),
    },
  },
  optimizeDeps: {
    exclude: ['libsodium-wrappers'],
  },
  build: {
    target: 'esnext', // required for top-level await used by libsodium's WASM loader
    // Split heavy/rarely-changing dependencies into separate cacheable chunks.
    // Without this, libsodium's WASM blob (~600KB) ships in the same chunk as
    // application code, so every app code change invalidates the user's cached
    // copy of a dependency that almost never changes.
    rollupOptions: {
      onwarn(warning, warn) {
        // libsodium's UMD wrapper has a dead `require('url')` codepath guarded by
        // `typeof require !== 'undefined'` that never executes in a browser build.
        // Rollup correctly externalizes it but still emits a harmless warning.
        if (warning.message?.includes('externalized for browser compatibility')) return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('libsodium'))               return 'vendor-crypto';
          if (id.includes('qrcode'))                   return 'vendor-qrcode';
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          if (id.includes('react-router'))             return 'vendor-router';
          if (id.includes('lucide-react'))             return 'vendor-icons';
          return 'vendor';
        },
      },
    },
    // Raise the warning threshold since the crypto vendor chunk (libsodium's
    // WASM binary) is irreducibly large but now isolated into its own chunk
    // and cached independently of app code — it won't re-download on updates.
    chunkSizeWarningLimit: 750,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:3001',  ws: true },
    },
  },
});
