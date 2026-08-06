/**
 * Tap-to-answer content for the daily reports.
 *
 * Employees used to have to type a 10+ character paragraph into a required
 * textarea on a phone, in their second language. Instead they tap what they
 * finished; the server turns the selection into the Arabic notes string the
 * supervisor review queue reads, and keeps the raw keys in `report_data` so
 * the answers stay machine-readable.
 *
 * Postgres only requires notes of length 1–5000, so no migration is needed.
 * Both the client form and the server action import from here so the labels
 * and the stored text can never drift apart.
 */

export type CheckItem = { key: string; ar: string; bn: string; en: string };

/** Areas a cleaning shift covers. */
export const CLEANING_CHECKS: CheckItem[] = [
  { key: "floor", ar: "الأرضيات", bn: "মেঝে", en: "Floors" },
  { key: "tables", ar: "الطاولات", bn: "টেবিল", en: "Tables" },
  { key: "counter", ar: "الكاونتر", bn: "কাউন্টার", en: "Counter" },
  { key: "bathrooms", ar: "دورات المياه", bn: "শৌচাগার", en: "Bathrooms" },
  { key: "windows", ar: "الزجاج والواجهة", bn: "কাচ ও সামনের অংশ", en: "Glass & storefront" },
  { key: "entrance", ar: "المدخل", bn: "প্রবেশপথ", en: "Entrance" },
  { key: "trash", ar: "النفايات", bn: "আবর্জনা", en: "Trash" },
  { key: "storage", ar: "المستودع", bn: "গুদাম", en: "Storage" },
];

/** Bar handover state at end of shift. */
export const BARISTA_CHECKS: CheckItem[] = [
  { key: "machine", ar: "تنظيف المكينة", bn: "মেশিন পরিষ্কার", en: "Machine cleaned" },
  { key: "grinder", ar: "تنظيف المطحنة", bn: "গ্রাইন্ডার পরিষ্কার", en: "Grinder cleaned" },
  { key: "beans", ar: "تعبئة البن", bn: "কফি বিন ভরা", en: "Beans refilled" },
  { key: "milk", ar: "تعبئة الحليب", bn: "দুধ পুনরায় মজুত", en: "Milk restocked" },
  { key: "syrups", ar: "فحص النكهات", bn: "সিরাপ পরীক্ষা", en: "Syrups checked" },
  { key: "cups", ar: "تجهيز الأكواب", bn: "কাপ মজুত", en: "Cups stocked" },
  { key: "ice", ar: "تعبئة الثلج", bn: "বরফ ভরা", en: "Ice refilled" },
  { key: "fridge", ar: "ترتيب ثلاجة البار", bn: "বার ফ্রিজ গুছানো", en: "Bar fridge tidied" },
];

/** Kitchen cleanliness areas. */
export const KITCHEN_CHECKS: CheckItem[] = [
  { key: "surfaces", ar: "الأسطح", bn: "কাজের পৃষ্ঠ", en: "Surfaces" },
  { key: "equipment", ar: "المعدات", bn: "সরঞ্জাম", en: "Equipment" },
  { key: "prep", ar: "منطقة التحضير", bn: "প্রস্তুতির স্থান", en: "Prep area" },
  { key: "fridge", ar: "الثلاجات", bn: "ফ্রিজ", en: "Fridges" },
  { key: "floor", ar: "أرضية المطبخ", bn: "রান্নাঘরের মেঝে", en: "Kitchen floor" },
  { key: "waste", ar: "النفايات", bn: "বর্জ্য", en: "Waste" },
];

export type InventoryPreset = CheckItem & { category: "product" | "dessert" };

/**
 * Default rows for the kitchen count, so the stock take is "tap +/−" instead
 * of "type a name, pick a category, type a number". Postgres requires at
 * least one product and one dessert; the preset always satisfies that.
 */
export const INVENTORY_PRESET: InventoryPreset[] = [
  { key: "sandwiches", ar: "ساندويتشات", bn: "স্যান্ডউইচ", en: "Sandwiches", category: "product" },
  { key: "croissants", ar: "كرواسون", bn: "ক্রোসাঁ", en: "Croissants", category: "product" },
  { key: "salads", ar: "سلطات", bn: "সালাদ", en: "Salads", category: "product" },
  { key: "cake", ar: "كيك", bn: "কেকের টুকরা", en: "Cake slices", category: "dessert" },
  { key: "cheesecake", ar: "تشيز كيك", bn: "চিজকেক", en: "Cheesecake", category: "dessert" },
  { key: "cookies", ar: "كوكيز", bn: "কুকিজ", en: "Cookies", category: "dessert" },
];

export const CHECK_SETS = {
  cleaning: CLEANING_CHECKS,
  barista: BARISTA_CHECKS,
  kitchen: KITCHEN_CHECKS,
} as const;

export type CheckSet = keyof typeof CHECK_SETS;

/** Arabic labels for the selected keys, in the order they are displayed. */
export function selectedLabels(items: CheckItem[], keys: string[]): string[] {
  const picked = new Set(keys);
  return items.filter((item) => picked.has(item.key)).map((item) => item.ar);
}

/**
 * Build the Arabic notes string stored on the report. Supervisor surfaces are
 * Arabic, so the tapped answers are written in Arabic regardless of the
 * employee's dashboard language; a free-text note is appended verbatim.
 */
export function buildNotes(
  items: CheckItem[],
  keys: string[],
  extraNote: string,
  prefix = "تم إنجاز",
): string {
  const labels = selectedLabels(items, keys);
  const head = labels.length ? `${prefix}: ${labels.join("، ")}.` : "";
  const tail = extraNote ? `ملاحظة الموظف: ${extraNote}` : "";
  return [head, tail].filter(Boolean).join(" ").trim();
}
