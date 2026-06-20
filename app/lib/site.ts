/**
 * Canonical site origin used for absolute URLs (metadataBase, og:image,
 * sitemap, robots, JSON-LD).
 *
 * Resolution order — picks a URL that is actually reachable in each env so
 * social crawlers can fetch the OG image:
 *   1. NEXT_PUBLIC_SITE_URL  — set this once the custom domain is live
 *                              (e.g. https://tres.sa). Overrides everything.
 *   2. Production on Vercel   → the stable production domain.
 *   3. Any other Vercel deploy (preview/branch) → that deployment's own URL,
 *      so its OG image is self-contained and testable.
 *   4. Local dev              → http://localhost:3000.
 *
 * VERCEL_* vars are provided automatically by Vercel at build & runtime.
 */
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl().replace(/\/$/, "");

export const SITE = {
  name: "تريس",
  nameEn: "TRES",
  tagline: "ثلاثة محاصيل، حكاية واحدة",
  taglineEn: "THREE ORIGINS · ONE STORY",
  description:
    "تريس قهوة مختصة من الطائف. ثلاثة محاصيل: الإثيوبي، الكولومبي، ومزيج تريس، نحمّصها بدفعات صغيرة بطعم واضح ومتوازن.",
  city: "الطائف",
  country: "SA",
  locale: "ar_SA",
  instagram: "https://www.instagram.com/tres_saudi",
  tiktok: "https://www.tiktok.com/@tres.ksa",
  snapchat: "https://snapchat.com/t/U1ejkI2G",
} as const;
