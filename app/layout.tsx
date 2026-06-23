import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import "./loyalty-mascot.css";
import SiteHeader from "./components/SiteHeader";
import Footer from "./components/Footer";
import LoyaltyMascot from "./components/LoyaltyMascot";
import { TresQr } from "./table-card/qr";
import { SITE, SITE_URL } from "./lib/site";

// Loyalty-program QR destination — single swappable constant. Defaults to the
// same URL the placeholder PNG uses (scripts/make-loyalty-qr.mjs). Change this
// (or swap public/assets/loyalty-qr.png) once the loyalty link is finalised.
const LOYALTY_QR_URL = "https://www.instagram.com/tres_saudi";
import { getPublicSettings } from "./lib/data";

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-latin",
  display: "swap",
});

const hnArabic = localFont({
  src: "../public/assets/fonts/HelveticaNeueArabic-Bold.ttf",
  weight: "700",
  variable: "--font-display",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#700d28",
  colorScheme: "light",
};

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The control panel (/admin) renders its own chrome — hide the marketing
  // header/footer there.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const settings = isAdmin ? null : await getPublicSettings();
  const announcement = settings?.announcementActive ? settings.announcement ?? undefined : undefined;
  const theme = settings?.theme ?? "classic";

  return (
    <html
      lang="ar"
      dir="rtl"
      data-theme={theme}
      data-scroll-behavior="smooth"
      className={`${ibmPlexArabic.variable} ${spaceGrotesk.variable} ${hnArabic.variable}`}
    >
      <body>
        {!isAdmin && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
        {!isAdmin && <SiteHeader announcement={announcement} />}
        {children}
        {!isAdmin && <Footer />}
        {!isAdmin && <LoyaltyMascot qr={<TresQr url={LOYALTY_QR_URL} ariaLabel="باركود برنامج الولاء" />} />}
      </body>
    </html>
  );
}
