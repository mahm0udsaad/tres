import { SITE_URL } from "../lib/site";
import type { Metadata, Viewport } from "next";
import RootShell from "../RootShell";
import { THEME_COLORS } from "../lib/data";
import "./admin.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "لوحة التحكم — تريس",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: THEME_COLORS.classic,
  colorScheme: "light",
};

// Root layout for the control panel — the internal tools always wear the
// classic skin and none of the public site's chrome (see app/RootShell.tsx).
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootShell theme="classic">
      <div className="admin-app">{children}</div>
    </RootShell>
  );
}
