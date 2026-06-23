import HomeEditor, { type PickItem, type SectionCfg } from "../../_components/HomeEditor";
import { adminMenu } from "../../../lib/admin-data";
import { supabaseAdmin } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

const DEFAULTS: Record<"today" | "best", SectionCfg> = {
  today: { kicker: "01 — TODAY", title: "خيارات تريس اليوم", desc: "مختارات اليوم من المنيو.", itemIds: [] },
  best: { kicker: "02 — BEST SELLERS", title: "الأكثر مبيعاً", desc: "اختيارات ضيوفنا الأكثر طلبًا.", itemIds: [] },
};

function toCfg(raw: unknown, def: SectionCfg): SectionCfg {
  const c = (raw ?? {}) as Partial<SectionCfg> & { items?: string[] };
  return {
    kicker: c.kicker ?? def.kicker,
    title: c.title ?? def.title,
    desc: c.desc ?? def.desc,
    itemIds: Array.isArray(c.items) ? c.items : [],
  };
}

export default async function HomeSectionsPage() {
  let all: PickItem[] = [];
  let today = DEFAULTS.today;
  let best = DEFAULTS.best;
  let dbError = false;
  try {
    const sb = supabaseAdmin();
    const [{ data: s }, menu] = await Promise.all([
      sb.from("settings").select("home").eq("id", 1).single(),
      adminMenu(),
    ]);
    all = menu.flatMap((g) =>
      g.items.map((it) => ({
        id: it.id, name_ar: it.name_ar, name_en: it.name_en, price: it.price,
        image_url: it.image_url, emblem_url: it.emblem_url, category_ar: g.category.name_ar,
      })),
    );
    const home = (s?.home ?? {}) as Record<string, unknown>;
    today = toCfg(home.today, DEFAULTS.today);
    best = toCfg(home.best, DEFAULTS.best);
  } catch {
    dbError = true;
  }

  return (
    <>
      <div className="admin-page-head">
        <h1>الواجهة</h1>
        <p>تحكّم في القسمين المميّزين على الصفحة الرئيسية — النصوص والمنتجات المعروضة.</p>
      </div>
      {dbError ? (
        <div className="a-card a-card--pad" style={{ background: "var(--amber-soft)", color: "var(--amber)", borderColor: "var(--amber)" }}>
          لم يتم الاتصال بقاعدة البيانات بعد.
        </div>
      ) : (
        <HomeEditor today={today} best={best} all={all} />
      )}
    </>
  );
}
