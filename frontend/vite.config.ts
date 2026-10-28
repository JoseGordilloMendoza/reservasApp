import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// In development the browser talks to this server and /api is forwarded to the
// backend, so no CORS setup is needed. In production VITE_API_URL points at the API.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // Docker on Windows and macOS does not forward file events from mounted folders,
    // so without polling the dev server keeps serving the files it first read.
    watch: { usePolling: true, interval: 300 },
    proxy: { "/api": { target: apiTarget, changeOrigin: true } },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
