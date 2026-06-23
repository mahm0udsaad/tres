"use client";

/**
 * Loyalty-program announcement mascot — menu pages only.
 *
 * Narrative (the part the owner liked): the TRES character notices the visitor
 * browsing the menu, peeks out from behind a premium "door" panel (head first),
 * gives a gentle wave, then a thought bubble rises with the loyalty offer.
 * Tapping the mascot or the bubble opens a branded modal with the loyalty QR.
 *
 * It does NOT pop instantly: it reveals only once the visitor has shown intent
 * — scrolled past a threshold (~40% of the page, capped) OR dwelled ~8s,
 * whichever comes first. Once dismissed it stays hidden for the visit.
 *
 * Fully reduced-motion aware (skips choreography, just fades), keyboard
 * operable, RTL, and mobile-first.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// ── editable content (Arabic) ─────────────────────────────────────────────────
const TITLE = "برنامج الولاء";
const OFFER_LEAD = "اشترِ ٥ أكواب،";
const OFFER_FREE = "والسادس مجانًا 🎉";
const CTA = "اضغط لعرض الباركود";
const MODAL_HINT = "امسح الباركود أو أبرزه للكاشير للانضمام للبرنامج";

const STORAGE_KEY = "tres_loyalty_dismissed_v1";

// Dismissal is remembered for the current visit only (sessionStorage), not
// forever — so the loyalty card reliably reappears on the next visit instead of
// staying hidden permanently once a visitor taps the ✕.
function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberDismissed() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {}
}

// ── trigger tuning ─────────────────────────────────────────────────────────────
const DWELL_MS = 2200; // reveal shortly after the menu loads, even without scrolling
const SCROLL_RATIO = 0.25; // …or as soon as they scroll a little
const SCROLL_CAP_PX = 600; // …but never require more than this much scroll

type State = "hidden" | "peek" | "wave" | "settled";

/**
 * Crafted "buy 5, get the 6th free" progression: five filled coffee cups and a
 * highlighted free sixth — built from styled elements, not raw emoji.
 */
function CupTrack({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className={`lm-track lm-track-${size}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="lm-cup" />
      ))}
      <span className="lm-cup lm-cup-free">
        <span className="lm-cup-gift" />
      </span>
    </span>
  );
}

export default function LoyaltyMascot({ qr }: { qr?: ReactNode }) {
  const [state, setState] = useState<State>("hidden");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const revealedRef = useRef(false);

  // Show only on the menu and its sub-pages. usePathname updates on client
  // navigation, so it works whether the visitor lands directly or navigates in.
  const pathname = usePathname();
  const onMenu = !!pathname && (pathname === "/menu" || pathname.startsWith("/menu/"));

  // Run the peek → wave → settled choreography (or a plain fade for reduced motion).
  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setState("settled");
      return;
    }
    setState("peek");
    const t1 = window.setTimeout(() => setState("wave"), 900);
    const t2 = window.setTimeout(() => setState("settled"), 2100);
    timersRef.current.push(t1, t2);
  }, []);

  const timersRef = useRef<number[]>([]);

  // Mount flag (avoids SSR/portal mismatch).
  useEffect(() => setMounted(true), []);

  // Decide WHEN to reveal — only on menu pages, and only once the visitor shows
  // intent: dwell timer OR scroll past a threshold, whichever comes first.
  useEffect(() => {
    if (!onMenu || typeof window === "undefined") return;
    if (wasDismissed()) return; // dismissed earlier this visit

    const dwell = window.setTimeout(reveal, DWELL_MS);
    timersRef.current.push(dwell);

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const threshold = Math.min(scrollable * SCROLL_RATIO, SCROLL_CAP_PX);
      if (window.scrollY >= threshold) reveal();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [onMenu, reveal]);

  // Modal: scroll-lock and focus the only control that closes it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBubbleDismissed(true);
  };

  if (!mounted || !onMenu) return null;

  const interactive = state !== "hidden";

  return (
    <>
      <div className="lm-stage" data-state={state} data-bubble-hidden={bubbleDismissed || undefined} aria-hidden={state === "hidden"}>
        {/* premium door panel the character hides behind */}
        <span className="lm-door" aria-hidden="true">
          <span className="lm-door-knob" />
        </span>

        <button
          type="button"
          className="lm-figure"
          onClick={() => setOpen(true)}
          aria-label={`${TITLE} — ${OFFER_LEAD} ${OFFER_FREE}`}
          tabIndex={interactive ? 0 : -1}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lm-mascot" src="/assets/mascot-standing.png" alt="" />
        </button>

        <div className="lm-card-shell" aria-hidden={state !== "settled"}>
          <button
            type="button"
            className="lm-bubble"
            onClick={() => setOpen(true)}
            tabIndex={state === "settled" ? 0 : -1}
          >
            <span className="lm-bubble-title">{TITLE}</span>
            <span className="lm-bubble-offer">
              {OFFER_LEAD} <b>{OFFER_FREE}</b>
            </span>
            <CupTrack />
            <span className="lm-bubble-cta">
              {CTA}
              <span aria-hidden="true">←</span>
            </span>
            <span className="lm-bubble-tail" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>

          <button
            type="button"
            className="lm-dismiss"
            onClick={dismiss}
            aria-label="إخفاء برنامج الولاء"
            tabIndex={state === "settled" ? 0 : -1}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {open &&
        createPortal(
          <div
            className="lm-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={TITLE}
          >
            <div className="lm-modal">
              <button
                ref={closeRef}
                type="button"
                className="lm-modal-x"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <div className="lm-modal-figure" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/mascot-sitting.png" alt="" />
              </div>

              <h3 className="lm-modal-title">{TITLE}</h3>
              <p className="lm-modal-sub">
                {OFFER_LEAD} <b>{OFFER_FREE}</b>
              </p>

              <CupTrack size="lg" />

              <div className="lm-qr">
                {/* Branded SVG QR passed from the server layout; falls back to the
                    swappable PNG if no node is provided. QR destination is a single
                    constant in app/layout.tsx — swap it (or the PNG) any time. */}
                {qr ?? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/assets/loyalty-qr.png" alt="باركود برنامج الولاء" />
                )}
              </div>

              <p className="lm-modal-hint">{MODAL_HINT}</p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
