import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the web front ends into dist/web, which the server serves.
export default defineConfig({
  root: "src/web",
  plugins: [react()],
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "control-center": "src/web/index.html",
        observatory: "src/web/observatory.html",
        "fake-printer": "src/web/fake-printer.html",
        "fake-scanner": "src/web/fake-scanner.html",
      },
    },
  },
});
