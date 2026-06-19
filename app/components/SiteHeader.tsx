"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const NAV: { href: string; label: string; soon?: boolean }[] = [
  { href: "/", label: "الرئيسية" },
  { href: "/menu", label: "المنيو" },
  { href: "/#story", label: "قصتنا" },
  { href: "/complaints", label: "الشكاوى" },
];

export default function SiteHeader() {
  const navRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => {
      const nav = navRef.current;
      if (!nav) return;
      if (window.scrollY > 20) {
        nav.style.background = "rgba(90,10,32,.92)";
        nav.style.boxShadow = "0 10px 30px -18px rgba(0,0,0,.6)";
      } else {
        nav.style.background = "rgba(112,13,40,.72)";
        nav.style.boxShadow = "none";
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="announce">
        يا هلا في تريس، قهوة مختصة بثلاثة محاصيل من الطائف
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
