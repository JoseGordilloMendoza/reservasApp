import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// In development the browser talks to this server and /api is forwarded to the
// backend, so no CORS setup is needed. In production VITE_API_URL points at the API.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Separa",
        short_name: "Separa",
        description: "Separa tu cancha o tu cita en menos de un minuto.",
        lang: "es-PE",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#D92E3A",
        background_color: "#FFF3B0",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Only the app itself is cached; bookings and availability always come from the server.
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Spanish only needs the latin subsets; the browser never asks for the others.
        globIgnores: ["**/*-cyrillic*", "**/*-vietnamese*", "**/*-greek*"],
      },
    }),
  ],
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
