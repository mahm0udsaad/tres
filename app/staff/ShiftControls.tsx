"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Camera,
  Check,
  CircleAlert,
  Coffee,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  MessageSquareText,
} from "lucide-react";
import type { AttendanceRecord, Gamification, StaffTask } from "../lib/staff-shared";
import { localeFor, t, type Lang } from "../lib/staff-i18n";
import PhotoCapture from "./PhotoCapture";
import { completeChecklistTask, staffOperation } from "./actions";

/** Task types the employee ticks off by hand; everything else is completed by
 *  submitting its daily form. */
const MANUAL_TASK_TYPES = new Set(["general_duty", "checklist"]);

const PENDING_BREAK_STORAGE_KEY = "tres:pending-break:v1";
type BreakOperation = "start_break" | "end_break";

function savedBreakOperation(): BreakOperation | null {
  try {
    const value = window.localStorage.getItem(PENDING_BREAK_STORAGE_KEY);
    return value === "start_break" || value === "end_break" ? value : null;
  } catch {
    return null;
  }
}

type Props = {
  attendance: AttendanceRecord | null;
  tasks: StaffTask[];
  gamification: Gamification;
  lang: Lang;
};

function hoursSince(iso: string, lang: Lang) {
  const hours = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
  return hours.toLocaleString(localeFor(lang), { maximumFractionDigits: 1 });
}

function breakTimer(seconds: number) {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export default function ShiftControls({
  attendance,
  tasks,
  gamification,
  lang,
}: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(staffOperation, undefined);
  const [photoState, photoAction, photoPending] = useActionState(completeChecklistTask, undefined);
  const [locationPending, setLocationPending] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [elapsedHours, setElapsedHours] = useState<string | null>(null);
  const [breakElapsedSeconds, setBreakElapsedSeconds] = useState(0);
  const [photoTaskId, setPhotoTaskId] = useState<string | null>(null);
  const [noteTaskId, setNoteTaskId] = useState<string | null>(null);
  const [taskNote, setTaskNote] = useState("");
  const [online, setOnline] = useState(true);
  const [pendingBreak, setPendingBreak] = useState<BreakOperation | null>(null);
  const pendingBreakSentRef = useRef(false);

  const submit = useCallback((operation: string, extras?: Record<string, string>) => {
    const form = new FormData();
    form.set("operation", operation);
    Object.entries(extras ?? {}).forEach(([key, value]) => form.set(key, value));
    startTransition(() => action(form));
  }, [action]);

  const savePendingBreak = useCallback((operation: BreakOperation | null) => {
    setPendingBreak(operation);
    pendingBreakSentRef.current = false;
    try {
      if (operation) window.localStorage.setItem(PENDING_BREAK_STORAGE_KEY, operation);
      else window.localStorage.removeItem(PENDING_BREAK_STORAGE_KEY);
    } catch {
      // The break action still works when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (!attendance) {
      setElapsedHours(null);
      return;
    }
    const update = () => setElapsedHours(hoursSince(attendance.start_time, lang));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [attendance, lang]);

  useEffect(() => {
    if (!attendance?.break_started_at || attendance.break_ended_at) {
      setBreakElapsedSeconds(0);
      return;
    }

    const startedAt = new Date(attendance.break_started_at).getTime();
    const update = () => {
      setBreakElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1_000)));
    };
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [attendance?.break_ended_at, attendance?.break_started_at]);

  useEffect(() => {
    const updateOnlineState = () => {
      if (navigator.onLine) pendingBreakSentRef.current = false;
      setOnline(navigator.onLine);
    };
    updateOnlineState();
    setPendingBreak(savedBreakOperation());
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (state?.operation === "end_shift" && state.result?.ok === true) {
      setShowSuccess(true);
      const timer = window.setTimeout(() => setShowSuccess(false), 7000);
      return () => window.clearTimeout(timer);
    }
  }, [state]);

  useEffect(() => {
    if (!pendingBreak || !online || pending || pendingBreakSentRef.current) return;
    pendingBreakSentRef.current = true;
    submit(pendingBreak);
  }, [online, pending, pendingBreak, submit]);

  useEffect(() => {
    const operation = state?.operation as BreakOperation | undefined;
    if (operation !== "start_break" && operation !== "end_break") return;

    if (state?.result?.ok === true) {
      savePendingBreak(null);
      router.refresh();
      return;
    }

    // A response can be lost after the database saved the break. Replaying the
    // same action then returns one of these idempotency codes, so refresh the
    // dashboard instead of making the employee retry or sign in again.
    const code = String(state?.result?.code ?? "");
    if (
      (operation === "start_break" && code === "break_already_active") ||
      (operation === "end_break" && code === "break_already_ended")
    ) {
      savePendingBreak(null);
      router.refresh();
    }
  }, [router, savePendingBreak, state]);

  function requestBreak(operation: BreakOperation) {
    savePendingBreak(operation);
    if (!navigator.onLine) {
      setOnline(false);
      return;
    }
    pendingBreakSentRef.current = true;
    submit(operation);
  }

  function locateAndSubmit(operation: "start_shift" | "end_shift") {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError(t("geo_unsupported", lang));
      return;
    }
    setLocationPending(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }: GeolocationPosition) => {
        setLocationPending(false);
        submit(operation, {
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
          accuracy: String(coords.accuracy),
        });
      },
      (error) => {
        setLocationPending(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED ? t("geo_denied", lang) : t("geo_unavailable", lang),
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 15_000 },
    );
  }

  function completeWithPhoto(taskId: string, file: File) {
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("photo", file);
    setPhotoTaskId(null);
    startTransition(() => photoAction(form));
  }

  const busy = pending || locationPending;
  const taskBusy = pending || photoPending;
  const breakActive = Boolean(attendance?.break_started_at && !attendance.break_ended_at);
  const breakMinutesUsed = attendance?.break_duration_minutes ?? 0;
  const breakMinutesAllowed = attendance?.break_entitlement_minutes ?? 60;
  const breakMinutesRemaining = Math.max(0, breakMinutesAllowed - breakMinutesUsed);
  const liveBreakSecondsRemaining = Math.max(
    0,
    breakMinutesRemaining * 60 - breakElapsedSeconds,
  );
  const done = tasks.filter((task) => task.completed).length;
  const remaining = tasks.filter((task) => task.is_required && !task.completed).length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  // ── Before the shift: one screen, one button ────────────────────────────
  if (!attendance) {
    return (
      <>
        <section className="staff-hero">
          <p className="staff-hero-state">{t("ready_to_start", lang)}</p>
          <button
            type="button"
            className="staff-hero-button"
            onClick={() => locateAndSubmit("start_shift")}
            disabled={busy}
          >
            {busy ? <LoaderCircle className="spin" /> : <LogIn />}
            <span>{t("start_shift", lang)}</span>
          </button>
          <p className="staff-hero-hint">
            <MapPin /> {t("start_hint", lang)}
          </p>
          {locationError ? <p className="staff-inline-error">{locationError}</p> : null}
          {state?.error ? (
            <div className="staff-alert staff-alert--error" role="alert">
              <CircleAlert />
              <span>{state.error}</span>
            </div>
          ) : null}
        </section>
        <RewardStrip gamification={gamification} lang={lang} />
      </>
    );
  }

  // An active break is deliberately a single-purpose screen. Employees only
  // see the elapsed time and the action that returns them to their shift.
  if (breakActive) {
    return (
      <section className="staff-break-screen" aria-live="polite">
        <div className="staff-break-clock" aria-label={t("break_elapsed", lang)}>
          <Coffee aria-hidden="true" />
          <p>{t("break_in_progress", lang)}</p>
          <time dir="ltr" dateTime={`PT${breakElapsedSeconds}S`}>
            {breakTimer(breakElapsedSeconds)}
          </time>
          <span className="staff-break-remaining">
            {t("break_remaining_live", lang, {
              count: Math.ceil(liveBreakSecondsRemaining / 60),
            })}
          </span>
        </div>

        {(state?.operation === "start_break" || state?.operation === "end_break") && state?.error ? (
          <p className="staff-inline-error" role="alert">{state.error}</p>
        ) : null}
        {!online ? <p className="staff-connection-message" role="status">{t("break_offline", lang)}</p> : null}
        {pendingBreak && online ? <p className="staff-connection-message" role="status">{t("break_saving", lang)}</p> : null}

        <button
          type="button"
          className="staff-break-end-button"
          onClick={() => requestBreak("end_break")}
          disabled={pending || Boolean(pendingBreak)}
        >
          {pending || pendingBreak ? <LoaderCircle className="spin" /> : null}
          <span>{pending || pendingBreak ? t("break_saving", lang) : t("break_end", lang)}</span>
        </button>
      </section>
    );
  }

  // ── During the shift: progress, what's left, the forms, then finish ─────
  return (
    <>
      {showSuccess ? (
        <section className="staff-success" role="status">
          <div className="staff-success-icon">
            <Award />
          </div>
          <h2>{t("ok_shift_ended", lang)}</h2>
          <div>
            <span>
              {String(state?.result?.hours_worked ?? 0)} {t("hour_short", lang)}
            </span>
            <span>
              +{String(state?.result?.points_earned ?? 0)} {t("total_points", lang)}
            </span>
            <span>
              {String(state?.result?.streak_count ?? 1)} {t("streak_days", lang)}
            </span>
          </div>
        </section>
      ) : null}

      <section className="staff-running">
        <div className="staff-running-top">
          <span className="staff-live">
            <i /> {t("shift_running", lang)}
          </span>
          <strong suppressHydrationWarning>
            {elapsedHours ?? "—"} <small>{t("hour_short", lang)}</small>
          </strong>
        </div>
        {attendance.supervisor_override_by ? (
          <span className="staff-override-badge">{t("manual_by_supervisor", lang)}</span>
        ) : null}
        <div className="staff-progress" role="img" aria-label={`${done}/${tasks.length}`}>
          <i style={{ width: `${progress}%` }} />
        </div>
        <p className="staff-running-left">
          {remaining ? t("items_left", lang, { count: remaining }) : t("all_done", lang)}
        </p>
      </section>

      {tasks.length ? (
        <section className="staff-block-card">
          <h2 className="staff-block-title">
            <Check /> {t("step_tasks", lang)}
            <span className="staff-count">
              {done}/{tasks.length}
            </span>
          </h2>
          {photoState?.error ? (
            <p className="staff-inline-error" role="alert">
              {photoState.error}
            </p>
          ) : null}
          <ul className="staff-todo">
            {tasks.map((task) => {
              const manual = MANUAL_TASK_TYPES.has(task.task_type);
              const needsPhoto = task.requires_photo && !task.completed;
              const open = photoTaskId === task.id;
              return (
                <li key={task.id} data-completed={task.completed}>
                  <div className="staff-todo-row">
                    <span className="staff-todo-mark" data-on={task.completed}>
                      {task.completed ? <Check /> : null}
                    </span>
                    <span className="staff-todo-title">{task.title}</span>
                    {task.notes ? <span className="staff-todo-notes">{task.notes}</span> : null}

                    {task.completed ? null : manual && task.response_type === "yes_no" ? (
                      <div className="staff-todo-yes-no"><button type="button" className="staff-secondary" disabled={taskBusy} onClick={() => submit("complete_task", { task_id: task.id, task_yes_no_answer: "true" })}>{t("answer_yes", lang)}</button><button type="button" className="staff-secondary" disabled={taskBusy} onClick={() => submit("complete_task", { task_id: task.id, task_yes_no_answer: "false" })}>{t("answer_no", lang)}</button></div>
                    ) : manual && needsPhoto ? (
                      <button
                        type="button"
                        className="staff-todo-action"
                        onClick={() => setPhotoTaskId(open ? null : task.id)}
                        disabled={taskBusy}
                        aria-expanded={open}
                        aria-label={t("attach_photo_label", lang, { title: task.title })}
                      >
                        {taskBusy ? <LoaderCircle className="spin" /> : <Camera />}
                      </button>
                    ) : manual && task.requires_note ? (
                      <button type="button" className="staff-todo-action staff-todo-action--go" onClick={() => { setNoteTaskId(noteTaskId === task.id ? null : task.id); setTaskNote(""); }} disabled={taskBusy} aria-label={t("add_task_note_label", lang, { title: task.title })}><MessageSquareText /></button>
                    ) : manual ? (
                      <button
                        type="button"
                        className="staff-todo-action staff-todo-action--go"
                        onClick={() => submit("complete_task", { task_id: task.id })}
                        disabled={taskBusy}
                        aria-label={t("complete_label", lang, { title: task.title })}
                      >
                        <Check />
                      </button>
                    ) : null}
                  </div>
                  {open ? (
                    <div className="staff-todo-photo">
                      <PhotoCapture
                        lang={lang}
                        busy={taskBusy}
                        onConfirm={(file) => completeWithPhoto(task.id, file)}
                      />
                    </div>
                  ) : null}
                  {noteTaskId === task.id ? <div className="staff-todo-note-entry"><textarea value={taskNote} onChange={(event) => setTaskNote(event.target.value)} maxLength={1000} rows={3} placeholder={t("task_note_placeholder", lang)} /><button type="button" className="staff-primary" disabled={taskBusy || !taskNote.trim()} onClick={() => { setNoteTaskId(null); submit("complete_task", { task_id: task.id, task_note: taskNote.trim() }); }}>{t("task_note_submit", lang)}</button></div> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="staff-block-card staff-break-row">
        <h2 className="staff-block-title">
          <Coffee /> {t("break", lang)}
          <span className="staff-count">{breakMinutesUsed}/{breakMinutesAllowed}</span>
        </h2>
        {breakMinutesRemaining === 0 ? (
          <button type="button" className="staff-choice" disabled>
            {t("break_allowance_finished", lang)}
          </button>
        ) : (
          <button
            type="button"
            className="staff-choice"
            data-on={breakActive}
            onClick={() => requestBreak(breakActive ? "end_break" : "start_break")}
            disabled={pending || Boolean(pendingBreak)}
          >
            {pendingBreak ? <LoaderCircle className="spin" /> : null}
            {pendingBreak
              ? t("break_saving", lang)
              : t("break_start_with_remaining", lang, {
                  count: breakMinutesRemaining,
                })}
          </button>
        )}
        {breakMinutesUsed > 0 && breakMinutesRemaining > 0 ? (
          <p className="staff-break-summary">
            {t("break_used_and_remaining", lang, {
              used: breakMinutesUsed,
              remaining: breakMinutesRemaining,
            })}
          </p>
        ) : null}
        {!online ? <p className="staff-connection-message" role="status">{t("break_offline", lang)}</p> : null}
        {pendingBreak && online ? <p className="staff-connection-message" role="status">{t("break_saving", lang)}</p> : null}
        {(state?.operation === "start_break" || state?.operation === "end_break") && state?.error ? (
          <p className="staff-inline-error" role="alert">{state.error}</p>
        ) : null}
      </section>

      <RewardStrip gamification={gamification} lang={lang} />

      <div className="staff-finish-bar">
        {locationError ? <p className="staff-inline-error">{locationError}</p> : null}
        {state?.error && state.operation !== "start_break" && state.operation !== "end_break" ? (
          <div className="staff-alert staff-alert--error" role="alert">
            <CircleAlert />
            <span>{state.error}</span>
          </div>
        ) : null}
        <button
          type="button"
          className="staff-finish-button"
          data-blocked={remaining > 0}
          onClick={() => locateAndSubmit("end_shift")}
          disabled={busy}
        >
          {busy ? <LoaderCircle className="spin" /> : <LogOut />}
          <span>{t("end_shift", lang)}</span>
          {remaining ? <small>{t("items_left", lang, { count: remaining })}</small> : null}
        </button>
      </div>
    </>
  );
}

function RewardStrip({ gamification, lang }: { gamification: Gamification; lang: Lang }) {
  return (
    <section className="staff-reward-strip">
      <Award />
      <strong>{gamification.points}</strong>
      <span>{t("total_points", lang)}</span>
      <em>
        {gamification.streak_count} {t("streak_days", lang)}
      </em>
    </section>
  );
}
