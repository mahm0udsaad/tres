"use client";

import { useEffect, useState } from "react";
import type { HoursRow } from "../lib/data";

/** JS getDay(): 0 = Sunday. The settings rows start at Saturday. */
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0];

function minutes(hhmm?: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/** Open right now, in the store's own timezone — not the visitor's. */
function openNow(hours: HoursRow[]): boolean | null {
  if (!hours.length) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date());
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const jsDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  if (jsDay < 0) return null;

  const today = hours[DAY_INDEX[jsDay]];
  if (!today || today.closed) return false;

  const from = minutes(today.open);
  const to = minutes(today.close);
  if (from == null || to == null) return false;

  const now = hh * 60 + mm;
  // a closing time past midnight (e.g. 07:00 → 02:00) wraps around
  return to > from ? now >= from && now < to : now >= from || now < to;
}

/**
 * The open / closed badge. Worked out in the browser, not on the server: the
 * page around it is cached, so a server-rendered answer would be as old as the
 * cache. Renders nothing until mounted, and re-checks every minute so a tab
 * left open flips at opening and closing time.
 */
export default function OpenState({ hours, plain = false }: { hours: HoursRow[]; plain?: boolean }) {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setOpen(openNow(hours));
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [hours]);

  if (open == null) return null;
  return (
    <span className={"find-state" + (plain ? " find-state--plain" : "")} data-open={open}>
      <i />
      {open ? "نستقبلكم الآن" : "مغلق حالياً"}
    </span>
  );
}
