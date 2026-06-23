"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CupSoda, Sparkles, MessageSquareText, Settings, LogOut } from "lucide-react";
import { logout } from "../actions";

type Tab = {
  href: string;
  label: string;
  icon: React.ComponentType<{ strokeWidth?: number }>;
  exact?: boolean;
  badgeKey?: boolean;
};

const TABS: Tab[] = [
  { href: "/admin", label: "الرئيسية", icon: LayoutDashboard, exact: true },
  { href: "/admin/menu", label: "المنيو", icon: CupSoda },
  { href: "/admin/home", label: "الواجهة", icon: Sparkles },
  { href: "/admin/feedback", label: "الملاحظات", icon: MessageSquareText, badgeKey: true },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export default function AdminNav({ newFeedback = 0 }: { newFeedback?: number }) {
  const pathname = usePathname();
  return (
    <>
      {/* desktop rail */}
      <aside className="admin-sidebar">
        <div className="brand">
          <span className="mark">T</span>
          <span>
            تريس
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
              لوحة التحكم
            </span>
          </span>
        </div>
        {TABS.map(({ href, label, icon: Icon, exact, badgeKey }) => (
          <Link key={href} href={href} className="nav-link" data-active={isActive(pathname, href, exact)}>
            <Icon strokeWidth={2} />
            <span>{label}</span>
            {badgeKey && newFeedback > 0 && <span className="dot">{newFeedback}</span>}
          </Link>
        ))}
        <div className="rail-foot">
          <form action={logout}>
            <button type="submit" className="nav-link" style={{ width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "start" }}>
              <LogOut strokeWidth={2} />
              <span>تسجيل الخروج</span>
            </button>
          </form>
        </div>
      </aside>

      {/* mobile bottom tabs */}
      <nav className="admin-tabbar" aria-label="التنقل">
        {TABS.map(({ href, label, icon: Icon, exact, badgeKey }) => (
          <Link key={href} href={href} className="admin-tab" data-active={isActive(pathname, href, exact)}>
            <Icon strokeWidth={2} />
            <span>{label}</span>
            {badgeKey && newFeedback > 0 && <span className="dot">{newFeedback}</span>}
          </Link>
        ))}
      </nav>
    </>
  );
}
