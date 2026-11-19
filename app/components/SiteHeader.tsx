"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ND_SLOGAN } from "../lib/national";
import { WN_SLOGAN } from "../lib/winter";
import type { ThemeId } from "../lib/data";

const NAV: { href: string; label: string; soon?: boolean }[] = [
  { href: "/", label: "الرئيسية" },
  { href: "/menu", label: "المنيو" },
  { href: "/catering", label: "كاترينغ" },
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
  // The seasonal skins lead with their own line unless the owner has written
  // an announcement in the control panel.
  const fallback =
    theme === "national" ? ND_SLOGAN : theme === "winter" ? WN_SLOGAN : DEFAULT_ANNOUNCE;
  // The winter skin's home page is the tile screen (app/WinterHome.tsx); it has
  // no #story section, so that link would go nowhere. Drop it on this skin.
  const links = theme === "winter" ? NAV.filter((l) => l.href !== "/#story") : NAV;
  const navRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // Under 560px the link row is hidden — without this sheet the only way off
  // the page was the menu button, so every other link was unreachable.
  const [open, setOpen] = useState(false);

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

  // Close on navigation, and on Escape while it is open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

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
            {links.map((l) =>
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

          <button
            type="button"
            className="nav-burger"
            aria-label={open ? "إغلاق القائمة" : "القائمة"}
            aria-expanded={open}
            aria-controls="nav-sheet"
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* mobile sheet */}
      <div
        className="nav-sheet-backdrop"
        data-open={open || undefined}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <nav id="nav-sheet" className="nav-sheet" data-open={open || undefined} aria-label="القائمة">
        {links.map((l) =>
          l.soon ? (
            <span key={l.href} className="nav-sheet-link is-soon" aria-disabled="true">
              {l.label}
              <small>قريبًا</small>
            </span>
          ) : (
            <Link
              key={l.href}
              href={l.href}
              className="nav-sheet-link"
              data-active={pathname === l.href || undefined}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ),
        )}
        <Link href="/menu" className="btn btn-blush nav-sheet-cta" onClick={() => setOpen(false)}>
          شوف المنيو
        </Link>
      </nav>
    </>
  );
}
