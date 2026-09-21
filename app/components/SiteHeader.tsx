"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ND_SLOGAN } from "../lib/national";
import type { ThemeId } from "../lib/data";

const NAV: { href: string; label: string; soon?: boolean }[] = [
  { href: "/", label: "الرئيسية" },
  { href: "/menu", label: "المنيو" },
  { href: "/#story", label: "قصتنا" },
  { href: "/complaints", label: "الشكاوى" },
];

const DEFAULT_ANNOUNCE = "يا هلا في تريس";

export default function SiteHeader({
  announcement,
  theme = "classic",
}: {
  announcement?: string;
  theme?: ThemeId;
}) {
  // The National Day skin leads with the year's slogan (§1.1) unless the owner
  // has written their own announcement in the control panel.
  const fallback = theme === "national" ? ND_SLOGAN : DEFAULT_ANNOUNCE;
  const navRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => {
      const nav = navRef.current;
      if (!nav) return;
      // Toggle a state attribute and let CSS pick the colours, so each theme
      // (classic / summer) styles the scrolled nav from its own stylesheet.
      nav.dataset.scrolled = window.scrollY > 20 ? "true" : "false";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="announce">
        {announcement || fallback}
      </div>
      <div ref={navRef} className="nav">
        <div className="nav-inner">
          <Link href="/" className="logo">
            <span className="logo-ar">تريس</span>
            <span className="logo-en">TRES</span>
          </Link>
          <div className="nav-links">
            {NAV.map((l) =>
              l.soon ? (
                <span
                  key={l.href}
                  className="nav-link muted soon"
                  aria-disabled="true"
                  title="قريبًا"
                >
                  {l.label}
                </span>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  className={"nav-link" + (pathname === l.href ? "" : " muted")}
                >
                  {l.label}
                </Link>
              )
            )}
            <Link href="/menu" className="btn btn-blush nav-link">
              شوف المنيو
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
