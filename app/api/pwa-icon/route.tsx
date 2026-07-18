import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const size = Math.min(1024, Math.max(16, parseInt(searchParams.get("size") ?? "512", 10) || 512));
  const maskable = searchParams.get("maskable") === "1";

  // Maskable icons get cropped to a circle/shape by the OS, so the glyph must
  // sit inside the ~80% "safe zone" instead of filling the full canvas.
  const padding = maskable ? size * 0.2 : 0;
  const fontSize = (size - padding * 2) * 0.55;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          borderRadius: maskable ? 0 : size * 0.18,
        }}
      >
        <div
          style={{
            width: size - padding * 2,
            height: size - padding * 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize,
          }}
        >
          🐼
        </div>
      </div>
    ),
    { width: size, height: size, emoji: "twemoji" }
  );
}
