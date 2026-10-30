import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Carta BTS",
        short_name: "Carta BTS",
        description: "Carta náutica offline, surf e previsão da Baía de Todos os Santos",
        lang: "pt-BR",
        theme_color: "#0f1c2b",
        background_color: "#0f1c2b",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // inclui as cartas que vêm com o app (KAP) pra funcionarem offline na versão web
        globPatterns: ["**/*.{js,css,html,svg,png,json,KAP,kap}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Mapas de fundo vistos online ficam guardados pra uso offline.
            urlPattern: /^https:\/\/(tile\.openstreetmap\.org|tiles\.openseamap\.org)\//,
            handler: "CacheFirst",
            options: { cacheName: "mapa-fundo", expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 24 * 3600 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
});
