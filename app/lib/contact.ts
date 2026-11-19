/**
 * Contact channels the owner sets in the control panel (settings.whatsapp,
 * settings.maps_url), with the site's own fallbacks so every surface has
 * something to link to before those fields are filled in.
 *
 * WhatsApp numbers are stored however the owner types them; `waLink` strips
 * everything but digits, since wa.me only accepts the international form.
 */
export const CONTACT_FALLBACK = {
  /** The catering line the owner gave us (+966 56 844 7515). The control
   *  panel's الإعدادات → واتساب overrides it once filled in. */
  whatsapp: "966568447515",
  mapsUrl: "https://maps.app.goo.gl/r5LYzFPHqhtSa5is6",
} as const;

/** برنامج الولاء — the loyalty card the mascot and the home page both link to.
 *  One constant so the QR, the mascot bubble and the home tile never drift. */
export const LOYALTY_URL = "https://loyapro.com/c-r/NzEwMA==";

export function waDigits(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** wa.me deep link with an optional prefilled message, or null when no number
 *  is configured — callers hide the button rather than linking nowhere. */
export function waLink(raw: string | null | undefined, message?: string): string | null {
  const digits = waDigits(raw) || waDigits(CONTACT_FALLBACK.whatsapp);
  if (!digits) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export function mapsLink(raw: string | null | undefined): string {
  return (raw ?? "").trim() || CONTACT_FALLBACK.mapsUrl;
}

/** The store on Google Maps, from the owner's share link.
 *  `embed` is the classic maps embed (no API key needed), `place` opens the
 *  listing, `directions` starts navigation from wherever the visitor is. */
export const STORE = {
  name: "تريس",
  nameEn: "TRES",
  address: "الطائف — حي الجال، شارع الخمسين",
  query: "TRES - تريس، شارع الخمسين، حي الجال، الطائف 12345",
} as const;

export const STORE_MAPS = {
  embed: `https://maps.google.com/maps?q=${encodeURIComponent(STORE.query)}&hl=ar&z=15&output=embed`,
  place: CONTACT_FALLBACK.mapsUrl,
  directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(STORE.query)}`,
} as const;
