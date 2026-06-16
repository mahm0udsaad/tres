import { readdirSync } from "fs";
import { join } from "path";

/**
 * Item ids that have a real photo in /public/assets/items (server-side, at
 * build/request time). The menu guesses image paths from item ids, so this
 * lets the client render a glyph placeholder instead of a broken <img> for
 * items that don't have a photo yet — with no load-error flicker.
 */
export function availableItemImages(): string[] {
  try {
    return readdirSync(join(process.cwd(), "public/assets/items"))
      .filter((f) => /\.(webp|png|jpe?g|avif)$/i.test(f))
      .map((f) => f.replace(/\.[^.]+$/, ""));
  } catch {
    return [];
  }
}
