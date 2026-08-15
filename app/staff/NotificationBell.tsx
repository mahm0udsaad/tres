"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, X, XCircle } from "lucide-react";
import { localeFor, t, type Lang } from "../lib/staff-i18n";
import { markNotificationsRead } from "./actions";

export type StaffNotification = {
  id: string;
  kind: "task_review" | "report_review";
  entity_type: "task" | "cleaning" | "barista" | "kitchen";
  decision: "approved" | "rejected";
  title: string;
  note: string | null;
  created_at: string;
};

function headline(notification: StaffNotification, lang: Lang) {
  const subject = notification.kind === "task_review" ? "task" : "report";
  return t(`notif_${subject}_${notification.decision}`, lang);
}

/**
 * The employee's verdict inbox. It sits in the top bar so a rejection reaches
 * them at the start of the next shift, whatever screen they land on.
 */
export default function NotificationBell({
  notifications,
  lang,
}: {
  notifications: StaffNotification[];
  lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const unread = cleared ? 0 : notifications.length;

  // Closing the panel is what marks them read — opening alone is not proof the
  // employee took them in, but dismissing is.
  function close() {
    setOpen(false);
    if (notifications.length && !cleared) {
      setCleared(true);
      startTransition(() => { void markNotificationsRead(); });
    }
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="staff-bell" ref={panelRef}>
      <button
        type="button"
        className="staff-bell-button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label={
          unread
            ? `${t("notifications", lang)} — ${t("notifications_unread", lang, { count: unread })}`
            : t("notifications", lang)
        }
      >
        <Bell />
        {unread ? <span className="staff-bell-badge">{unread}</span> : null}
      </button>

      {open ? (
        <>
          <div className="staff-bell-backdrop" role="presentation" onMouseDown={close} />
          <div className="staff-bell-panel" role="dialog" aria-modal="true" aria-label={t("notifications", lang)}>
            <header>
              <strong>{t("notifications", lang)}</strong>
              <button type="button" onClick={close} aria-label={t("notifications_mark_read", lang)}>
                <X />
              </button>
            </header>

            {notifications.length ? (
              <ul>
                {notifications.map((notification) => (
                  <li key={notification.id} data-decision={notification.decision}>
                    {notification.decision === "approved" ? <CheckCircle2 /> : <XCircle />}
                    <div>
                      <strong>{headline(notification, lang)}</strong>
                      <p className="staff-bell-subject">{notification.title}</p>
                      {notification.note ? <p className="staff-bell-note">{notification.note}</p> : null}
                      <time dateTime={notification.created_at}>
                        {new Intl.DateTimeFormat(localeFor(lang), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(notification.created_at))}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="staff-bell-empty">{t("notifications_empty", lang)}</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
