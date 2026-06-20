/**
 * Canonical site origin used for absolute URLs (metadataBase, sitemap,
 * robots, JSON-LD). Override per-environment with NEXT_PUBLIC_SITE_URL,
 * e.g. NEXT_PUBLIC_SITE_URL=https://tres.sa
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://tres.sa"
).replace(/\/$/, "");

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
