import { SITE_URL } from "../lib/site";
import type { Metadata, Viewport } from "next";
import RootShell from "../RootShell";
import { THEME_COLORS } from "../lib/data";
import { getStaffContext } from "../lib/staff";
import { dashboardLang } from "../lib/staff-shared";
import { dirFor, type Lang } from "../lib/staff-i18n";
import "./staff.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "لوحة الموظفين — تريس",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: THEME_COLORS.classic,
  colorScheme: "light",
};

export const dynamic = "force-dynamic";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The staff app renders in each member's preferred language and flips
  // direction to match. Unauthenticated pages (login) default to Arabic.
  // Admin roles (owner/manager/supervisor/shift_manager) always see Arabic.
  const context = await getStaffContext().catch(() => null);
  const lang: Lang = context?.profile ? dashboardLang(context.profile) : "ar";
  const isOwner = context?.profile?.role === "owner" || context?.profile?.role === "manager";

  // Root layout for the staff app (see app/RootShell.tsx): classic skin, no
  // public-site chrome.
  return (
    <RootShell theme="classic">
      <div
        className={`staff-app${isOwner ? " staff-app--owner" : ""}`}
        lang={lang}
        dir={dirFor(lang)}
      >
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: isOwner
              ? `try{var t=localStorage.getItem("tres-owner-theme");document.documentElement.dataset.ownerTheme=t==="dark"||t==="light"?t:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){}`
              : `document.documentElement.removeAttribute("data-owner-theme")`,
          }}
        />
        {children}
      </div>
    </RootShell>
  );
}
