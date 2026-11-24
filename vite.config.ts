import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Release builds (STAR_CHART_RELEASE=true) leave out development-only pages such as the Art Gallery.
const release = process.env.STAR_CHART_RELEASE === "true";

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
        "phone-setup": "src/web/phone-setup.html",
        "accept-invitation": "src/web/accept-invitation.html",
        "reset-password": "src/web/reset-password.html",
        ...(release ? {} : { "art-gallery": "src/web/art-gallery.html" }),
      },
    },
  },
});
