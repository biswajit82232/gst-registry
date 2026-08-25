import { ImageResponse } from "next/og";

export function generateImageMetadata() {
  return [
    { contentType: "image/png", size: { width: 192, height: 192 }, id: "192" },
    { contentType: "image/png", size: { width: 512, height: 512 }, id: "512" },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const iconId = String(await id);
  const size = iconId === "512" ? 512 : 192;
  const fontSize = iconId === "512" ? 168 : 58;
  const radius = iconId === "512" ? 96 : 36;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f766e",
          color: "white",
          fontSize,
          fontWeight: 700,
          letterSpacing: iconId === "512" ? -6 : -2,
          borderRadius: radius,
        }}
      >
        GST
      </div>
    ),
    { width: size, height: size },
  );
}
