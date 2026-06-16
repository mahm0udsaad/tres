import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "تريس — ثلاثة أصول، حكاية واحدة",
  description:
    "تريس قهوة مختصة، مُحمَّصة بدفعاتٍ صغيرة في الطائف. ثلاثة أصول مختارة بعناية — الإثيوبي، الكولومبي، ومزيج تريس — تجتمع في فنجانٍ واحد.",
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
      className={`${ibmPlexArabic.variable} ${spaceGrotesk.variable} ${hnArabic.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
