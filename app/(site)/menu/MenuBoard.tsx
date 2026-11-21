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
 * The rail is one continuous list of every category, each under its own
 * heading; scrolling it moves the active tab from category to category (the
 * owner's note), and a tab click scrolls the list to that section.
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
  // The picked row, as "<category>/<item>". The stage shows it while its
  // category is the active one, and the category's first item otherwise — so
  // scrolling into a new section brings that section's lead product on stage.
  const [picked, setPicked] = useState<string | null>(null);
  // Mobile only: the stage is a sheet, and it opens on tap. CSS ignores this
  // flag from the two-pane breakpoint up.
  const [sheetOpen, setSheetOpen] = useState(false);

  const cat = categories.find((c) => c.id === catId) ?? categories[0];
  const items = cat?.items ?? [];
  const rowKey = (c: Category, it: Item) => `${c.id}/${it.id ?? it.ar}`;
  const current = (cat && items.find((i) => rowKey(cat, i) === picked)) ?? items[0];

  const railRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  // While a tab click scrolls to its section, the scroll spy stands down so the
  // tabs in between don't flicker on the way.
  const jumping = useRef<number | null>(null);

  const isDesktop = () => window.matchMedia("(min-width: 901px)").matches;

  /** The line a section has to cross to become the active one. */
  const spyLine = useCallback(() => {
    if (isDesktop()) return (railRef.current?.getBoundingClientRect().top ?? 0) + 24;
    return (tabsRef.current?.getBoundingClientRect().bottom ?? 0) + 24;
  }, []);

  /** Scroll the list (the rail on desktop, the page on a phone) to a section. */
  const scrollToSection = useCallback(
    (id: string, behavior: ScrollBehavior = "smooth") => {
      const sec = sectionRefs.current.get(id);
      const rail = railRef.current;
      if (!sec || !rail) return;
      if (jumping.current) window.clearTimeout(jumping.current);
      jumping.current = window.setTimeout(() => (jumping.current = null), 800);
      if (isDesktop()) {
        const top = sec.getBoundingClientRect().top - rail.getBoundingClientRect().top + rail.scrollTop;
        rail.scrollTo({ top: top - 4, behavior });
      } else {
        const offset = (tabsRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
        window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - offset, behavior });
      }
    },
    [],
  );

  const goto = useCallback(
    (id: string, opts: { push?: boolean; scroll?: boolean } = {}) => {
      setCatId(id);
      setSheetOpen(false);
      if (opts.scroll !== false) scrollToSection(id);
      if (opts.push !== false && pathForId(id) !== window.location.pathname) {
        window.history.pushState({ catId: id }, "", pathForId(id));
      }
    },
    [scrollToSection],
  );

  // A deep link (/menu/<category>) opens with the list already at that section.
  useEffect(() => {
    const id = known(initialId);
    if (id && id !== firstId) scrollToSection(id, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Scroll spy: scrolling the product list moves the active tab from one
  // category to the next. The URL follows with replaceState, so a scroll
  // doesn't pile up history entries.
  useEffect(() => {
    let raf = 0;
    const spy = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (jumping.current) return;
        const rail = railRef.current;
        if (!rail) return;
        const line = spyLine();
        let active = categories[0]?.id;
        for (const c of categories) {
          const sec = sectionRefs.current.get(c.id);
          if (sec && sec.getBoundingClientRect().top <= line) active = c.id;
        }
        // At the very end of the list the last section may be too short to
        // reach the line — the bottom of the list still means the last tab.
        const atEnd = isDesktop()
          ? rail.scrollTop + rail.clientHeight >= rail.scrollHeight - 2
          : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
        const scrolled = isDesktop() ? rail.scrollTop > 0 : window.scrollY > 0;
        if (atEnd && scrolled) active = categories[categories.length - 1]?.id;
        if (!active) return;
        setCatId((prev) => {
          if (prev !== active && pathForId(active) !== window.location.pathname) {
            window.history.replaceState({ catId: active }, "", pathForId(active));
          }
          return active;
        });
      });
    };
    const rail = railRef.current;
    rail?.addEventListener("scroll", spy, { passive: true });
    window.addEventListener("scroll", spy, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      rail?.removeEventListener("scroll", spy);
      window.removeEventListener("scroll", spy);
    };
  }, [categories, spyLine]);

  // Keep the active tab visible in the tab strip.
  useEffect(() => {
    const tab = tabsRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    const strip = tabsRef.current;
    if (!tab || !strip) return;
    const left = tab.offsetLeft - strip.clientWidth / 2 + tab.offsetWidth / 2;
    strip.scrollTo({ left, behavior: "smooth" });
  }, [catId]);

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

      <nav className="mx-tabs" aria-label="أقسام المنيو" ref={tabsRef}>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className="mx-tab"
            data-active={c.id === cat.id}
            onClick={() => goto(c.id)}
          >
            {c.ar}
          </button>
        ))}
      </nav>

      <div className="mx-body">
        {/* One continuous list of every category; scrolling it walks the tabs. */}
        <aside className="mx-rail" aria-label="أصناف المنيو" ref={railRef}>
          {categories.map((c) => (
            <section
              key={c.id}
              className="mx-rail-sec"
              aria-label={c.ar}
              ref={(el) => {
                if (el) sectionRefs.current.set(c.id, el);
                else sectionRefs.current.delete(c.id);
              }}
            >
              <h2 className="mx-rail-head">{c.ar}</h2>
              {c.items.length === 0 ? (
                <p className="mx-rail-empty">لا توجد أصناف في هذا القسم حالياً.</p>
              ) : (
                c.items.map((it, i) => (
                  <RailRow
                    key={rowKey(c, it) + i}
                    it={it}
                    photo={itemPhoto(it, photoSet)}
                    glyph={c.glyph}
                    active={c.id === cat.id && current === it}
                    onPick={() => {
                      setPicked(rowKey(c, it));
                      setSheetOpen(true);
                      if (c.id !== cat.id) {
                        setCatId(c.id);
                        window.history.replaceState({ catId: c.id }, "", pathForId(c.id));
                      }
                    }}
                  />
                ))
              )}
            </section>
          ))}
        </aside>

        <section className="mx-stage" data-open={sheetOpen || undefined}>
          {current ? (
            <Stage
              it={current}
              photo={itemPhoto(current, photoSet)}
              glyph={cat.glyph}
              note={cat.note}
              onClose={() => setSheetOpen(false)}
            />
          ) : (
            <div className="mx-empty">لا توجد أصناف في هذا القسم حالياً.</div>
          )}
        </section>
      </div>
    </div>
  );
}
