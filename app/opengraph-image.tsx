import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { shapeArabic } from "./lib/arabicShape";

// Route segment config
export const alt = "تريس — ثلاثة محاصيل، حكاية واحدة. قهوة مختصة من الطائف.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand palette (from app/globals.css)
const BURGUNDY = "#700d28";
const BURGUNDY_DEEP = "#5a0a20";
const BURGUNDY_DARKEST = "#3a0714";
const BLUSH = "#efb4a2";
const CREAM = "#f7f0ea";

async function asset(...segments: string[]) {
  return readFile(join(process.cwd(), "public", "assets", ...segments));
}

export default async function OpengraphImage() {
  const [mascot, mark, arabicFont] = await Promise.all([
    asset("mascot-standing.png").then(
      (b) => `data:image/png;base64,${b.toString("base64")}`
    ),
    asset("logo", "tres-mark-white.png").then(
      (b) => `data:image/png;base64,${b.toString("base64")}`
    ),
    asset("fonts", "HelveticaNeueArabic-Bold.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row-reverse",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: BURGUNDY,
          backgroundImage: `radial-gradient(120% 120% at 78% 18%, ${BURGUNDY} 0%, ${BURGUNDY_DEEP} 48%, ${BURGUNDY_DARKEST} 100%)`,
          fontFamily: "HNArabic",
          padding: "0 80px",
          position: "relative",
        }}
      >
        {/* Soft blush halo behind the character */}
        <div
          style={{
            position: "absolute",
            top: 60,
            right: 60,
            width: 540,
            height: 540,
            borderRadius: 540,
            display: "flex",
            background:
              "radial-gradient(circle, rgba(239,180,162,0.28) 0%, rgba(239,180,162,0) 70%)",
          }}
        />

        {/* The character */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            height: "100%",
            width: 460,
            flexShrink: 0,
          }}
        >
          <img src={mascot} width={420} height={542} alt="" />
        </div>

        {/* Brand copy — shaped Arabic, aligned to the right edge */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            textAlign: "right",
            width: 560,
            flexShrink: 0,
          }}
        >
          <img src={mark} width={120} height={120} alt="" />
          <div
            style={{
              display: "flex",
              fontSize: 70,
              fontWeight: 700,
              color: CREAM,
              lineHeight: 1.25,
              marginTop: 18,
            }}
          >
            {shapeArabic("ثلاثة محاصيل،")}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 70,
              fontWeight: 700,
              color: CREAM,
              lineHeight: 1.25,
            }}
          >
            {shapeArabic("حكاية واحدة")}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 33,
              color: BLUSH,
              marginTop: 24,
            }}
          >
            {shapeArabic("قهوة مختصة من الطائف")}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 28,
              fontSize: 21,
              letterSpacing: 4,
              color: "rgba(247,240,234,0.78)",
            }}
          >
            THREE ORIGINS · ONE STORY
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "HNArabic",
          data: arabicFont,
          weight: 700,
          style: "normal",
        },
      ],
    }
  );
}
