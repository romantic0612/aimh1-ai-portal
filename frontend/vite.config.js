import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: "dist-preview",
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      },
      "/callback": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      }
    }
  }
});
