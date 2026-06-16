"use client";

import { useEffect, useRef } from "react";

const RING_TEXT =
  "THREE ORIGINS ✦ ONE STORY ✦ SPECIALTY COFFEE ✦ ROASTED IN TAIF ✦ EST. 2019 ✦ ";

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
            {ch === " " ? " " : ch}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // ---- scroll reveal ----
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            const d = el.getAttribute("data-reveal-delay") || "0";
            el.style.transition = `opacity .85s ease ${d}ms, transform .85s cubic-bezier(.2,.7,.2,1) ${d}ms`;
            el.classList.add("is-visible");
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

    // ---- parallax ----
    const onMove = (ev: MouseEvent) => {
      const mx = ev.clientX / window.innerWidth - 0.5;
      const my = ev.clientY / window.innerHeight - 0.5;
      root.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        const s = parseFloat(el.getAttribute("data-parallax") || "10") || 10;
        el.style.transform = `translate(${-mx * s}px,${-my * s}px)`;
      });
    };
    window.addEventListener("mousemove", onMove);

    // ---- nav background on scroll ----
    const onScroll = () => {
      const nav = navRef.current;
      if (!nav) return;
      if (window.scrollY > 20) {
        nav.style.background = "rgba(90,10,32,.92)";
        nav.style.boxShadow = "0 10px 30px -18px rgba(0,0,0,.6)";
      } else {
        nav.style.background = "rgba(112,13,40,.72)";
        nav.style.boxShadow = "none";
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div ref={rootRef} className="page">
      {/* announcement */}
      <div className="announce">
        ☕ مزيج تريس الموسمي — مُحمَّص هذا الأسبوع، ومتوفّر في كل فرع
      </div>

      {/* nav */}
      <div ref={navRef} className="nav">
        <div className="nav-inner">
          <div className="logo">
            <span className="logo-ar">تريس</span>
            <span className="logo-en">TRES</span>
          </div>
          <div className="nav-links">
            <span className="nav-link">الرئيسية</span>
            <span className="nav-link muted">المنيو</span>
            <span className="nav-link muted">قصتنا</span>
            <span className="nav-link muted">فروعنا</span>
            <span className="btn btn-blush nav-link">اطلب الآن</span>
          </div>
        </div>
      </div>

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
            ثلاثة أصولٍ، حكايةٌ <span className="accent">واحدة.</span>
          </h1>
          <p className="hero-lede" data-reveal data-reveal-delay="120">
            قهوة مختصة، مُحمَّصة بدفعاتٍ صغيرة في الطائف. ثلاثة أصول مختارة بعناية
            — الإثيوبي، الكولومبي، ومزيج تريس — تجتمع في فنجانٍ واحد.
          </p>
          <div className="hero-actions" data-reveal data-reveal-delay="180">
            <span className="btn btn-hero-primary">تصفّح المنيو</span>
            <span className="btn btn-hero-ghost">أقرب فرع لك</span>
          </div>
          <div className="hero-meta" data-reveal data-reveal-delay="240">
            <span>منذ ٢٠١٩</span>
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
              نختار حبوبنا من مزارع مرتفعة حول العالم، ونحمّصها على دفعاتٍ صغيرة
              لإبراز إيحاءاتها. لكل أصلٍ شخصيّته — وهذه ثلاثتنا.
            </p>
          </div>

          <div className="origins-grid">
            {/* card 1 */}
            <div className="origin-card" data-reveal data-reveal-delay="0">
              <div className="origin-num">01</div>
              <div className="origin-body">
                <div className="origin-flag">🇪🇹</div>
                <h3>الإثيوبي</h3>
                <p>توت أزرق مجفّف، كراميل، ليمون، ومسحوق الكاكاو.</p>
                <div className="tags">
                  <span className="tag">هيريليوم</span>
                  <span className="tag">٢٠٠٠م</span>
                  <span className="tag">مجفّفة</span>
                </div>
              </div>
            </div>
            {/* card 2 */}
            <div className="origin-card" data-reveal data-reveal-delay="100">
              <div className="origin-num">02</div>
              <div className="origin-body">
                <div className="origin-flag">🇨🇴</div>
                <h3>الكولومبي</h3>
                <p>عنب، فواكه حمراء، وحلاوة ناعمة تُشبه مربّى العنب.</p>
                <div className="tags">
                  <span className="tag">كاتورا</span>
                  <span className="tag">١٧٥٠م</span>
                  <span className="tag">لا هوائية</span>
                </div>
              </div>
            </div>
            {/* card 3 (accent) */}
            <div
              className="origin-card accent"
              data-reveal
              data-reveal-delay="200"
            >
              <div className="origin-num">03</div>
              <div className="origin-body">
                <div className="origin-tres">TRES</div>
                <h3>مزيج تريس</h3>
                <p>فواكه استوائية، مانجو، عسل، وشوكولاتة — توقيعنا الخاص.</p>
                <div className="tags">
                  <span className="tag">تيبيكا</span>
                  <span className="tag">ريد بوربون</span>
                  <span className="tag">١٤٠٠–١٦٠٠م</span>
                </div>
              </div>
            </div>
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
                      <span className="signature-price">١٩</span>{" "}
                      <span className="signature-cur">ر.س</span>
                    </span>
                  </div>
                  <p className="signature-desc">
                    مشروبنا الحار المميّز — دافئ، غنيّ، ويحمل اسمنا.
                  </p>
                </div>
              </div>
              <span className="btn btn-menu">
                المنيو الكامل <span className="arrow">←</span>
              </span>
            </div>

            {/* list */}
            <div data-reveal data-reveal-delay="100">
              <div className="menu-cat">قهوة</div>
              <div className="menu-item">
                <span className="menu-item-name">سبانش لاتيه</span>
                <span className="menu-badge">حار / بارد</span>
                <span className="menu-dots" />
                <span className="menu-price">
                  <span className="num">١٨</span>{" "}
                  <span className="cur">ر.س</span>
                </span>
              </div>
              <div className="menu-item">
                <span className="menu-item-name">فلات وايت</span>
                <span className="menu-dots" />
                <span className="menu-price">
                  <span className="num">١٦</span>{" "}
                  <span className="cur">ر.س</span>
                </span>
              </div>
              <div className="menu-item">
                <span className="menu-item-name">كابتشينو</span>
                <span className="menu-dots" />
                <span className="menu-price">
                  <span className="num">١٦</span>{" "}
                  <span className="cur">ر.س</span>
                </span>
              </div>
              <div className="menu-item last">
                <span className="menu-item-name">كورتادو</span>
                <span className="menu-dots" />
                <span className="menu-price">
                  <span className="num">١٥</span>{" "}
                  <span className="cur">ر.س</span>
                </span>
              </div>

              <div className="menu-cat second">قهوة مختصة ومشروبات</div>
              <div className="menu-item">
                <span className="menu-item-name">محصول تريس</span>
                <span className="menu-badge">حار / بارد</span>
                <span className="menu-dots" />
                <span className="menu-price">
                  <span className="num">٢٠</span>{" "}
                  <span className="cur">ر.س</span>
                </span>
              </div>
              <div className="menu-item">
                <span className="menu-item-name">ماتشا فوم</span>
                <span className="menu-dots" />
                <span className="menu-price">
                  <span className="num">٢٠</span>{" "}
                  <span className="cur">ر.س</span>
                </span>
              </div>
              <div className="menu-item last">
                <span className="menu-item-name">كركديه</span>
                <span className="menu-dots" />
                <span className="menu-price">
                  <span className="num">١٥</span>{" "}
                  <span className="cur">ر.س</span>
                </span>
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
              على ارتفاع ١٨٧٩ مترًا في جبال الحجاز، تشتهر الطائف بمناخها المعتدل،
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
                قصر شبرا — المعلم الذي ألهم هويّتنا · الطائف ١٩٠٥
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

      {/* ===================== FOOTER ===================== */}
      <div className="footer">
        <div className="footer-inner">
          <div className="footer-cols">
            <div>
              <div className="footer-brand">
                <span className="ar">تريس</span>
                <span className="en">TRES</span>
              </div>
              <p className="footer-about">
                ثلاثة أصول، حكاية واحدة. قهوة مختصة تُحمّص بدفعاتٍ صغيرة في
                الطائف، مدينة الورد.
              </p>
            </div>
            <div className="footer-col">
              <div className="title">الفروع</div>
              <div className="lines">
                الطائف — شبرا
                <br />
                الرياض — العليا
              </div>
            </div>
            <div className="footer-col">
              <div className="title">ساعات العمل</div>
              <div className="lines">
                السبت – الخميس
                <br />
                ٧:٠٠ص — ١٢:٠٠م
              </div>
            </div>
            <div className="footer-col">
              <div className="title">انضمّ لنشرتنا</div>
              <div className="newsletter">
                <input placeholder="بريدك الإلكتروني" />
                <button type="button">اشترك</button>
              </div>
              <div className="socials">
                <span>انستقرام</span>
                <span>تيك توك</span>
                <span>X</span>
              </div>
            </div>
          </div>
          <div className="footer-base">
            <span>© ٢٠٢٦ تريس — جميع الحقوق محفوظة.</span>
            <span className="en">THREE ORIGINS · ONE STORY</span>
          </div>
        </div>
      </div>
    </div>
  );
}
