import { defineConfig } from "vite";

export default defineConfig({
  server: {
    open: true,
    port: 5174,  // Set specific port
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
