/**
 * Saudi National Day copy, per the GEA guideline (public/SND-GUIDELINE .pdf).
 *
 * §1.1 — the year's slogan. §4.1 — the six supporting slogans, one per trait,
 * all built on the same «عزّنا بـ___» frame. §4.2 — the approved hashtags.
 *
 * These are plain text, so they ship with the theme; the logo artwork, the
 * Saudi Font and the trait illustrations are GEA-issued files and are not.
 */

export const ND_SLOGAN = "عزّنا بطبعنا";

/** §4.1 — ordered to lead with الكرم, the dallah-and-finjan trait this skin
 *  leans on (a coffee house's trait). `color` is the trait's identity colour
 *  from §5.2. */
export const ND_SLOGANS: { text: string; trait: string; color: string }[] = [
  { text: "عزّنا بكرمنا", trait: "الكرم", color: "#0050af" },
  { text: "عزّنا بأصالتنا", trait: "الأصالة", color: "#5aba1c" },
  { text: "عزّنا بجودنا", trait: "الجود", color: "#6565e0" },
  { text: "عزّنا بهمّتنا", trait: "الهمة", color: "#7c5d21" },
  { text: "عزّنا بشجاعتنا", trait: "الشجاعة", color: "#971a4d" },
  { text: "عزّنا برؤيتنا", trait: "الرؤية", color: "#607c4f" },
];

/** §4.2 — the approved hashtags. */
export const ND_HASHTAGS = ["#عزنا_بطبعنا", "#اليوم_الوطني_السعودي"];
