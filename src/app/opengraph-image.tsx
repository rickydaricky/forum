import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Both Takes — AI Debate & Mediation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#ededed",
            marginBottom: 24,
          }}
        >
          Both Takes
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#a1a1aa",
            maxWidth: 700,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Two sides. Two AI advocates. One ruling.
        </div>
        <div
          style={{
            display: "flex",
            gap: 32,
            marginTop: 48,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#3b82f6",
              }}
            />
            <span style={{ color: "#71717a", fontSize: 18 }}>Side A</span>
          </div>
          <div style={{ color: "#3f3f46", fontSize: 18 }}>vs</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#f59e0b",
              }}
            />
            <span style={{ color: "#71717a", fontSize: 18 }}>Side B</span>
          </div>
          <div style={{ color: "#3f3f46", fontSize: 18 }}>→</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#a855f7",
              }}
            />
            <span style={{ color: "#71717a", fontSize: 18 }}>Verdict</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
