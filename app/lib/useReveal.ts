"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Scroll-reveal + mouse-parallax for a subtree.
 * Observes [data-reveal] (with optional [data-reveal-delay] in ms) and
 * translates [data-parallax] elements on mouse move.
 */
export function useReveal(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            const d = el.getAttribute("data-reveal-delay") || "0";
            el.style.transition = `opacity .85s ease ${d}ms, transform .85s cubic-bezier(.2,.7,.2,1) ${d}ms`;
            el.classList.add("is-visible");
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

    const onMove = (ev: MouseEvent) => {
      const mx = ev.clientX / window.innerWidth - 0.5;
      const my = ev.clientY / window.innerHeight - 0.5;
      root.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        const s = parseFloat(el.getAttribute("data-parallax") || "10") || 10;
        el.style.transform = `translate(${-mx * s}px,${-my * s}px)`;
      });
    };
    window.addEventListener("mousemove", onMove);

    return () => {
      io.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, [rootRef]);
}
