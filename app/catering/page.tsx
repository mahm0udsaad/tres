import type { Metadata } from "next";
import Link from "next/link";
import { Phone, Check, Coffee, CupSoda, Flower2, Plus, Tag } from "lucide-react";
import WhatsAppIcon from "../components/WhatsAppIcon";
import { getCateringPackages, getPublicSettings } from "../lib/data";
import { waLink } from "../lib/contact";

export const metadata: Metadata = {
  title: "حجز كاترينغ",
  description:
    "باقات ضيافة تريس للمناسبات في الطائف: ركن قهوة بالتوصيل والتجهيز وموظف تقديم، من ١٠٠ إلى ٣٠٠ كوب. شوف الأسعار واحجز عبر واتساب.",
  alternates: { canonical: "/catering" },
};

const STEPS = [
  { no: "01", title: "اختر الباقة", desc: "شوف الأسعار تحت واختر الأقرب لعدد ضيوفك." },
  { no: "02", title: "كلّمنا واتساب", desc: "قل لنا التاريخ، المكان، وعدد الضيوف — ونرجع لك بالتفاصيل." },
  { no: "03", title: "نجي لك", desc: "نوصّل ونجهّز الركن، وموظفنا يقدّم لضيوفك." },
];

// From the owner's price list (TRES EVENTS poster). The packages themselves
// are rows in catering_packages, edited from the control panel; these two
// lists apply to every package.
const DRINKS = [
  { icon: Coffee, label: "قهوة اليوم الحارة" },
  { icon: CupSoda, label: "قهوة اليوم الباردة" },
  { icon: Flower2, label: "الكركديه" },
];
const EXTRAS = [
  { icon: Plus, label: "الأكواب الإضافية", note: "فوق عدد أكواب الباقة", price: "12", unit: "للكوب الواحد" },
  { icon: Tag, label: "تاق مخصص باسم العرسان", note: "", price: "150", unit: "" },
];

export default async function CateringPage() {
  const [packages, settings] = await Promise.all([getCateringPackages(), getPublicSettings()]);
  const waGeneral = waLink(settings.whatsapp, "السلام عليكم، أبغى أستفسر عن كاترينغ تريس");

  return (
    <div className="catering-page">
      <section className="catering-hero">
        <div className="wrap narrow">
          <div className="section-kicker">CATERING · كاترينغ</div>
          <h1>نجي لمناسبتك بقهوتنا.</h1>
          <p>
            ركن ضيافة كامل من تريس: نوصّله، نجهّزه، وموظفنا يقدّم لضيوفك —
            للأعراس والاجتماعات والمناسبات الخاصة في الطائف.
          </p>
          <p className="catering-note">قهوة فقط — الباقات بدون حلا.</p>
          {waGeneral && (
            <a className="btn btn-cta-primary catering-hero-cta" href={waGeneral} target="_blank" rel="noreferrer">
              <WhatsAppIcon />
              احجز عبر واتساب
            </a>
          )}
        </div>
      </section>

      {packages.length > 0 && (
        <section className="section catering-packages">
          <div className="wrap">
            <div className="section-kicker">PACKAGES · الباقات</div>
            <h2 className="catering-h2">الأسعار</h2>
            <p className="catering-sub">كل الأسعار بالريال السعودي. كل الباقات تشمل التوصيل، تجهيز وتركيب ركن الضيافة، وموظف متخصص للتقديم.</p>

            <div className="catering-grid">
              {packages.map((p) => {
                const wa = waLink(
                  settings.whatsapp,
                  `السلام عليكم، أبغى أحجز كاترينغ — باقة ${p.ar}`,
                );
                return (
                  <article key={p.id} className="catering-card">
                    {p.badge && <span className="catering-badge">{p.badge}</span>}
                    <header className="catering-card-head">
                      <h3>{p.ar}</h3>
                      {p.en && <span className="catering-en" dir="ltr">{p.en}</span>}
                    </header>

                    <div className="catering-price">
                      <span className="num">{p.price}</span>
                      <span className="cur">ر.س</span>
                      {p.unit && <span className="unit">{p.unit}</span>}
                    </div>
                    {p.serves && <p className="catering-serves">{p.serves}</p>}
                    {p.desc && <p className="catering-desc">{p.desc}</p>}

                    {p.includes.length > 0 && (
                      <ul className="catering-includes">
                        {p.includes.map((line) => (
                          <li key={line}>
                            <Check strokeWidth={2.4} aria-hidden="true" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    )}

                    <p className="catering-card-extras">
                      <span>تقدر تضيف:</span> أكواب إضافية <b>12 ر.س</b> للكوب · تاق باسم العرسان{" "}
                      <b>150 ر.س</b>
                    </p>

                    {wa && (
                      <a className="btn btn-blush catering-card-cta" href={wa} target="_blank" rel="noreferrer">
                        احجز هذي الباقة
                      </a>
                    )}
                  </article>
                );
              })}
            </div>

          </div>
        </section>
      )}

      <section className="section catering-extras-sec">
        <div className="wrap">
          <div className="catering-extra">
            <div className="catering-extra-block">
              <h3>خيارات المشروبات</h3>
              <ul className="catering-drinks">
                {DRINKS.map(({ icon: Icon, label }) => (
                  <li key={label}>
                    <Icon strokeWidth={1.7} aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="catering-extra-block">
              <h3>إضافات على أي باقة</h3>
              <ul className="catering-addons">
                {EXTRAS.map(({ icon: Icon, label, note, price, unit }) => (
                  <li key={label}>
                    <Icon strokeWidth={1.8} aria-hidden="true" />
                    <span className="catering-addon-label">
                          {label}
                          {note && <small>{note}</small>}
                        </span>
                    <span className="catering-addon-price">
                      <span className="num">{price}</span> ر.س{unit && <small> {unit}</small>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section catering-steps-sec">
        <div className="wrap">
          <div className="section-kicker">HOW · كيف نشتغل</div>
          <div className="catering-steps">
            {STEPS.map((s) => (
              <div key={s.no} className="catering-step">
                <span className="catering-step-no">{s.no}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta catering-cta">
        <div className="cta-inner">
          <div>
            <h2>جاهزين لمناسبتك.</h2>
            <p>كلّمنا بالتاريخ وعدد الضيوف ونرجع لك بعرض مفصّل.</p>
          </div>
          <div className="cta-actions">
            {waGeneral && (
              <a className="btn btn-cta-primary" href={waGeneral} target="_blank" rel="noreferrer">
                <WhatsAppIcon />
                واتساب
              </a>
            )}
            {settings.phone && (
              <a className="btn btn-cta-ghost" href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}>
                <Phone strokeWidth={2} aria-hidden="true" />
                اتصال
              </a>
            )}
            <Link className="btn btn-cta-ghost" href="/menu">تصفّح المنيو</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
