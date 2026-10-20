import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the web front ends into dist/web, which the server serves. The observatory screen joins in ticket 03.
export default defineConfig({
  root: "src/web",
  plugins: [react()],
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    rollupOptions: {
      input: { "control-center": "src/web/index.html" },
    },
  },
});
