import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "pandablob Admin",
    short_name: "pandablob",
    description: "Admin console for the pandablob JSON storage service",
    start_url: "/apps",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/api/pwa-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/api/pwa-icon?size=512&maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
