import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /* In local dev, forward /auth, /files, /health to the backend on port 8000 */
    proxy: {
      "/auth":  "http://localhost:8000",
      "/files": "http://localhost:8000",
      "/health":"http://localhost:8000",
    },
  },
  build: {
    outDir:    "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          icons:  ["lucide-react"],
        },
      },
    },
  },
});
