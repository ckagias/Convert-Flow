import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the backend during local development
    // (not used in Docker where Nginx handles proxying)
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
