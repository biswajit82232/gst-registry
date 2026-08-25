import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GST Registry",
    short_name: "GST Registry",
    description: "GST purchase register — track if parties passed input",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait-primary",
    lang: "en",
    dir: "ltr",
    theme_color: "#f7f6f3",
    background_color: "#f7f6f3",
    categories: ["finance", "business", "productivity"],
    icons: [
      {
        src: "/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Add bill",
        short_name: "Add",
        url: "/purchases/new",
        icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Register",
        short_name: "Register",
        url: "/",
        icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Parties",
        short_name: "Parties",
        url: "/suppliers",
        icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
