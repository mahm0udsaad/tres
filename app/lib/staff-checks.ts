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

export type CheckItem = { key: string; ar: string; en: string };

/** Areas a cleaning shift covers. */
export const CLEANING_CHECKS: CheckItem[] = [
  { key: "floor", ar: "الأرضيات", en: "Floors" },
  { key: "tables", ar: "الطاولات", en: "Tables" },
  { key: "counter", ar: "الكاونتر", en: "Counter" },
  { key: "bathrooms", ar: "دورات المياه", en: "Bathrooms" },
  { key: "windows", ar: "الزجاج والواجهة", en: "Glass & storefront" },
  { key: "entrance", ar: "المدخل", en: "Entrance" },
  { key: "trash", ar: "النفايات", en: "Trash" },
  { key: "storage", ar: "المستودع", en: "Storage" },
];

/** Bar handover state at end of shift. */
export const BARISTA_CHECKS: CheckItem[] = [
  { key: "machine", ar: "تنظيف المكينة", en: "Machine cleaned" },
  { key: "grinder", ar: "تنظيف المطحنة", en: "Grinder cleaned" },
  { key: "beans", ar: "تعبئة البن", en: "Beans refilled" },
  { key: "milk", ar: "تعبئة الحليب", en: "Milk restocked" },
  { key: "syrups", ar: "فحص النكهات", en: "Syrups checked" },
  { key: "cups", ar: "تجهيز الأكواب", en: "Cups stocked" },
  { key: "ice", ar: "تعبئة الثلج", en: "Ice refilled" },
  { key: "fridge", ar: "ترتيب ثلاجة البار", en: "Bar fridge tidied" },
];

/** Kitchen cleanliness areas. */
export const KITCHEN_CHECKS: CheckItem[] = [
  { key: "surfaces", ar: "الأسطح", en: "Surfaces" },
  { key: "equipment", ar: "المعدات", en: "Equipment" },
  { key: "prep", ar: "منطقة التحضير", en: "Prep area" },
  { key: "fridge", ar: "الثلاجات", en: "Fridges" },
  { key: "floor", ar: "أرضية المطبخ", en: "Kitchen floor" },
  { key: "waste", ar: "النفايات", en: "Waste" },
];

export type InventoryPreset = CheckItem & { category: "product" | "dessert" };

/**
 * Default rows for the kitchen count, so the stock take is "tap +/−" instead
 * of "type a name, pick a category, type a number". Postgres requires at
 * least one product and one dessert; the preset always satisfies that.
 */
export const INVENTORY_PRESET: InventoryPreset[] = [
  { key: "sandwiches", ar: "ساندويتشات", en: "Sandwiches", category: "product" },
  { key: "croissants", ar: "كرواسون", en: "Croissants", category: "product" },
  { key: "salads", ar: "سلطات", en: "Salads", category: "product" },
  { key: "cake", ar: "كيك", en: "Cake slices", category: "dessert" },
  { key: "cheesecake", ar: "تشيز كيك", en: "Cheesecake", category: "dessert" },
  { key: "cookies", ar: "كوكيز", en: "Cookies", category: "dessert" },
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
