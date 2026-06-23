"use client";

/**
 * Single-document menu experience: a category landing (image tiles) and a
 * per-category product view, switched client-side so the swap can run through
 * the View Transition API — the tapped tile's image morphs into the category
 * hero banner, and the product grid cross-fades in.
 *
 * Both `/menu` and `/menu/[category]` render this component (with `initialId`),
 * so deep links and SEO still work; internal navigation updates the URL via the
 * History API (and listens for popstate) without a server round-trip.
 *
 * Progressive enhancement: where `document.startViewTransition` is missing or
 * the visitor prefers reduced motion, state simply updates instantly.
 */

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { toArabic, type Category, type Item } from "../lib/menu";

function pathForId(id: string | null): string {
  return id ? `/menu/${id}` : "/menu";
}

/**
 * Run a state update inside a View Transition. `flushSync` is essential: React
 * batches state updates, so without it the browser captures the "new" snapshot
 * before the DOM has actually changed and the shared-element morph is skipped.
 *
 * We do NOT skip the transition for reduced-motion here — instead the CSS
 * dials the animation down to a quick fade under `prefers-reduced-motion`
 * (the recommended pattern). When the API is unavailable, swap instantly.
 */
function withTransition(update: () => void) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => {
      ready?: Promise<unknown>;
      finished?: Promise<unknown>;
    };
  };
  if (typeof doc.startViewTransition !== "function") {
    update();
    return;
  }
  const t = doc.startViewTransition(() => flushSync(update));
  // A transition interrupted by another (or by navigation) rejects these
  // promises; swallow them so they don't surface as unhandled rejections.
  t?.ready?.catch(() => {});
  t?.finished?.catch(() => {});
}

function categoryImage(cat: Category): string | undefined {
  return cat.image ?? cat.items.find((i) => i.image)?.image;
}

function ProductCard({
  it,
  glyph,
  index,
  hasPhoto,
}: {
  it: Item;
  glyph: string;
  index: number;
  hasPhoto: boolean;
}) {
  const src = it.image ?? (hasPhoto && it.id ? `/assets/items/${it.id}.webp` : undefined);
  return (
    <div className="product-card" style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}>
      <div className={"product-img" + (src ? "" : " is-empty")}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={it.ar} loading="lazy" />
        ) : (
          <span className="placeholder-art">
            {it.emblem ? (
              <span className={"emblem emblem-" + (it.emblemFit ?? "cover")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.emblem} alt={it.en ?? it.ar} loading="lazy" />
              </span>
            ) : (
              <span className="placeholder-glyph" aria-hidden="true">
                {glyph}
              </span>
            )}
            {it.en && <span className="placeholder-word">{it.en}</span>}
          </span>
        )}
        {it.badge?.split(",").map((b, i) => <span key={i} className="product-badge">{b.trim()}</span>)}
      </div>
      <div className="product-body">
        <div className="product-head">
          <span className="product-name">{it.ar}</span>
          <span className="product-price">
            <span className="num">{it.price}</span>
            <span className="cur">ر.س</span>
          </span>
        </div>
        {it.en && (
          <span className="product-en" dir="ltr">
            {it.en}
          </span>
        )}
        {it.desc && <p className="product-desc">{it.desc}</p>}
        {it.cal && <span className="cal-pill product-cal">{it.cal} سعرة</span>}
      </div>
    </div>
  );
}

/** Shared inner content (name, notes, origin spec sheet, price) for a
 *  specialty card — used by both the flag-background origin cards and the
 *  branded TRES card. */
function SpecialtyContent({ it }: { it: Item }) {
  return (
    <div className="spec-content">
      <div className="spec-head">
        <h3 className="spec-name">{it.ar}</h3>
        {it.badge?.split(",").map((b, i) => <span key={i} className="spec-badge">{b.trim()}</span>)}
      </div>
      {it.en && (
        <span className="spec-en" dir="ltr">
          {it.en}
        </span>
      )}
      {it.notes && it.notes.length > 0 && (
        <p className="spec-notes">
          <span className="spec-notes-lbl">الإيحاءات: </span>
          {it.notes.join("، ")}
        </p>
      )}
      {(it.variety || it.altitude || it.process) && (
        <dl className="spec-specs">
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
      <span className="spec-price">
        <span className="num">{it.price}</span>
        <span className="cur">ر.س</span>
      </span>
    </div>
  );
}

/** Specialty-coffee card. Origins (Ethiopian/Colombian) show the country flag
 *  as a full-bleed background; محصول تريس gets a branded layout with the TRES
 *  mascot. */
function SpecialtyCard({ it, index }: { it: Item; index: number }) {
  const style = { animationDelay: `${Math.min(index, 12) * 60}ms` };

  if (it.id === "tres-roastery") {
    return (
      <article className="spec-card spec-card--tres" style={style}>
        <SpecialtyContent it={it} />
        <div className="spec-tres-figure" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="spec-tres-mark" src="/assets/logo/tres-mark-white.png" alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="spec-tres-mascot" src="/assets/mascot-sitting.png" alt="" />
        </div>
      </article>
    );
  }

  return (
    <article className="spec-card spec-card--origin" style={style}>
      {it.emblem && (
        <span
          className="spec-flag"
          style={{ backgroundImage: `url(${it.emblem})` }}
          aria-hidden="true"
        />
      )}
      <span className="spec-flag-scrim" aria-hidden="true" />
      <SpecialtyContent it={it} />
    </article>
  );
}

export default function MenuExperience({
  initialId,
  images = [],
  categories,
}: {
  initialId: string | null;
  /** Item ids that have a real photo in /public/assets/items (from the server). */
  images?: string[];
  categories: Category[];
}) {
  const getCategory = (id: string) => categories.find((c) => c.id === id);
  const photoSet = new Set(images);
  const [activeId, setActiveId] = useState<string | null>(
    initialId && getCategory(initialId) ? initialId : null,
  );

  // Apply a category change with a View Transition + History sync.
  const navigate = useCallback(
    (id: string | null, opts: { push?: boolean } = { push: true }) => {
      withTransition(() => {
        setActiveId(id);
        window.scrollTo({ top: 0 });
      });
      if (opts.push !== false && pathForId(id) !== window.location.pathname) {
        window.history.pushState({ catId: id }, "", pathForId(id));
      }
    },
    [],
  );

  // Browser back/forward → derive the category from the URL and animate to it.
  useEffect(() => {
    const onPop = () => {
      const match = window.location.pathname.match(/^\/menu\/([^/]+)/);
      const id = match && getCategory(match[1]) ? match[1] : null;
      navigate(id, { push: false });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [navigate]);

  const active = activeId ? getCategory(activeId) : null;

  // ----- category detail view -----
  if (active) {
    const heroImg = categoryImage(active);
    return (
      <div className="menu-page">
        <section className="cat-hero">
          <span
            className="cat-hero-media-wrap"
            style={{ viewTransitionName: `cat-media-${active.id}` }}
          >
            {heroImg ? (
              <span
                className="cat-hero-media"
                style={{
                  backgroundImage: `url(${heroImg})`,
                }}
              />
            ) : (
              <span className="cat-hero-media cat-hero-fill">
                {active.glyph}
              </span>
            )}
            <span className="cat-hero-scrim" />
          </span>
          <div className="cat-hero-inner">
            <button type="button" className="back-link" onClick={() => navigate(null)}>
              <span className="back-arrow">→</span> رجوع للأقسام
            </button>
            <div className="cat-hero-label">
              {active.no} — {active.en}
            </div>
            <h1 style={{ viewTransitionName: `cat-title-${active.id}` }}>{active.ar}</h1>
            <p>{active.tagline}</p>
          </div>
        </section>

        <section className="menu-body">
          <div className="wrap">
            <nav className="cat-strip" aria-label="الأقسام">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="cat-pill"
                  data-active={c.id === active.id}
                  onClick={() => c.id !== active.id && navigate(c.id)}
                >
                  {c.ar}
                </button>
              ))}
            </nav>

            {active.items.length > 0 ? (
              <>
                <div className={"product-grid" + (active.id === "specialty" ? " spec-grid" : "")}>
                  {active.items.map((it, i) =>
                    active.id === "specialty" ? (
                      <SpecialtyCard key={i} it={it} index={i} />
                    ) : (
                      <ProductCard
                        key={i}
                        it={it}
                        glyph={active.glyph}
                        index={i}
                        hasPhoto={!!it.id && photoSet.has(it.id)}
                      />
                    ),
                  )}
                </div>
                {active.note && <p className="menu-note">{active.note}</p>}
              </>
            ) : (
              <div className="cat-empty-card">
                <div className="glyph">{active.glyph}</div>
                <h3>قريبًا</h3>
                <p>هذا القسم للحين ما نزل. ارجع لنا قريب.</p>
                <button type="button" className="btn btn-menu" onClick={() => navigate(null)}>
                  شوف باقي الأقسام <span className="arrow">←</span>
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // ----- landing: category tiles -----
  return (
    <div className="menu-page">
      <section className="menu-hero">
        <div className="menu-hero-inner">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            قهوه مختصه . تجربه مختلفه
          </div>
          <h1>المنيو</h1>
          <p>وش ودك اليوم؟ اختر القسم، وكل الأسعار بالريال السعودي.</p>
        </div>
      </section>

      <section className="menu-body">
        <div className="wrap">
          <div className="menu-tiles">
            {categories.map((c) => {
              const empty = c.items.length === 0;
              const img = categoryImage(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(c.id)}
                  className={"tile" + (img ? " has-img" : "") + (empty ? " soon" : "")}
                >
                  <span 
                    className="tile-media-wrap"
                    style={{ viewTransitionName: `cat-media-${c.id}` }}
                  >
                    {img ? (
                      <>
                        <span
                          className="tile-img"
                          style={{
                            backgroundImage: `url(${img})`,
                          }}
                        />
                        <span className="tile-scrim" />
                      </>
                    ) : (
                      <span className="tile-fill" />
                    )}
                  </span>
                  <span className="tile-no">{c.no}</span>
                  {!img && <span className="glyph">{c.glyph}</span>}
                  <div className="tile-foot">
                    <h3 style={{ viewTransitionName: `cat-title-${c.id}` }}>{c.ar}</h3>
                    <p className="tagline">{c.tagline}</p>
                    <div className="tile-meta">
                      <span>{empty ? "قريبًا" : `${toArabic(c.items.length)} صنف`}</span>
                      <span className="tile-arrow">←</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
