import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GST Registry",
    short_name: "GST Registry",
    description: "Track GST paid on purchases for CA reconciliation",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#0f766e",
    background_color: "#0b0e0d",
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
