"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CupSoda,
  Sparkles,
  MessageSquareText,
  Settings,
  LogOut,
  Users,
  ExternalLink,
} from "lucide-react";
import { logout } from "../actions";

type Tab = {
  href: string;
  label: string;
  icon: React.ComponentType<{ strokeWidth?: number }>;
  exact?: boolean;
  badgeKey?: boolean;
  external?: boolean;
};

// Menu dashboard tabs (main domain only).
const MENU_TABS: Tab[] = [
  { href: "/admin", label: "الرئيسية", icon: LayoutDashboard, exact: true },
  { href: "/admin/menu", label: "المنيو", icon: CupSoda },
  { href: "/admin/home", label: "الواجهة", icon: Sparkles },
  { href: "/admin/feedback", label: "الملاحظات", icon: MessageSquareText, badgeKey: true },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export default function AdminNav({
  newFeedback = 0,
  opsHost = false,
  opsOperationsUrl = null,
}: {
  newFeedback?: number;
  opsHost?: boolean;
  opsOperationsUrl?: string | null;
}) {
  const pathname = usePathname();

  // On the ops subdomain the shell IS the operations console — no menu tabs.
  // On the main domain, the "Operations" tab jumps to the ops subdomain when
  // one is configured (external), otherwise it links in place (local dev).
  const tabs: Tab[] = opsHost
    ? [{ href: "/admin/operations", label: "العمليات", icon: Users }]
    : [
        ...MENU_TABS.slice(0, 4),
        opsOperationsUrl
          ? { href: opsOperationsUrl, label: "العمليات", icon: Users, external: true }
          : { href: "/admin/operations", label: "العمليات", icon: Users },
        MENU_TABS[4],
      ];

  const renderTab = (tab: Tab, className: string) => {
    const inner = (
      <>
        <tab.icon strokeWidth={2} />
        <span>{tab.label}</span>
        {tab.external ? <ExternalLink strokeWidth={2} className="nav-ext" /> : null}
        {tab.badgeKey && newFeedback > 0 ? <span className="dot">{newFeedback}</span> : null}
      </>
    );
    if (tab.external) {
      return (
        <a key={tab.href} href={tab.href} className={className}>
          {inner}
        </a>
      );
    }
    return (
      <Link
        key={tab.href}
        href={tab.href}
        className={className}
        data-active={isActive(pathname, tab.href, tab.exact)}
      >
        {inner}
      </Link>
    );
  };

  const brandSub = opsHost ? "منظومة العمليات" : "لوحة التحكم";

  return (
    <>
      {/* desktop rail */}
      <aside className="admin-sidebar">
        <div className="brand">
          <span className="mark">T</span>
          <span>
            تريس
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
              {brandSub}
            </span>
          </span>
        </div>
        {tabs.map((tab) => renderTab(tab, "nav-link"))}
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
        {tabs.map((tab) => renderTab(tab, "admin-tab"))}
      </nav>
    </>
  );
}
