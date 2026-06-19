export type Item = {
  id?: string;
  ar: string;
  en?: string;
  price: string;
  badge?: string;
  cal?: string; // Arabic-Indic calories, desserts only
  desc?: string; // Arabic description, desserts only
  image?: string; // /assets/items/<id>.webp
  /** Emblem shown as a circular medallion when the item has no photo
   *  (e.g. an origin flag, or the TRES mark). */
  emblem?: string;
  /** How the emblem sits in its medallion: "cover" (flags) or "contain" (logos). */
  emblemFit?: "cover" | "contain";
  /** الإيحاءات — coffee tasting/flavor notes (specialty origins & blends). */
  notes?: string[];
  /** Coffee origin spec sheet, shown beneath the tasting notes. */
  variety?: string; // السلالة
  altitude?: string; // الارتفاع
  process?: string; // المعالجة
};

export type Category = {
  id: string;
  no: string;
  en: string;
  ar: string;
  tagline: string;
  glyph: string;
  /** Optional tile background photo, e.g. "/assets/menu/coffee.webp".
   *  When set, the tile shows the photo (with a scrim) instead of the flat color. */
  image?: string;
  note?: string;
  items: Item[];
};

// Transcribed from the official TRES printed menu.
export const CATEGORIES: Category[] = [
  {
    id: "specialty",
    no: "01",
    en: "SPECIALTY COFFEE",
    ar: "قهوة مختصة",
    tagline: "ثلاثة محاصيل بطابع تريس",
    glyph: "🫘",
    image: "/assets/menu/specialty.webp",
    items: [
      {
        id: "tres-roastery",
        ar: "محصول تريس",
        en: "Tres Roastery",
        price: "20",
        badge: "حار / بارد",
        emblem: "/assets/logo/tres-mark-white.png",
        emblemFit: "contain",
        notes: ["فواكه استوائية", "مانجو", "عسل", "شوكولاتة"],
        variety: "تيبيكا، ريد بوربون",
        altitude: "1400–1600 م",
        process: "مجففة",
      },
      {
        id: "ethiopian",
        ar: "إثيوبي",
        en: "Ethiopian",
        price: "17",
        badge: "حار / بارد",
        emblem: "/assets/flags/ethiopia.svg",
        emblemFit: "cover",
        notes: ["توت أزرق مجفف", "كراميل", "ليمون", "مسحوق الكاكاو"],
        variety: "هيريليوم",
        altitude: "2000 م",
        process: "مجففة",
      },
      {
        id: "colombian",
        ar: "كولومبي",
        en: "Colombian",
        price: "17",
        badge: "حار / بارد",
        emblem: "/assets/flags/colombia.svg",
        emblemFit: "cover",
        notes: ["تفاح", "فواكه"],
        variety: "كاتورا",
        altitude: "1950 م",
        process: "مجففة",
      },
    ],
  },
  {
    id: "coffee",
    no: "02",
    en: "MILK DRINKS",
    ar: "مشاريب الحليب",
    tagline: "إسبريسو، لاتيه، وخياراتك اليومية",
    glyph: "☕",
    image: "/assets/menu/coffee.webp",
    items: [
      { id: "alfrido", ar: "ألفريدو", en: "Alfrido", price: "13" },
      { id: "americano", ar: "أمريكانو", en: "Americano", price: "14", badge: "حار / بارد" },
      {
        id: "espresso",
        ar: "إسبرسو",
        en: "Espresso",
        price: "12",
        notes: ["شوكولاتة", "فواكه", "بندق"],
        variety: "مزيج خاص",
        altitude: "—",
        process: "مجففة - مغسولة",
      },
      { id: "cappuccino", ar: "كابتشينو", en: "Cappuccino", price: "16", image: "/assets/items/cappuccino.webp" },
      { id: "latte", ar: "لاتيه", en: "Latte", price: "16" },
      { id: "flat-white", ar: "فلات وايت", en: "Flat White", price: "16" },
      { id: "cortado", ar: "كورتادو", en: "Cortado", price: "15" },
      { id: "macchiato", ar: "ميكاتو", en: "Macchiato", price: "12" },
      { id: "spanish-latte-hot", ar: "سبانش لاتيه", en: "Spanish Latte", price: "18", badge: "حار" },
      { id: "spanish-latte-iced", ar: "سبانش لاتيه", en: "Spanish Latte", price: "19", badge: "بارد" },
      { id: "hot-tres", ar: "هوت تريس", en: "Hot Tres", price: "19", badge: "توقيع · حار" },
    ],
  },
  {
    id: "drinks",
    no: "03",
    en: "MATCHA",
    ar: "ماتشا",
    tagline: "ماتشا، كركديه، وخيارات منعشة",
    glyph: "🍵",
    image: "/assets/menu/drinks.webp",
    items: [
      { id: "hibiscus", ar: "كركديه", en: "Hibiscus", price: "15" },
      { id: "matcha", ar: "ماتشا", en: "Matcha", price: "18", badge: "حار / بارد" },
      { id: "matcha-foam", ar: "ماتشا فوم", en: "Matcha Foam", price: "20" },
    ],
  },
  {
    id: "dessert",
    no: "04",
    en: "DESSERTS",
    ar: "الحلا",
    tagline: "حلا يكمّل قهوتك",
    glyph: "🍰",
    image: "/assets/menu/dessert.webp",
    note: "قد تحتوي هذه المنتجات على مسببات الحساسية (المكسرات ومنتجات الألبان والبيض).",
    items: [
      {
        id: "triple-chocolate",
        ar: "تربل شوكلت",
        en: "Triple Chocolate",
        price: "25",
        cal: "540",
        desc: "كيكة شوكولاتة محشوة جاناش، مع صوص شوكولاتة كراميل وشوكولاتة بلجيكية.",
      },
      {
        id: "pecan-cake",
        ar: "كيك البيكان",
        en: "Pecan Cake",
        price: "25",
        cal: "410",
        desc: "طبقات من كيك البيكان الغني بالمكسرات وصوص التوفي.",
      },
      {
        id: "london-cake",
        ar: "كيكة لندن",
        en: "London Cake",
        price: "28",
        cal: "540",
        desc: "طبقات من كيك فادج الشوكولاتة وجاناش الشوكولاتة مع كريمة الكراميل.",
      },
      {
        id: "tres-cookies",
        ar: "كوكيز تريس",
        en: "Tres Cookies",
        price: "12",
        cal: "350",
        desc: "كوكيز تريس المخبوزة بعناية.",
      },
      {
        id: "raffaello-tres",
        ar: "رافيلو تريس",
        en: "Raffaello Tres",
        price: "25",
        cal: "350",
        desc: "مزيج كريمي غني بجوز الهند، بطعم فاخر وخفيف يذوب في الفم.",
      },
      {
        id: "lemon-blueberry-cake",
        ar: "ليمون بلو بيري كيك",
        en: "Lemon Blueberry Cake",
        price: "25",
        cal: "410",
        desc: "كيك مع طبقة من كريمة الليمون وكريمة التوت وحبات بلوبيري.",
      },
    ],
  },
];

export function getCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function toArabic(n: number | string): string {
  return String(n);
}
