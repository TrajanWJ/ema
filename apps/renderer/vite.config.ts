import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@ema/glass": path.resolve(__dirname, "../../shared/glass/src/index.ts"),
      "@ema/tokens": path.resolve(__dirname, "../../shared/tokens/src/index.ts"),
      "@ema/tokens/css": path.resolve(__dirname, "../../shared/tokens/dist/tokens.css"),
      "@ema/glass/styles/reset.css": path.resolve(__dirname, "../../shared/glass/src/styles/reset.css"),
      "@ema/glass/styles/keyframes.css": path.resolve(__dirname, "../../shared/glass/src/styles/keyframes.css"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.VITE_DEV_HOST || false,
  },
});
