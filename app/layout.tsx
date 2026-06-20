import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import SiteHeader from "./components/SiteHeader";
import Footer from "./components/Footer";
import { SITE, SITE_URL } from "./lib/site";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      data-scroll-behavior="smooth"
      className={`${ibmPlexArabic.variable} ${spaceGrotesk.variable} ${hnArabic.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SiteHeader />
        {children}
        <Footer />
      </body>
    </html>
  );
}
