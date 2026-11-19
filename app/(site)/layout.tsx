import type { Metadata, Viewport } from "next";
import RootShell from "../RootShell";
import SiteHeader from "../components/SiteHeader";
import Footer from "../components/Footer";
import LoyaltyMascot from "../components/LoyaltyMascot";
import Snowfall from "../components/Snowfall";
import { TresQr } from "../components/qr";
import { SITE, SITE_URL } from "../lib/site";

// Loyalty-program QR destination — single swappable constant. Defaults to the
// same URL the placeholder PNG uses (scripts/make-loyalty-qr.mjs). Change this
// (or swap public/assets/loyalty-qr.png) once the loyalty link is finalised.
import { LOYALTY_URL as LOYALTY_QR_URL } from "../lib/contact";
import { getPublicSettings, THEME_COLORS } from "../lib/data";
import { getActiveTheme } from "../lib/theme";

// Browser chrome follows the active skin, so the National Day green doesn't sit
// under a wine-coloured status bar on mobile.
export async function generateViewport(): Promise<Viewport> {
  return {
    themeColor: THEME_COLORS[await getActiveTheme()],
    colorScheme: "light",
  };
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  category: "food",
  keywords: [
    "تريس",
    "TRES",
    "قهوة مختصة",
    "قهوة مختصة الطائف",
    "قهوة الطائف",
    "كوفي الطائف",
    "محمصة قهوة",
    "قهوة إثيوبية",
    "قهوة كولومبية",
    "سبانش لاتيه",
    "ماتشا",
    "specialty coffee",
    "Taif coffee",
    "Saudi specialty coffee",
  ],
  authors: [{ name: SITE.nameEn }],
  creator: SITE.nameEn,
  publisher: SITE.nameEn,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    url: SITE_URL,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    telephone: false,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CafeOrCoffeeShop",
  name: SITE.nameEn,
  alternateName: SITE.name,
  description: SITE.description,
  url: SITE_URL,
  image: `${SITE_URL}/opengraph-image`,
  logo: `${SITE_URL}/assets/logo/tres-badge-burgundy.png`,
  slogan: SITE.tagline,
  servesCuisine: ["Coffee", "Specialty Coffee", "Desserts"],
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    addressLocality: SITE.city,
    addressCountry: SITE.country,
  },
  hasMenu: `${SITE_URL}/menu`,
  sameAs: [SITE.instagram, SITE.tiktok, SITE.snapchat],
};

// Safety net for edits made straight in the database (the control panel
// revalidates on save, so its changes show immediately).
export const revalidate = 3600;

// Public layout. It reads nothing from the request, so every public page can be
// served from the cache; owner edits in /admin revalidate it (refreshPublic in
// app/admin/actions.ts).
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, theme] = await Promise.all([getPublicSettings(), getActiveTheme()]);
  const announcement = settings.announcementActive ? settings.announcement ?? undefined : undefined;

  return (
    <RootShell theme={theme}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader announcement={announcement} theme={theme} />
      {/* Falling snow — winter skin only, and it mounts nothing under
          prefers-reduced-motion (see Snowfall.tsx). */}
      {theme === "winter" && <Snowfall />}
      {children}
      <Footer />
      <LoyaltyMascot qr={<TresQr url={LOYALTY_QR_URL} ariaLabel="باركود برنامج الولاء" />} qrUrl={LOYALTY_QR_URL} />
    </RootShell>
  );
}
