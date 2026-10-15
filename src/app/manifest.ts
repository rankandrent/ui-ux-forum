import type { MetadataRoute } from "next";
import { SITE_TAGLINE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UI/UX Forum",
    short_name: "UI/UX Forum",
    description: SITE_TAGLINE,
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#0755E9",
    background_color: "#1B232E",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
