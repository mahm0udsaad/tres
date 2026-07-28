import type { Metadata } from "next";
import { getStaffContext } from "../lib/staff";
import { dirFor, type Lang } from "../lib/staff-i18n";
import "./staff.css";

export const metadata: Metadata = {
  title: "لوحة الموظفين — تريس",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  // The staff app renders in each member's preferred language and flips
  // direction to match. Unauthenticated pages (login) default to Arabic.
  // Admin roles (owner/manager/supervisor/shift_manager) always see Arabic.
  const context = await getStaffContext().catch(() => null);
  const role = context?.profile?.role;
  const isAdminRole = role === "owner" || role === "manager" || role === "supervisor" || role === "shift_manager";
  const lang: Lang = isAdminRole ? "ar" : context?.profile?.preferred_language ?? "ar";

  return (
    <div className="staff-app" lang={lang} dir={dirFor(lang)}>
      {children}
    </div>
  );
}
