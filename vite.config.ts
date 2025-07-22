import { defineConfig } from "vite";

export default defineConfig({
  server: {
    open: true,
  },
  build: {
    rollupOptions: {
      external: ['fs', 'path'] // Node.js modules
    }
  },
  optimizeDeps: {
    exclude: ['tnthai', 'wordcut'] // Node-only packages
  },
  resolve: {
    extensions: ['.ts', '.js']
  }
});
