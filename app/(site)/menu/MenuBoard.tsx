"use client";

/**
 * THE MENU BOARD — the winter skin's menu, rebuilt to the owner's reference
 * video. The other skins keep the original experience (MenuClassic); the two
 * are picked between in app/menu/page.tsx.
 *
 * Layout:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ brand · note                                 │
 *   │ [ تابs ] [ … ]                                │
 *   ├───────────────── stage ──────────┬── rail ───┤
 *   │  big product shot                │ ▢ item    │
 *   │  price · name · cal · desc       │ ▢ item    │
 *   └──────────────────────────────────┴───────────┘
 *
 * The rail sits at the inline start (the right, in RTL) — the owner asked for
 * it there — and the stage holds one product at a time. On desktop the page
 * scrolls through the category: each scroll step advances the stage to the
 * next item in the rail, and picking a row scrolls to that item's step.
 *
 * Every category, specialty origins included, uses this same rail + stage —
 * the owner wants one design across the menu. Origin specs (variety, altitude,
 * process, notes) show on the stage.
 *
 * On a phone there is no room for two panes: the rail becomes the page and the
 * stage opens over it as a sheet.
 *
 * `/menu` and `/menu/[category]` both render this (with `initialId`), so deep
 * links and SEO keep working; switching categories updates the URL through the
 * History API without a server round-trip.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toArabic, type Category, type Item } from "../../lib/menu";
import "./menu-experience.css";

function pathForId(id: string | null): string {
  return id ? `/menu/${id}` : "/menu";
}

/** Where the rail and stage pin (matches `top` on both in the CSS). */
const STICKY_TOP = 90;
/** One scroll step per item — matches the 40vh in .mx-body's min-height. */
function scrollStep(): number {
  return window.innerHeight * 0.4;
}

function itemPhoto(it: Item, photoSet: Set<string>): string | undefined {
  if (it.image) return it.image;
  if (it.imageCleared) return undefined;
  return it.id && photoSet.has(it.id) ? `/assets/items/${it.id}.webp` : undefined;
}

function badges(it: Item): string[] {
  return it.badge ? it.badge.split(",").map((b) => b.trim()).filter(Boolean) : [];
}

/** The reference keeps its scalloped rosette for one thing: the best seller.
 *  Ordinary badges ("حار / بارد") are chips — a rosette on every card turns the
 *  board into a sticker sheet. */
function rosetteOf(it: Item): string | undefined {
  return badges(it).find((b) => /مبيع|الأكثر|مميز|best|seller|new|جديد/i.test(b));
}

/* ── rail row ─────────────────────────────────────────────────────────────── */
function RailRow({
  it,
  photo,
  glyph,
  active,
  onPick,
}: {
  it: Item;
  photo?: string;
  glyph: string;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className="mx-row"
      data-active={active}
      data-sold-out={it.soldOut || undefined}
      onClick={onPick}
    >
      <span className="mx-row-media">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" loading="lazy" />
        ) : it.emblem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="mx-row-emblem" src={it.emblem} alt="" loading="lazy" />
        ) : (
          <span aria-hidden="true">{glyph || "☕"}</span>
        )}
      </span>
      <span className="mx-row-text">
        <span className="mx-row-ar">{it.ar}</span>
        {it.en && (
          <span className="mx-row-en" dir="ltr">
            {it.en}
          </span>
        )}
        {it.soldOut && <span className="mx-row-out">نفدت الكمية</span>}
      </span>
      {it.price && (
        <span className="mx-row-price">
          <span className="num">{it.price}</span>
          <span className="cur">ر.س</span>
        </span>
      )}
    </button>
  );
}

/* ── the stage: one product, large ────────────────────────────────────────── */
function Stage({
  it,
  photo,
  glyph,
  note,
  onClose,
}: {
  it: Item;
  photo?: string;
  glyph: string;
  note?: string;
  onClose: () => void;
}) {
  const tags = badges(it);
  const rosette = rosetteOf(it);
  return (
    <div className="mx-stage-inner" key={it.id ?? it.ar}>
      <button type="button" className="mx-stage-close" onClick={onClose} aria-label="إغلاق">
        ✕
      </button>

      <div className="mx-stage-media">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={it.ar} />
        ) : it.emblem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={"mx-stage-emblem mx-fit-" + (it.emblemFit ?? "cover")} src={it.emblem} alt={it.ar} />
        ) : (
          <span className="mx-stage-glyph" aria-hidden="true">
            {glyph || "☕"}
          </span>
        )}
        {rosette && <span className="mx-rosette">{rosette}</span>}
        {it.soldOut && <span className="mx-stage-out">نفدت الكمية</span>}
      </div>

      <div className="mx-stage-body">
        {it.price && (
          <div className="mx-stage-price">
            <span className="num">{it.price}</span>
            <span className="cur">ر.س</span>
          </div>
        )}
        <div className="mx-stage-names">
          <h2>{it.ar}</h2>
          {it.en && (
            <span className="mx-stage-en" dir="ltr">
              {it.en}
            </span>
          )}
          {it.cal && <span className="mx-chip">{it.cal} سعرة</span>}
          {tags
            .filter((t) => t !== rosette)
            .map((t) => (
              <span key={t} className="mx-chip mx-chip--badge">
                {t}
              </span>
            ))}
        </div>
        {it.desc && <p className="mx-stage-desc">{it.desc}</p>}

        {it.notes && it.notes.length > 0 && (
          <p className="mx-stage-notes">
            <span>الإيحاءات</span>
            {it.notes.join(" · ")}
          </p>
        )}
        {(it.variety || it.altitude || it.process) && (
          <dl className="mx-specs">
            {it.variety && (
              <div>
                <dt>السلالة</dt>
                <dd>{it.variety}</dd>
              </div>
            )}
            {it.altitude && (
              <div>
                <dt>الارتفاع</dt>
                <dd>{it.altitude}</dd>
              </div>
            )}
            {it.process && (
              <div>
                <dt>المعالجة</dt>
                <dd>{it.process}</dd>
              </div>
            )}
          </dl>
        )}
        {note && <p className="mx-stage-note">{note}</p>}
      </div>
    </div>
  );
}

export default function MenuBoard({
  initialId,
  images = [],
  categories,
}: {
  initialId: string | null;
  /** Item ids that have a real photo in /public/assets/items (from the server). */
  images?: string[];
  categories: Category[];
}) {
  const photoSet = useMemo(() => new Set(images), [images]);
  const firstId = categories[0]?.id ?? null;
  const known = (id: string | null) => (id && categories.some((c) => c.id === id) ? id : null);

  const [catId, setCatId] = useState<string | null>(known(initialId) ?? firstId);
  const [pickedItem, setPickedItem] = useState<string | null>(null);
  // Mobile only: the stage is a sheet, and it opens on tap. CSS ignores this
  // flag from the two-pane breakpoint up.
  const [sheetOpen, setSheetOpen] = useState(false);

  const cat = categories.find((c) => c.id === catId) ?? categories[0];
  const items = cat?.items ?? [];
  const current = items.find((i) => (i.id ?? i.ar) === pickedItem) ?? items[0];
  const currentIdx = current ? items.indexOf(current) : -1;

  const bodyRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);

  const goto = useCallback(
    (id: string, opts: { push?: boolean } = {}) => {
      setCatId(id);
      setPickedItem(null);
      setSheetOpen(false);
      const body = bodyRef.current;
      if (body && window.scrollY > body.offsetTop) {
        window.scrollTo({ top: 0 });
      }
      if (opts.push !== false && pathForId(id) !== window.location.pathname) {
        window.history.pushState({ catId: id }, "", pathForId(id));
      }
    },
    [],
  );

  // Browser back/forward → follow the URL.
  useEffect(() => {
    const onPop = () => {
      const match = window.location.pathname.match(/^\/menu\/([^/]+)/);
      goto(known(match?.[1] ?? null) ?? firstId ?? "", { push: false });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goto, firstId]);

  // Escape closes the mobile sheet. While it is open the body carries a flag,
  // which parks the floating loyalty mascot — on a phone it sits exactly where
  // the sheet's product shot lands.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.dataset.mxSheet = "1";
    return () => {
      window.removeEventListener("keydown", onKey);
      delete document.body.dataset.mxSheet;
    };
  }, [sheetOpen]);

  // Desktop: scrolling the page walks the rail. The body is made tall enough to
  // hold one scroll step per item (CSS, via --mx-steps) while the rail and the
  // stage stay pinned, and the scroll position picks the item on stage.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 901px)");
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const body = bodyRef.current;
        if (!desktop.matches || !body || items.length < 2) return;
        const step = scrollStep();
        const start = body.getBoundingClientRect().top + window.scrollY - STICKY_TOP;
        const idx = Math.min(items.length - 1, Math.max(0, Math.round((window.scrollY - start) / step)));
        const it = items[idx];
        setPickedItem(it.id ?? it.ar);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [items]);

  // Keep the active row in view inside the rail — scroll the rail only, never
  // the page (scrollIntoView would fight the scroll that drives it).
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || currentIdx < 0) return;
    const row = rail.children[currentIdx] as HTMLElement | undefined;
    if (!row || rail.scrollHeight <= rail.clientHeight) return;
    const target = row.offsetTop - rail.clientHeight / 2 + row.offsetHeight / 2;
    rail.scrollTo({ top: target, behavior: "smooth" });
  }, [currentIdx]);

  const pick = (idx: number) => {
    const it = items[idx];
    const body = bodyRef.current;
    if (window.matchMedia("(min-width: 901px)").matches && body && items.length > 1) {
      const start = body.getBoundingClientRect().top + window.scrollY - STICKY_TOP;
      window.scrollTo({ top: start + idx * scrollStep(), behavior: "smooth" });
      setPickedItem(it.id ?? it.ar);
      return;
    }
    setPickedItem(it.id ?? it.ar);
    setSheetOpen(true);
  };

  if (!cat) {
    return (
      <div className="mx">
        <div className="mx-empty">المنيو قيد التحديث — ارجع لنا بعد قليل.</div>
      </div>
    );
  }

  return (
    <div className="mx">
      {/* No wordmark here: the nav already carries it, and two TRES marks
          stacked on one screen read as a mistake. */}
      <header className="mx-top">
        <h1 className="mx-title">{cat.ar}</h1>
        <p className="mx-top-note">كل الأسعار بالريال السعودي · {toArabic(items.length)} صنف</p>
      </header>

      <nav className="mx-tabs" aria-label="أقسام المنيو">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className="mx-tab"
            data-active={c.id === cat.id}
            onClick={() => c.id !== cat.id && goto(c.id)}
          >
            {c.ar}
          </button>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="mx-empty">لا توجد أصناف في هذا القسم حالياً.</div>
      ) : (
        <div
          className="mx-body"
          ref={bodyRef}
          style={{ "--mx-steps": items.length } as React.CSSProperties}
        >
          <aside className="mx-rail" aria-label={cat.ar} ref={railRef}>
            {items.map((it, i) => (
              <RailRow
                key={(it.id ?? it.ar) + i}
                it={it}
                photo={itemPhoto(it, photoSet)}
                glyph={cat.glyph}
                active={current === it}
                onPick={() => pick(i)}
              />
            ))}
          </aside>

          <section className="mx-stage" data-open={sheetOpen || undefined}>
            {current && (
              <Stage
                it={current}
                photo={itemPhoto(current, photoSet)}
                glyph={cat.glyph}
                note={cat.note}
                onClose={() => setSheetOpen(false)}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
