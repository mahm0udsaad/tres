"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  FileCheck2,
  LayoutDashboard,
  ShieldCheck,
  Store,
  Users,
  UserPlus,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "overview", label: "لوحة المدير", icon: LayoutDashboard },
  { id: "operations", label: "التشغيل", icon: Activity },
  { id: "branches", label: "الفروع", icon: Store },
  { id: "team", label: "الموظفون", icon: Users },
  { id: "quality", label: "الجودة", icon: ShieldCheck },
  { id: "reports", label: "التقارير", icon: FileCheck2 },
  { id: "alerts", label: "التنبيهات", icon: Bell },
] as const;

type SectionId = (typeof NAV_ITEMS)[number]["id"];

const SECTION_IDS = new Set<SectionId>(NAV_ITEMS.map((item) => item.id));

function sectionFromHash(): SectionId {
  const hash = window.location.hash.slice(1) as SectionId;
  return SECTION_IDS.has(hash) ? hash : "overview";
}

export default function OwnerNavigation() {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  useEffect(() => {
    const syncWithHash = () => setActiveSection(sectionFromHash());
    syncWithHash();
    window.addEventListener("hashchange", syncWithHash);
    return () => window.removeEventListener("hashchange", syncWithHash);
  }, []);

  return (
    <nav className="owner-nav" aria-label="أقسام لوحة المالك">
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
        <a
          key={id}
          className={activeSection === id ? "is-active" : undefined}
          href={`#${id}`}
          aria-current={activeSection === id ? "location" : undefined}
          onClick={() => setActiveSection(id)}
        >
          <Icon />
          {label}
        </a>
      ))}
      <a className="owner-nav-accounts" href="/staff/owner/team">
        <UserPlus />
        إدارة حسابات الموظفين
      </a>
    </nav>
  );
}
