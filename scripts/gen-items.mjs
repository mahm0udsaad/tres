#!/usr/bin/env node
/**
 * Generate per-item product photos via Gemini 2.5 Flash Image ("Nano Banana").
 * Uses the TRES logo (sticker) as a reference image so it's printed natively.
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/gen-items.mjs           # all items
 *   GEMINI_API_KEY=... node scripts/gen-items.mjs cappuccino latte  # specific ids
 */

import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LOGO = join(ROOT, "public/assets/logo/tres-badge-burgundy.png");
const OUT = join(ROOT, "public/assets/items");

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("Missing GEMINI_API_KEY env var");
  process.exit(1);
}

const BASE = `Editorial product photo for a premium specialty coffee brand TRES. {SUBJECT}. Composition: on a seamless deep burgundy (hex #700D28) studio backdrop, soft directional light from upper left, rich soft shadows, cozy luxurious mood, 16:9 landscape, photorealistic, sharp realistic detail, true-to-life, no hallucinated shapes. The exact round TRES burgundy logo from the reference image is printed cleanly and undistorted on the {SURFACE}, properly curved to follow the surface, readable Arabic and Latin letters. No extra text, no watermark.`;

const ITEMS = [
  // SPECIALTY
  { id: "tres-roastery",      subj: "A pour-over chemex carafe with deep dark filter coffee and a small white ceramic cup beside it, scattered roasted coffee beans, a dried pink rose petal as a soft blush accent, gentle rising steam from the cup", surface: "front of the white cup" },
  { id: "ethiopian",          subj: "A hand-poured V60 dripper over a clear glass server filled with bright filter coffee, a small white tasting cup beside it, scattered light-roasted Ethiopian green-tinted coffee beans, a single fresh blueberry as accent", surface: "front of the white cup" },
  { id: "colombian",          subj: "A French press of dark Colombian coffee and a white ceramic mug on a saucer, a small bunch of red grapes as accent, scattered medium-roast beans, gentle steam", surface: "front of the white mug" },

  // COFFEE
  { id: "alfrido",            subj: "A small white ceramic cup of strong dark espresso with thin golden crema on a saucer, a single coffee bean balanced on the saucer", surface: "front of the white cup" },
  { id: "americano",          subj: "A tall white ceramic mug of black americano coffee with a light golden crema, a saucer, scattered roasted coffee beans, gentle steam", surface: "front of the white mug" },
  { id: "espresso",           subj: "A short white espresso cup half-filled with a perfect shot of dark espresso topped with thick golden hazelnut crema, sitting on a small saucer with a tiny spoon, two coffee beans beside it", surface: "front of the white espresso cup" },
  // cappuccino already generated (kept) — keep id to allow re-roll
  { id: "cappuccino",         subj: "A classic cappuccino in a white ceramic cup on a saucer, thick velvety milk foam with a light dusting of cocoa, gentle steam, a few roasted coffee beans beside the saucer", surface: "front of the white cup" },
  { id: "latte",              subj: "A tall white ceramic latte cup with creamy milky coffee, a single delicate heart-shaped latte art on top, on a saucer, a coffee bean as accent", surface: "front of the white cup" },
  { id: "flat-white",         subj: "A medium white ceramic cup of flat white coffee with smooth glossy microfoam and a tight rosetta latte art, on a saucer, two coffee beans beside it", surface: "front of the white cup" },
  { id: "cortado",            subj: "A small clear gibraltar glass of cortado — equal parts espresso and steamed milk with a thin layer of microfoam, on a small saucer, beside a few coffee beans", surface: "front of the small clear glass" },
  { id: "macchiato",          subj: "A small white espresso cup of espresso macchiato — espresso topped with a small dollop of foamed milk, on a saucer with a tiny spoon", surface: "front of the small white cup" },
  { id: "spanish-latte-hot",  subj: "A tall white ceramic mug of hot Spanish latte — espresso poured over sweet condensed milk forming two creamy layers, gentle steam, a saucer", surface: "front of the white mug" },
  { id: "spanish-latte-iced", subj: "A tall clear glass of iced Spanish latte with sweet condensed milk on the bottom, ice cubes, and dark espresso poured on top creating two beautiful contrasting layers, condensation droplets on the glass", surface: "front of the clear glass" },
  { id: "hot-tres",           subj: "A premium signature hot drink — a tall white ceramic mug of warm rich creamy coffee blend with delicate latte art, a small caramel swirl on the surface, gentle steam, on a wooden coaster", surface: "front of the white mug" },

  // DRINKS
  { id: "hibiscus",           subj: "A tall clear glass of vibrant deep red hibiscus iced tea with ice cubes, a fresh dried hibiscus flower as garnish, condensation droplets on the glass, a slice of dried orange beside it", surface: "front of the clear glass" },
  { id: "matcha",             subj: "A medium clear glass mug of bright vivid green hot matcha latte with layered creamy milk and matcha foam art on top, a bamboo whisk and small bowl of matcha powder beside it, soft steam", surface: "front of the clear glass mug" },
  { id: "matcha-foam",        subj: "A tall clear glass of iced matcha foam latte — bottom layer creamy milk over ice, vivid green matcha middle layer, thick cold matcha foam crown on top with a small fresh mint leaf, condensation droplets", surface: "front of the clear glass" },

  // DESSERTS — logo goes on the white plate rim
  { id: "triple-chocolate",   subj: "A tall slice of triple chocolate layer cake with glossy chocolate ganache, dark caramel sauce drizzle on top, and Belgian chocolate shavings, on a wide round white ceramic plate with empty rim, a dessert fork beside it", surface: "front rim of the white plate" },
  { id: "pecan-cake",         subj: "A slice of rich pecan layer cake with caramelized pecan nuts on top and a toffee sauce drizzle, on a wide round white ceramic plate with empty rim, a dessert fork beside it", surface: "front rim of the white plate" },
  { id: "london-cake",        subj: "A tall slice of dark chocolate fudge cake with thick chocolate ganache layers and a delicate caramel cream rosette on top, on a wide round white ceramic plate with empty rim, a dessert fork beside it", surface: "front rim of the white plate" },
  { id: "tres-cookies",       subj: "Three golden-baked round homemade cookies stacked slightly overlapping, with visible crumbly texture, on a round white ceramic plate with empty rim", surface: "front rim of the white plate" },
  { id: "raffaello-tres",     subj: "Five elegant white coconut-covered raffaello balls stacked in a small pyramid, with shredded coconut scattered around, on a round white ceramic plate with empty rim", surface: "front rim of the white plate" },
  { id: "lemon-blueberry-cake", subj: "A slice of layered lemon blueberry cake with bright yellow lemon cream and lavender-blue blueberry cream layers, topped with fresh blueberries and a lemon zest twist, on a wide round white ceramic plate with empty rim, a dessert fork beside it", surface: "front rim of the white plate" },
];

function buildPrompt({ subj, surface }) {
  return BASE.replace("{SUBJECT}", subj).replace("{SURFACE}", surface);
}

const ai = new GoogleGenAI({ apiKey: KEY });
const MODEL = "gemini-2.5-flash-image";

await mkdir(OUT, { recursive: true });
const logoBuf = await readFile(LOGO);
const logoB64 = logoBuf.toString("base64");

const targets = process.argv.slice(2).length
  ? ITEMS.filter((i) => process.argv.slice(2).includes(i.id))
  : ITEMS;

console.log(`Generating ${targets.length} items with ${MODEL}`);

async function generateOne(item, attempt = 1) {
  const prompt = buildPrompt(item);
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [
        { role: "user", parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/png", data: logoB64 } },
        ]},
      ],
    });
    const parts = res?.candidates?.[0]?.content?.parts || [];
    const img = parts.find((p) => p.inlineData?.data);
    if (!img) throw new Error("no image returned: " + JSON.stringify(res?.candidates?.[0]?.finishReason));
    const buf = Buffer.from(img.inlineData.data, "base64");
    const outPath = join(OUT, `${item.id}.webp`);
    await sharp(buf).resize(1200, 1200, { fit: "cover", position: "center" }).webp({ quality: 86 }).toFile(outPath);
    console.log(`✓ ${item.id}`);
    return { id: item.id, ok: true };
  } catch (e) {
    if (attempt < 3) {
      console.log(`… retry ${item.id} (${attempt}) — ${e.message?.slice(0,80)}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      return generateOne(item, attempt + 1);
    }
    console.error(`✗ ${item.id} — ${e.message}`);
    return { id: item.id, ok: false, error: e.message };
  }
}

// Run with concurrency limit
const CONCURRENCY = 4;
const queue = [...targets];
const results = [];
async function worker() {
  while (queue.length) {
    const item = queue.shift();
    results.push(await generateOne(item));
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const ok = results.filter(r => r.ok).length;
const fail = results.filter(r => !r.ok);
console.log(`\nDone: ${ok}/${results.length} ok`);
if (fail.length) console.log("Failed:", fail.map(f => f.id).join(", "));
