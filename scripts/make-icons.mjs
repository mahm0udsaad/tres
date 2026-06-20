// Generates favicon + app icons from the TRES badge logo.
// Run: node scripts/make-icons.mjs
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";

const SRC = "public/assets/logo/tres-badge-burgundy.png";
const CREAM = { r: 0xf7, g: 0xf0, b: 0xea, alpha: 1 };

// Badge on a cream square with padding, sized to `size`.
function badgeOnCream(size, padRatio) {
  const inner = Math.round(size * (1 - padRatio));
  const pad = Math.round((size - inner) / 2);
  return sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: CREAM })
    .resize(size, size)
    .png();
}

// Next.js file-convention icons (app/) — auto-linked in <head>.
await badgeOnCream(192, 0.16).toFile("app/icon.png");
await badgeOnCream(180, 0.18).toFile("app/apple-icon.png");

// Classic favicon.ico (16/32/48) for crawlers + legacy browsers.
const sizes = [16, 32, 48];
const buffers = await Promise.all(
  sizes.map((s) => badgeOnCream(s, 0.12).toBuffer())
);
const ico = await pngToIco(buffers);
await writeFile("app/favicon.ico", ico);

// PWA / manifest icons (stable public paths, on cream so they're never transparent).
await badgeOnCream(192, 0.16).toFile("public/icon-192.png");
await badgeOnCream(512, 0.16).toFile("public/icon-512.png");

console.log(
  "Wrote app/icon.png, app/apple-icon.png, app/favicon.ico, public/icon-{192,512}.png"
);
