import "server-only";
import { supabasePublic, supabaseConfigured } from "./supabase";
import { CATEGORIES, type Category, type Item } from "./menu";

/** Row shapes as stored in Supabase. */
export type DbCategory = {
  id: string;
  slug: string;
  number: string | null;
  name_ar: string;
  name_en: string | null;
  tagline: string | null;
  glyph: string | null;
  image_url: string | null;
  note: string | null;
  template: "simple" | "coffee" | "dessert";
  sort_order: number;
  is_active: boolean;
};

export type DbItem = {
  id: string;
  category_id: string;
  slug: string | null;
  name_ar: string;
  name_en: string | null;
  price: number | null;
  badge: string | null;
  cal: string | null;
  description: string | null;
  image_url: string | null;
  emblem_url: string | null;
  emblem_fit: "cover" | "contain" | null;
  notes: string[] | null;
  variety: string | null;
  altitude: string | null;
  process: string | null;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
};

function priceToStr(p: number | null): string {
  if (p == null) return "";
  // drop trailing .00 so "16.00" reads as "16"
  return Number.isInteger(p) ? String(p) : String(p).replace(/\.?0+$/, "");
}

/** Map a DB item row onto the legacy `Item` shape the UI already renders. */
export function mapItem(r: DbItem): Item & { dbId: string; available: boolean; featured: boolean } {
  return {
    id: r.slug ?? r.id,
    ar: r.name_ar,
    en: r.name_en ?? undefined,
    price: priceToStr(r.price),
    badge: r.badge ?? undefined,
    cal: r.cal ?? undefined,
    desc: r.description ?? undefined,
    image: r.image_url ?? undefined,
    emblem: r.emblem_url ?? undefined,
    emblemFit: r.emblem_fit ?? undefined,
    notes: r.notes && r.notes.length ? r.notes : undefined,
    variety: r.variety ?? undefined,
    altitude: r.altitude ?? undefined,
    process: r.process ?? undefined,
    dbId: r.id,
    available: r.is_available,
    featured: r.is_featured,
  };
}

function mapCategory(c: DbCategory, items: Item[]): Category {
  return {
    id: c.slug,
    no: c.number ?? "",
    en: c.name_en ?? "",
    ar: c.name_ar,
    tagline: c.tagline ?? "",
    glyph: c.glyph ?? "",
    image: c.image_url ?? undefined,
    note: c.note ?? undefined,
    items,
  };
}

type MenuResult = {
  categories: Category[];
  /** Featured items (today's picks), each with its parent category slug. */
  featured: { item: Item; categorySlug: string }[];
  /** True when data came from Supabase, false when using the static fallback. */
  live: boolean;
};

/**
 * The public menu. Reads active categories + available items from Supabase and
 * returns them in the legacy `Category[]` shape. Falls back to the static menu
 * when Supabase isn't configured or returns nothing, so the site never breaks.
 */
export async function getMenu(): Promise<MenuResult> {
  if (!supabaseConfigured) return staticMenu();
  try {
    const sb = supabasePublic();
    const [{ data: cats, error: cErr }, { data: items, error: iErr }] = await Promise.all([
      sb.from("categories").select("*").eq("is_active", true).order("sort_order"),
      sb.from("items").select("*").eq("is_available", true).order("sort_order"),
    ]);
    if (cErr || iErr || !cats || cats.length === 0) return staticMenu();

    const byCat = new Map<string, Item[]>();
    const featured: { item: Item; categorySlug: string }[] = [];
    for (const row of (items ?? []) as DbItem[]) {
      const mapped = mapItem(row);
      if (!byCat.has(row.category_id)) byCat.set(row.category_id, []);
      byCat.get(row.category_id)!.push(mapped);
    }
    const categories = (cats as DbCategory[]).map((c) => {
      const list = byCat.get(c.id) ?? [];
      for (const m of list as (Item & { featured?: boolean })[]) {
        if (m.featured) featured.push({ item: m, categorySlug: c.slug });
      }
      return mapCategory(c, list);
    });
    return { categories, featured, live: true };
  } catch {
    return staticMenu();
  }
}

/** Resolve a single category by slug from the live (or fallback) menu. */
export async function getMenuCategory(slug: string): Promise<Category | undefined> {
  const { categories } = await getMenu();
  return categories.find((c) => c.id === slug);
}

/** Visual identity the admin can switch from the control panel. */
export type ThemeId = "classic" | "summer";
export const THEMES: ThemeId[] = ["classic", "summer"];
export function normalizeTheme(v: unknown): ThemeId {
  return v === "summer" ? "summer" : "classic";
}

export type PublicSettings = {
  announcement: string | null;
  announcementActive: boolean;
  instagram: string | null;
  tiktok: string | null;
  snapchat: string | null;
  phone: string | null;
  address: string | null;
  theme: ThemeId;
};

/** Public-facing store settings (anon read). Returns nulls when unconfigured
 *  so callers fall back to their built-in defaults. */
export async function getPublicSettings(): Promise<PublicSettings> {
  const empty: PublicSettings = {
    announcement: null, announcementActive: false,
    instagram: null, tiktok: null, snapchat: null, phone: null, address: null,
    theme: "classic",
  };
  if (!supabaseConfigured) return empty;
  try {
    const { data } = await supabasePublic().from("settings").select("*").eq("id", 1).single();
    if (!data) return empty;
    return {
      announcement: data.announcement ?? null,
      announcementActive: Boolean(data.announcement_active),
      instagram: data.instagram ?? null,
      tiktok: data.tiktok ?? null,
      snapchat: data.snapchat ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      theme: normalizeTheme(data.theme),
    };
  } catch {
    return empty;
  }
}

// ── homepage curated sections ────────────────────────────────────────────────
export type HomeItemCard = Item & { categorySlug: string; categoryAr: string };
export type HomeSection = { kicker: string; title: string; desc: string; items: HomeItemCard[] };
export type HomeSections = { today: HomeSection; best: HomeSection };

const HOME_DEFAULTS = {
  today: {
    kicker: "01 — TODAY", title: "خيارات تريس اليوم",
    desc: "مختارات اليوم من المنيو — توقيعنا، حليبنا، وماتشانا. كل الأسعار بالريال السعودي.",
    slugs: ["hot-tres", "spanish-latte-iced", "matcha", "triple-chocolate"],
  },
  best: {
    kicker: "02 — BEST SELLERS", title: "الأكثر مبيعاً",
    desc: "الأصناف اللي ما تخيب — اختيارات ضيوفنا الأكثر طلبًا. كل الأسعار بالريال السعودي.",
    slugs: ["cappuccino", "spanish-latte-hot", "matcha-foam", "raffaello-tres"],
  },
} as const;

function staticHome(): HomeSections {
  const bySlug = (slug: string): HomeItemCard | null => {
    for (const c of CATEGORIES) {
      const it = c.items.find((i) => i.id === slug);
      if (it) return { ...it, categorySlug: c.id, categoryAr: c.ar };
    }
    return null;
  };
  const sec = (k: "today" | "best"): HomeSection => {
    const d = HOME_DEFAULTS[k];
    return { kicker: d.kicker, title: d.title, desc: d.desc, items: d.slugs.map(bySlug).filter((x): x is HomeItemCard => !!x) };
  };
  return { today: sec("today"), best: sec("best") };
}

/** Owner-curated homepage sections (text + product picks). Resolves stored item
 *  ids against the live, available menu; falls back to the static homepage. */
export async function getHome(): Promise<HomeSections> {
  const fallback = staticHome();
  if (!supabaseConfigured) return fallback;
  try {
    const sb = supabasePublic();
    const [{ data: s }, { data: cats }, { data: items }] = await Promise.all([
      sb.from("settings").select("home").eq("id", 1).single(),
      sb.from("categories").select("*").eq("is_active", true),
      sb.from("items").select("*").eq("is_available", true),
    ]);
    if (!cats || !items) return fallback;
    const catById = new Map((cats as DbCategory[]).map((c) => [c.id, c]));
    const itemById = new Map((items as DbItem[]).map((i) => [i.id, i]));
    const home = (s?.home ?? {}) as Record<string, { kicker?: string; title?: string; desc?: string; items?: string[] }>;

    const build = (k: "today" | "best"): HomeSection => {
      const cfg = home[k] ?? {};
      const def = fallback[k];
      const resolved: HomeItemCard[] = [];
      for (const id of Array.isArray(cfg.items) ? cfg.items : []) {
        const it = itemById.get(id);
        if (!it) continue;
        const cat = catById.get(it.category_id);
        if (!cat) continue;
        resolved.push({ ...mapItem(it), categorySlug: cat.slug, categoryAr: cat.name_ar });
      }
      return {
        kicker: cfg.kicker ?? def.kicker,
        title: cfg.title ?? def.title,
        desc: cfg.desc ?? def.desc,
        items: resolved.length ? resolved : def.items,
      };
    };
    return { today: build("today"), best: build("best") };
  } catch {
    return fallback;
  }
}

function staticMenu(): MenuResult {
  const ids = ["hot-tres", "spanish-latte-iced", "matcha", "triple-chocolate"];
  const featured: { item: Item; categorySlug: string }[] = [];
  for (const id of ids) {
    for (const c of CATEGORIES) {
      const item = c.items.find((i) => i.id === id);
      if (item) featured.push({ item, categorySlug: c.id });
    }
  }
  return { categories: CATEGORIES, featured, live: false };
}
