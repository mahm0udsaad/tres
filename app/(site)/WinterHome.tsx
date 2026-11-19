import Link from "next/link";
import { Coffee, MapPin, UtensilsCrossed, Star, MessageSquareWarning } from "lucide-react";
import { STORE_MAPS, LOYALTY_URL, mapsLink } from "../lib/contact";
import { getPublicSettings } from "../lib/data";

/**
 * الصفحة الرئيسية — الواجهة الجديدة (winter skin).
 *
 * The owner's brief, in his words: open the page and there is a plain colour
 * with snow falling on it, and nothing but the choices — المنيو on the right,
 * الكاترينج on the left, موقعنا and برنامج الولاء under them, and a long box
 * under those for الاستفسارات والشكاوى. No hero copy.
 *
 * On this skin the home page is this screen and فروعنا (the map) under it —
 * nothing else (app/page.tsx). The owner asked for the menu to stay behind
 * its tile rather than run down the home page.
 *
 * The snow is <Snowfall>, already mounted by the root layout on this skin.
 */

type Tile = {
  href: string;
  external?: boolean;
  icon: React.ComponentType<{ strokeWidth?: number; "aria-hidden"?: boolean }>;
  title: string;
  sub: string;
  en: string;
  /** the one choice most visitors came for — drawn warmer than the rest */
  primary?: boolean;
};

export default async function WinterHome() {
  const settings = await getPublicSettings();

  const tiles: Tile[] = [
    {
      href: "/menu",
      icon: Coffee,
      title: "شوف المنيو",
      sub: "قهوتنا وحلانا بالكامل",
      en: "MENU",
      primary: true,
    },
    {
      href: "/catering",
      icon: UtensilsCrossed,
      title: "حجز كاترينج",
      sub: "نجي لمناسبتك بقهوتنا",
      en: "CATERING",
    },
    {
      href: mapsLink(settings.mapsUrl) || STORE_MAPS.place,
      external: true,
      icon: MapPin,
      title: "موقعنا على جوجل ماب",
      sub: "الطائف — حي الجال",
      en: "FIND US",
    },
    {
      href: LOYALTY_URL,
      external: true,
      icon: Star,
      title: "برنامج الولاء",
      sub: "اشترِ ٥ أكواب والسادس مجاناً",
      en: "LOYALTY",
    },
  ];

  return (
    <section className="wn-home">
      <div className="wn-home-symbols" aria-hidden="true">
        <span className="wn-home-outline">TRES</span>
        <TennisRacketMark />
        <span className="wn-symbol-arc" />
        <span className="wn-symbol-ball wn-symbol-ball--one" />
        <span className="wn-symbol-ball wn-symbol-ball--two" />
        <span className="wn-symbol-court" />
        <span className="wn-symbol-star wn-symbol-star--one">✦</span>
        <span className="wn-symbol-star wn-symbol-star--two">✦</span>
        <span className="wn-symbol-star wn-symbol-star--three">✦</span>
      </div>
      <div className="wn-home-inner">
        <header className="wn-home-head">
          <h1 className="wn-home-ar">تريس</h1>
          <span className="wn-home-en">TRES</span>
          <span className="wn-home-slogan">قهوة مختصة · تجربة مختلفة</span>
        </header>

        <nav className="wn-home-grid" aria-label="اختصارات تريس">
          {tiles.map((t) =>
            t.external ? (
              <a key={t.title} className={tileClass(t)} href={t.href} target="_blank" rel="noreferrer">
                <TileBody tile={t} />
              </a>
            ) : (
              <Link key={t.title} className={tileClass(t)} href={t.href}>
                <TileBody tile={t} />
              </Link>
            )
          )}

          <Link className="wn-tile wn-tile--wide" href="/complaints">
            <span className="wn-tile-icon">
              <MessageSquareWarning strokeWidth={1.7} aria-hidden="true" />
            </span>
            <span className="wn-tile-body">
              <span className="wn-tile-title">الاستفسارات والشكاوى والاقتراحات</span>
              <span className="wn-tile-sub">رأيك يوصلنا، ونوعدك نتابعه</span>
            </span>
            <span className="wn-tile-en">SAY IT</span>
          </Link>
        </nav>
      </div>
      <SnowDrift />
    </section>
  );
}

/* The racket's geometry, kept outside the component so the string bed is
   built once at module load, not on every render. The head is egg-shaped —
   wider above the centre, as a real head is — and the bed is inset from it by
   the frame's width. */
const HEAD =
  "M150 20C222 20 264 82 264 160C264 236 214 306 150 310C86 306 36 236 36 160C36 82 78 20 150 20Z";
const BED =
  "M150 37C211 37 247 91 247 160C247 226 204 291 150 294C96 291 53 226 53 160C53 91 89 37 150 37Z";
// 16 mains × 19 crosses — the common 16×19 pattern, spaced to the bed
const MAINS = Array.from({ length: 16 }, (_, i) => `M${60 + i * 12} 30V300`).join("");
const CROSSES = Array.from({ length: 22 }, (_, j) => `M40 ${44 + j * 12}H260`).join("");

/**
 * The racket in the hero — the brand's own racket (public/assets/winter/
 * rackets.png: wine frame, ice-blue and cream paint, cream overgrip) redrawn as
 * a vector so it stays sharp at poster size and can be lit by the scene:
 *
 *  · the frame is shaded from the top, where the snow's light pool sits
 *    (Snowfall.tsx), with a rim light on its upper inner edge;
 *  · the paint bands and grommets ride the frame path itself (pathLength=100),
 *    so they follow the curve exactly;
 *  · a 16×19 string bed with the TRES stencil on it, mains brighter than
 *    crosses, as they read on a real racket;
 *  · snow has settled along the top of the head — the winter, on the court.
 */
function TennisRacketMark() {
  return (
    <svg className="wn-symbol-racket" viewBox="0 0 300 560" fill="none">
      <defs>
        <linearGradient id="wn-rk-frame" x1="60" y1="20" x2="250" y2="320" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#b8435a" />
          <stop offset="0.55" stopColor="#8a1f33" />
          <stop offset="1" stopColor="#4f1020" />
        </linearGradient>
        <linearGradient id="wn-rk-shaft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5a1222" />
          <stop offset="0.4" stopColor="#a8344b" />
          <stop offset="1" stopColor="#4a0e1c" />
        </linearGradient>
        <linearGradient id="wn-rk-grip" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#bfae98" />
          <stop offset="0.38" stopColor="#f1e8da" />
          <stop offset="1" stopColor="#a8967f" />
        </linearGradient>
        <radialGradient id="wn-rk-bed-light" cx="0.42" cy="0.2" r="0.85">
          <stop offset="0" stopColor="#f6f3ed" stopOpacity="0.14" />
          <stop offset="1" stopColor="#f6f3ed" stopOpacity="0" />
        </radialGradient>
        <clipPath id="wn-rk-bed">
          <path d={BED} />
        </clipPath>
        <clipPath id="wn-rk-handle">
          <rect x="133" y="424" width="34" height="112" rx="7" />
        </clipPath>
      </defs>

      {/* the string bed — a faint lit membrane, then crosses under mains */}
      <path d={BED} fill="url(#wn-rk-bed-light)" />
      <g clipPath="url(#wn-rk-bed)">
        <path className="wn-rk-crosses" d={CROSSES} />
        <path className="wn-rk-mains" d={MAINS} />
        <text className="wn-rk-stencil" x="150" y="176" textAnchor="middle">
          TRES
        </text>
      </g>

      {/* throat — open, two arms down into the shaft */}
      <path className="wn-rk-throat" d="M98 286C112 330 128 372 140 412" />
      <path className="wn-rk-throat" d="M202 286C188 330 172 372 160 412" />
      {/* shaft, tapering into the handle */}
      <path d="M139 404H161L164 428H136Z" fill="url(#wn-rk-shaft)" />

      {/* the frame: dark outer edge, the shaded tube, paint, grommets, rim light */}
      <path d={HEAD} className="wn-rk-edge" />
      <path d={HEAD} className="wn-rk-tube" />
      <path d={HEAD} pathLength={100} className="wn-rk-paint wn-rk-paint--ice" strokeDasharray="0 80 18 100" />
      <path d={HEAD} pathLength={100} className="wn-rk-paint wn-rk-paint--ice" strokeDasharray="0 0 3 100" />
      <path d={HEAD} pathLength={100} className="wn-rk-paint wn-rk-paint--cream" strokeDasharray="0 76 4 100" />
      <path d={HEAD} pathLength={100} className="wn-rk-paint wn-rk-paint--cream" strokeDasharray="0 3 5 100" />
      <path d={HEAD} pathLength={100} className="wn-rk-paint wn-rk-paint--cream" strokeDasharray="0 22 3 100" />
      <path d={HEAD} pathLength={100} className="wn-rk-grommets" />
      <path d={BED} pathLength={100} className="wn-rk-rim" strokeDasharray="0 68 32 100" />

      {/* handle: overgrip wound on the bias, then the butt cap */}
      <rect x="133" y="424" width="34" height="112" rx="7" fill="url(#wn-rk-grip)" />
      <g clipPath="url(#wn-rk-handle)" className="wn-rk-wrap">
        {Array.from({ length: 11 }, (_, i) => (
          <path key={i} d={`M128 ${432 + i * 10.5}L172 ${420 + i * 10.5}`} />
        ))}
      </g>
      <path d="M150 426V534" className="wn-rk-bevel" />
      <rect x="130" y="532" width="40" height="14" rx="5" className="wn-rk-cap" />
      <path d="M137 539H163" className="wn-rk-cap-line" />

      {/* snow settled on the crown of the head */}
      <path
        className="wn-rk-snow"
        d="M66 66C80 40 108 17 150 14C192 17 220 40 234 66C228 62 222 62 216 64C210 50 196 44 186 47C176 34 160 32 150 34C138 30 122 36 114 46C102 42 88 50 84 62C78 60 72 62 66 66Z"
      />
      <circle className="wn-rk-snow" cx="98" cy="43" r="4.5" />
      <circle className="wn-rk-snow" cx="201" cy="41" r="3.5" />
    </svg>
  );
}

function tileClass(t: Tile) {
  return t.primary ? "wn-tile wn-tile--primary" : "wn-tile";
}

/**
 * The snow the page has caught: a soft bank along the bottom edge that builds
 * up over the first minute on the page (see .wn-drift). Two layered ridges so
 * it reads as a drift with depth, not a flat white band.
 */
function SnowDrift() {
  return (
    <svg className="wn-drift" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
      <path
        className="wn-drift-back"
        d="M0 62C120 40 210 58 330 50S560 26 690 44 930 62 1060 40 1300 30 1440 48V120H0Z"
      />
      <path
        className="wn-drift-front"
        d="M0 84C150 70 250 92 400 80S650 60 800 76 1050 96 1200 78 1380 70 1440 76V120H0Z"
      />
    </svg>
  );
}

function TileBody({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  return (
    <>
      <span className="wn-tile-icon">
        <Icon strokeWidth={1.7} aria-hidden={true} />
      </span>
      <span className="wn-tile-body">
        <span className="wn-tile-title">{tile.title}</span>
        <span className="wn-tile-sub">{tile.sub}</span>
      </span>
      <span className="wn-tile-en">{tile.en}</span>
    </>
  );
}
