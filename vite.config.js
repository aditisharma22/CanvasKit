import { defineConfig } from "vite";

export default defineConfig({
  server: {
    open: true,
  },
  build: {
    rollupOptions: {
      external: ['fs', 'path'] // Mark Node.js modules as external
    }
  },
  optimizeDeps: {
    exclude: ['tnthai', 'wordcut'] // Exclude problematic Node.js packages
  }
});
