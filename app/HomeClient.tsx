"use client";

import { useRef, useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { createPortal } from "react-dom";
import { useReveal } from "./lib/useReveal";
import { toArabic, type Category, type Item } from "./lib/menu";
import Link from "next/link";

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

const RING_TEXT =
  "THREE ORIGINS ✦ ONE STORY ✦ SPECIALTY COFFEE ✦ ROASTED IN TAIF ✦ EST. 2019 ✦ ";

type HomeCard = Item & { categorySlug: string; categoryAr: string };
type HomeSec = { kicker: string; title: string; desc: string; items: HomeCard[] };

// A curated homepage row (today's picks / best sellers). Owner-editable text +
// product list come straight from the control panel.
function CuratedSection({ section, extraClass = "" }: { section: HomeSec; extraClass?: string }) {
  if (section.items.length === 0) return null;
  return (
    <div className={"section today" + (extraClass ? " " + extraClass : "")}>
      <div className="wrap">
        <div className="today-head">
          <div data-reveal>
            <div className="section-kicker">{section.kicker}</div>
            <h2>{section.title}</h2>
          </div>
          {section.desc && (
            <p data-reveal data-reveal-delay="80">{section.desc}</p>
          )}
        </div>

        <div className="today-grid">
          {section.items.map((item, i) => (
            <Link
              key={item.id + ":" + i}
              href={`/menu/${item.categorySlug}`}
              className="today-card"
              data-reveal
              data-reveal-delay={i * 100}
            >
              <span className="today-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image ?? `/assets/items/${item.id}.webp`} alt={item.ar} loading="lazy" />
                {item.badge && <span className="today-badge">{item.badge}</span>}
              </span>
              <span className="today-body">
                <span className="today-tag">{item.categoryAr}</span>
                <span className="today-name">{item.ar}</span>
                {item.en && (
                  <span className="today-en" dir="ltr">{item.en}</span>
                )}
                <span className="today-price">
                  <span className="num">{item.price}</span>
                  <span className="cur">ر.س</span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Ring() {
  const chars = Array.from(RING_TEXT);
  const step = 360 / chars.length;
  return (
    <div className="ring" aria-hidden="true">
      {chars.map((ch, i) => (
        <span
          key={i}
          className="ring-letter"
          style={{ transform: `translateX(-50%) rotate(${i * step}deg)` }}
        >
          <span style={{ opacity: ch === "✦" ? 0.6 : 0.92 }}>
            {ch === " " ? " " : ch}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function HomeClient({
  categories,
  today,
  best,
}: {
  categories: Category[];
  today: HomeSec;
  best: HomeSec;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const syncStoryHash = () => {
      const shouldOpenStory = window.location.hash === "#story";
      withTransition(() => {
        setIsStoryOpen(shouldOpenStory);
      });
    };

    const onPopState = syncStoryHash;
    const onHashChange = syncStoryHash;

    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);
    syncStoryHash();

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const openStory = () => {
    window.history.pushState({ story: true }, "", "#story");
    withTransition(() => {
      setIsStoryOpen(true);
    });
  };

  const closeStory = () => {
    if (window.history.state?.story) {
      window.history.back();
    } else {
      withTransition(() => {
        setIsStoryOpen(false);
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  return (
    <div ref={rootRef} className="page">
      {/* ===================== HERO ===================== */}
      <div className="hero">
        <div className="hero-noise" />
        <div className="hero-inner">
          <div className="eyebrow" data-reveal data-reveal-delay="0">
            <span className="eyebrow-dot" />
            قهوه مختصه . تجربه مختلفه
          </div>

          {/* circular composition: logo + mascot + spinning ring */}
          <div className="composition" data-parallax="9">
            <Ring />
            <div className="ring-dashed" />
            <div className="ring-glow" />
            <div className="composition-center">
              <div className="composition-lockup">
                <span className="ar">تريس</span>
                <span className="en">TRES</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="mascot"
                src="/assets/mascot-standing.png"
                alt="شخصية تريس"
              />
            </div>
          </div>

          <h1 data-reveal data-reveal-delay="60">
            وقفة تستاهل <span className="accent">كوب تريس.</span>
          </h1>
          <p className="hero-lede" data-reveal data-reveal-delay="120">
            نحمّص بدفعات صغيرة في الطائف، ونقدّم ثلاثة محاصيل: الإثيوبي،
            الكولومبي، ومزيج تريس. قهوة واضحة، موزونة، وقريبة من مزاجك.
          </p>
          <div className="hero-actions" data-reveal data-reveal-delay="180">
            <Link href="/menu" className="btn btn-hero-primary">
              تصفّح المنيو
            </Link>
          </div>
          <div className="hero-meta" data-reveal data-reveal-delay="240">
            <span>منذ 2026</span>
            <span className="sep" />
            <span>الطائف ·</span>
            <span className="sep" />
            <span> مدينة الورد</span>
          </div>
        </div>
      </div>

      {/* ===================== TODAY'S PICKS ===================== */}
      <CuratedSection section={today} />

      {/* ===================== BEST SELLERS ===================== */}
      <CuratedSection section={best} extraClass="bestsellers" />

      {/* ===================== MENU ===================== */}
      <div className="section menu">
        <div className="wrap">
          <div className="menu-grid">
            {/* featured signature */}
            <div className="menu-feature" data-reveal>
              <div className="menu-kicker">02 — MENU</div>
              <h2>من المنيو</h2>
              <p>
                منيو مختصر وواضح: قهوة مختصة، مشاريب الحليب، ماتشا، وحلا. إذا ودك بشي يحمل توقيعنا،
                ابدأ بهوت تريس.
              </p>
              <div className="signature">
                <div className="signature-blob" />
                <div className="signature-body">
                  <div className="signature-label">الاكثر مبيعا</div>
                  <div className="signature-row">
                    <span className="signature-name">محصول تريس</span>
                    <span>
                      <span className="signature-price">19</span>{" "}
                      <span className="signature-cur">ر.س</span>
                    </span>
                  </div>
                  <p className="signature-desc">
                   المشروب المميز من تريس
                  </p>
                </div>
              </div>
              <a href="/menu" className="btn btn-menu">
                المنيو الكامل <span className="arrow">←</span>
              </a>
            </div>

            {/* list */}
            <div data-reveal data-reveal-delay="100">
              <div className="menu-tiles" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                {categories.map((c) => {
                  const empty = c.items.length === 0;
                  const img = c.image ?? c.items.find((i) => i.image)?.image;
                  return (
                    <Link
                      key={c.id}
                      href={`/menu/${c.id}`}
                      className={"tile" + (img ? " has-img" : "") + (empty ? " soon" : "")}
                    >
                      <span className="tile-media-wrap">
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
                        <h3>{c.ar}</h3>
                        <p className="tagline">{c.tagline}</p>
                        <div className="tile-meta">
                          <span>{empty ? "قريبًا" : `${toArabic(c.items.length)} صنف`}</span>
                          <span className="tile-arrow">←</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== STORY ===================== */}
      <div id="story" className="section story">
        <div className="story-grid">
          <div data-reveal>
            <div className="section-kicker">03 — STORY</div>
            <h2>
              في قلب
              <br />
              الطائف.
            </h2>
            <p className="lead">
              حيث يلتقي عبق الورد بنسيم الجبال، بدأت فكرة تريس. الرقم 3 ليس مجرد
              رقم، بل هو سرّ التجربة التي نؤمن بها.
            </p>
            <p className="sub">
              ثلاثة عناصر تصنع اللحظة المثالية: قهوة تُحضّر بإتقان، حلى يكمّل
              المتعة، وأجواء تدعوك للبقاء.
            </p>
            <button type="button" className="btn-story" onClick={openStory}>اعرف قصتنا</button>
          </div>
          <div data-reveal data-reveal-delay="120" data-parallax="12">
            <div className="story-art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/story-cup.svg"
                alt="فنجان تريس"
                style={!isStoryOpen ? { viewTransitionName: "story-art-img" } : undefined}
              />
              <div className="story-caption">
                ثلاثة عناصر تصنع اللحظة · قهوة، أجواء، وذكرى
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== STORY EXPANDED OVERLAY ===================== */}
      {mounted && isStoryOpen && createPortal(
        <div className="story-expanded-overlay">
          <button type="button" className="back-link story-back" onClick={closeStory}>
            <span className="back-arrow">→</span> عودة
          </button>

          <div className="story-expanded-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
               src="/assets/story-cup.svg"
               alt="فنجان تريس"
               className="story-expanded-img"
            />
          </div>

          <div className="story-expanded-content wrap narrow">
             <h2>
               في قلب<br />
               الطائف.
             </h2>
             <p>
               في قلب الطائف… حيث يلتقي عبق الورد بنسيم الجبال، بدأت فكرة تريس.
               الرقم 3 ليس مجرد رقم، بل هو سرّ التجربة التي نؤمن بها.
             </p>
             <ul className="story-elements">
               <li>قهوة تُحضّر بإتقان</li>
               <li>حلى يكمّل المتعة</li>
               <li>أجواء تدعوك للبقاء</li>
             </ul>
             <p>
               ومن هنا جاء اسم تريس TRES … لأننا نترك أثرًا جميلًا في كل زيارة،
               ونؤمن أن أفضل الذكريات تبدأ بثلاثة أشياء بسيطة: كوب رائع، مكان
               مريح، وشخص تحب أن تشاركه اللحظة.
             </p>
             <p className="story-signature">
               تريس | حيث تلتقي القهوة والأجواء والذكريات.
             </p>
             <p>
               من الطائف… نصنع أثرًا يبقى ❤️
             </p>
          </div>
        </div>,
        document.body
      )}

      {/* ===================== CTA BAND ===================== */}
      <div className="cta">
        <div className="cta-inner" data-reveal>
          <div>
            <h2>عندك ملاحظة؟</h2>
            <p>رأيك يهمنا. إذا واجهتك أي مشكلة أو عندك شكوى، عبّر لنا عنها ونوعدك نتابعها.</p>
          </div>
          <div className="cta-actions">
            <Link href="/complaints" className="btn btn-cta-primary">قدّم شكوى</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
