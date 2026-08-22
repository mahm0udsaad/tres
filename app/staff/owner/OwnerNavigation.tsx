"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck2, FileCheck2, Home, KeyRound, ListTodo, MessageSquareText, Users } from "lucide-react";
import OwnerThemeToggle from "./OwnerThemeToggle";

const NAV_ITEMS = [
  { href: "/staff/owner", label: "الرئيسية", icon: Home, exact: true },
  { href: "/staff/owner/team", label: "الموظفون", icon: Users, exact: false },
  { href: "/staff/owner/attendance", label: "الحضور", icon: CalendarCheck2, exact: false },
  { href: "/staff/checklist", label: "المهام", icon: ListTodo, exact: false },
  { href: "/staff/reports", label: "التقارير", icon: FileCheck2, exact: false },
  { href: "/staff/owner/notes", label: "الملاحظات", icon: MessageSquareText, exact: false },
  { href: "/staff/account", label: "حسابي", icon: KeyRound, exact: false },
] as const;

export default function OwnerNavigation({
  variant = "sidebar",
  dashboardOnly = false,
}: {
  variant?: "sidebar" | "bar";
  dashboardOnly?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={variant === "bar" ? "owner-route-nav" : "owner-nav"}
      aria-label="تنقل المالك"
    >
      {NAV_ITEMS.filter(({ href }) => !dashboardOnly || href === "/staff/owner" || href === "/staff/account").map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            className={active ? "is-active" : undefined}
            href={href}
            aria-current={active ? "page" : undefined}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
      {variant === "bar" ? (
        <span className="owner-route-theme">
          <OwnerThemeToggle />
        </span>
      ) : null}
    </nav>
  );
}
