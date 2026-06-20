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
      {
        src: "/assets/logo/tres-badge-burgundy.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
