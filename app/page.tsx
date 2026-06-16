"use client";

import { useRef } from "react";
import { useReveal } from "./lib/useReveal";
import { CATEGORIES, getCategory, toArabic } from "./lib/menu";
import Link from "next/link";

const RING_TEXT =
  "THREE ORIGINS ✦ ONE STORY ✦ SPECIALTY COFFEE ✦ ROASTED IN TAIF ✦ EST. 2019 ✦ ";

// Homepage "origins" cards are the official tasting-note cards (الإيحاءات),
// pulled from the menu data so they stay in sync. Ordered + titled for display.
const ORIGIN_IDS = ["ethiopian", "colombian", "tres-roastery"] as const;
const ORIGIN_TITLES: Record<string, string> = {
  ethiopian: "الإثيوبي",
  colombian: "الكولومبي",
  "tres-roastery": "مزيج تريس",
};
const ORIGINS = ORIGIN_IDS.map((id) => getCategory("specialty")?.items.find((i) => i.id === id)).filter(
  (i): i is NonNullable<typeof i> => Boolean(i),
);

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

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  return (
    <div ref={rootRef} className="page">
      {/* ===================== HERO ===================== */}
      <div className="hero">
        <div className="hero-noise" />
        <div className="hero-inner">
          <div className="eyebrow" data-reveal data-reveal-delay="0">
            <span className="eyebrow-dot" />
            قهوة مختصة · ثلاثة أصول
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
            ذوقٌ يستحقّ <span className="accent">التوقّف.</span>
          </h1>
          <p className="hero-lede" data-reveal data-reveal-delay="120">
            قهوة مختصة، مُحمَّصة بدفعاتٍ صغيرة في الطائف. ثلاثة أصول مختارة بعناية
            — الإثيوبي، الكولومبي، ومزيج تريس — تجتمع في فنجانٍ واحد.
          </p>
          <div className="hero-actions" data-reveal data-reveal-delay="180">
            <Link href="/menu" className="btn btn-hero-primary">
              تصفّح المنيو
            </Link>
          </div>
          <div className="hero-meta" data-reveal data-reveal-delay="240">
            <span>منذ 2019</span>
            <span className="sep" />
            <span>الطائف · مدينة الورد</span>
            <span className="sep" />
            <span>تحميص يومي</span>
          </div>
        </div>
      </div>

      {/* ===================== ORIGINS ===================== */}
      <div className="section origins">
        <div className="wrap">
          <div className="origins-head">
            <div data-reveal>
              <div className="section-kicker">01 — ORIGINS</div>
              <h2>من أين تأتي قهوتنا</h2>
            </div>
            <p data-reveal data-reveal-delay="80">
              نختار حبوبنا من مزارع مرتفعة حول العالم, ونحمّصها على دفعاتٍ صغيرة
              لإبراز إيحاءاتها. لكل أصلٍ شخصيّته — وهذه ثلاثتنا.
            </p>
          </div>

          <div className="origins-grid">
            {ORIGINS.map((o, i) => (
              <div
                key={o.id}
                className="origin-card no-shadow"
                data-reveal
                data-reveal-delay={i * 100}
              >
                <div className="origin-num">{`0${i + 1}`}</div>
                <div className="origin-body">
                  {o.emblem && (
                    <span className={`origin-emblem origin-emblem-${o.emblemFit ?? "cover"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.emblem} alt={o.en ?? o.ar} />
                    </span>
                  )}
                  <h3>{ORIGIN_TITLES[o.id ?? ""] ?? o.ar}</h3>
                  {o.notes && o.notes.length > 0 && (
                    <p className="origin-notes">
                      <span className="origin-notes-lbl">الإيحاءات: </span>
                      {o.notes.join("، ")}
                    </p>
                  )}
                  {(o.variety || o.altitude || o.process) && (
                    <dl className="origin-specs">
                      {o.variety && (
                        <div>
                          <dt>السلالة</dt>
                          <dd>{o.variety}</dd>
                        </div>
                      )}
                      {o.altitude && (
                        <div>
                          <dt>الارتفاع</dt>
                          <dd>{o.altitude}</dd>
                        </div>
                      )}
                      {o.process && (
                        <div>
                          <dt>المعالجة</dt>
                          <dd>{o.process}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===================== MENU ===================== */}
      <div className="section menu">
        <div className="wrap">
          <div className="menu-grid">
            {/* featured signature */}
            <div className="menu-feature" data-reveal>
              <div className="menu-kicker">02 — MENU</div>
              <h2>من المنيو</h2>
              <p>
                قائمة مدروسة بلا زوائد — نُتقن الأساسيات ونضيف لمستنا. هذه أكثر
                مشروباتنا طلبًا، والقائمة الكاملة بانتظارك.
              </p>
              <div className="signature">
                <div className="signature-blob" />
                <div className="signature-body">
                  <div className="signature-label">توقيع تريس</div>
                  <div className="signature-row">
                    <span className="signature-name">هوت تريس</span>
                    <span>
                      <span className="signature-price">19</span>{" "}
                      <span className="signature-cur">ر.س</span>
                    </span>
                  </div>
                  <p className="signature-desc">
                    مشروبنا الحار المميّز — دافئ، غنيّ، ويحمل اسمنا.
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
                {CATEGORIES.map((c) => {
                  const empty = c.items.length === 0;
                  const img = c.image ?? c.items.find((i) => i.image)?.image;
                  return (
                    <Link
                      key={c.id}
                      href={`/menu/${c.id}`}
                      className={"tile" + (img ? " has-img" : "") + (empty ? " soon" : "")}
                    >
                      {img && (
                        <span
                          className="tile-img"
                          style={{
                            backgroundImage: `url(${img})`,
                          }}
                        />
                      )}
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
      <div className="section story">
        <div className="story-grid">
          <div data-reveal>
            <div className="section-kicker">03 — STORY</div>
            <h2>
              من الطائف،
              <br />
              مدينة الورد.
            </h2>
            <p className="lead">
              على ارتفاع 1879 مترًا في جبال الحجاز، تشتهر الطائف بمناخها المعتدل،
              وردها، وعسلها الجبلي. من هذه المدينة انطلقت تريس — مقهى قهوة مختصة
              يختار ثلاثة أصول ويحمّصها بدفعاتٍ صغيرة.
            </p>
            <p className="sub">
              اسمنا مستوحى من «ثلاثة»: ثلاثة أصول للقهوة، تجتمع في حكايةٍ واحدة.
              نهتمّ بمصدر الحبوب، ودرجة التحميص، وطريقة التحضير — والنتيجة فنجانٌ
              واضح الطعم، في مكانٍ مريح تعود إليه.
            </p>
            <span className="btn-story">القصة كاملة</span>
          </div>
          <div data-reveal data-reveal-delay="120" data-parallax="12">
            <div className="story-art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/building.png" alt="قصر شبرا" />
              <div className="story-caption">
                قصر شبرا — المعلم الذي ألهم هويّتنا · الطائف 1905
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== CTA BAND ===================== */}
      <div className="cta">
        <div className="cta-inner" data-reveal>
          <div>
            <h2>جاهز لكوبك؟</h2>
            <p>مرّ علينا في أقرب فرع، أو اطلب توصيلًا — قهوتك بانتظارك.</p>
          </div>
          <div className="cta-actions">
            <span className="btn btn-cta-primary">اطلب الآن</span>
            <span className="btn btn-cta-ghost">فروعنا</span>
          </div>
        </div>
      </div>
    </div>
  );
}
