import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GST Registry",
    short_name: "GST Registry",
    description: "Track GST paid on purchases for CA reconciliation",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait-primary",
    lang: "en",
    dir: "ltr",
    theme_color: "#0f766e",
    background_color: "#0b0e0d",
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
        name: "Reconcile",
        short_name: "Recon",
        url: "/purchases",
        icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
