import { IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import "./summer-theme.css";
import "./national-theme.css";
import "./winter-theme.css";
import "./loyalty-mascot.css";
import type { ThemeId } from "./lib/data";

/**
 * The <html>/<body> shell shared by the app's three root layouts:
 *   app/(site)/layout.tsx  — the public site (cached, wears the active skin)
 *   app/admin/layout.tsx   — the menu control panel
 *   app/staff/layout.tsx   — the staff / operations app
 *
 * They are separate root layouts so the public layout never has to read the
 * request (headers()) to tell which kind of page it is rendering — that read
 * used to make every public page dynamic and uncacheable.
 */

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

export default function RootShell({
  theme,
  children,
}: {
  theme: ThemeId;
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      data-theme={theme}
      data-scroll-behavior="smooth"
      className={`${ibmPlexArabic.variable} ${spaceGrotesk.variable} ${hnArabic.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
