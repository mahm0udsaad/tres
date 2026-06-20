import type { MetadataRoute } from "next";
import { SITE } from "./lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "تريس — قهوة مختصة",
    short_name: "تريس",
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#f7f0ea",
    theme_color: "#700d28",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
