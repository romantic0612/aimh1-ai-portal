import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api": "http://localhost:7998",
      "/callback": "http://localhost:7998"
    }
  },
  build: {
    outDir: "../dist-vue",
    emptyOutDir: true
  }
});
