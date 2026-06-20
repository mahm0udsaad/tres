import { convertArabic } from "arabic-reshaper";
import bidiFactory from "bidi-js";

const bidi = bidiFactory();

/**
 * Satori (the engine behind `next/og`) does not perform Arabic glyph joining
 * or RTL bidi reordering — it draws code points left-to-right in isolated
 * forms. To render correct Arabic in an OG image we pre-process the string:
 *
 *   1. `convertArabic` → swap each letter for its contextual presentation
 *      form (initial/medial/final/isolated) so glyphs visually connect.
 *   2. bidi reorder → flip the runs so the visually-ordered glyphs read
 *      right-to-left when laid out by an LTR engine.
 *
 * Use only for static, display-only strings (headlines, taglines).
 */
export function shapeArabic(input: string): string {
  const reshaped = convertArabic(input);
  const embeddingLevels = bidi.getEmbeddingLevels(reshaped, "rtl");
  const segments = bidi.getReorderSegments(reshaped, embeddingLevels);

  const chars = reshaped.split("");
  for (const [start, end] of segments) {
    const slice = chars.slice(start, end + 1).reverse();
    for (let i = start; i <= end; i++) chars[i] = slice[i - start];
  }
  return chars.join("");
}
