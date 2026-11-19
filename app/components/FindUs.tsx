import { Navigation, Clock, Coffee, ShoppingBag, Car } from "lucide-react";
import { getPublicSettings, type HoursRow } from "../lib/data";
import { STORE, STORE_MAPS, mapsLink } from "../lib/contact";
import OpenState from "./OpenState";

/**
 * فروعنا / FIND US — the branch block, built to the owner's reference: the map
 * itself on the page with the store pinned, then a card with what the branch
 * offers, whether it is open right now, its hours, and a directions button.
 *
 * The map is Google's classic embed (`output=embed`), which needs no API key;
 * the pin comes from the owner's own share link, resolved to the store's
 * listing query in lib/contact.ts.
 */

const DAYS = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

function hoursLine(hours: HoursRow[]): string | null {
  const openDays = hours.filter((h) => !h.closed && h.open && h.close);
  if (!openDays.length) return null;
  const sample = openDays[0];
  const sameEveryDay = openDays.every((h) => h.open === sample.open && h.close === sample.close);
  if (sameEveryDay && openDays.length >= 6) return `يومياً · ${sample.open} — ${sample.close}`;
  return openDays
    .map((h, i) => `${DAYS[hours.indexOf(h)] ?? DAYS[i]} ${h.open}—${h.close}`)
    .slice(0, 3)
    .join(" · ");
}

const SERVICES = [
  { icon: Coffee, label: "جلسات داخل المقهى" },
  { icon: ShoppingBag, label: "استلام" },
  { icon: Car, label: "خدمة السيارة" },
];

export default async function FindUs() {
  const settings = await getPublicSettings();
  const line = hoursLine(settings.hours);
  const place = mapsLink(settings.mapsUrl) || STORE_MAPS.place;

  return (
    <section className="section find-us" id="find-us">
      <div className="wrap find-wrap">
        <div className="find-head">
          <div className="section-kicker">FIND US · فروعنا</div>
          <h2>فروعنا</h2>
          <span className="find-rule" aria-hidden="true" />
        </div>

        <div className="find-map">
          <iframe
            src={STORE_MAPS.embed}
            title={`${STORE.nameEn} على خرائط قوقل`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <div className="find-pin-card">
            <strong>
              {STORE.nameEn} · {STORE.name}
            </strong>
            <OpenState hours={settings.hours} plain />
            <a href={place} target="_blank" rel="noreferrer">
              افتح في قوقل ماب ↗
            </a>
          </div>
          <a
            className="btn find-map-cta"
            href={STORE_MAPS.directions}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation strokeWidth={2} aria-hidden="true" />
            أرشدني للفرع
          </a>
        </div>

        <article className="find-card">
          <header className="find-card-head">
            <h3>
              {STORE.nameEn} <span>· {STORE.name}</span>
            </h3>
            <p>{settings.address || STORE.address}</p>
          </header>

          <div className="find-chips">
            {SERVICES.map((s) => (
              <span key={s.label} className="find-chip">
                <s.icon strokeWidth={2} aria-hidden="true" />
                {s.label}
              </span>
            ))}
          </div>

          <OpenState hours={settings.hours} />

          <p className="find-hours">
            <Clock strokeWidth={2} aria-hidden="true" />
            {line ?? "تابع حساباتنا لمواعيد اليوم"}
          </p>

          <a
            className="btn find-card-cta"
            href={STORE_MAPS.directions}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation strokeWidth={2} aria-hidden="true" />
            الاتجاهات في قوقل ماب
          </a>
        </article>
      </div>
    </section>
  );
}
