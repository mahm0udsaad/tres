"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import {
  Award,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Coffee,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  MessageSquareText,
} from "lucide-react";
import type { AttendanceRecord, Gamification, StaffRole, StaffTask } from "../lib/staff-shared";
import { localeFor, t, type Lang } from "../lib/staff-i18n";
import DailyReport, { type ReportStatus } from "./DailyReport";
import PhotoCapture from "./PhotoCapture";
import { completeChecklistTask, staffOperation } from "./actions";

/** Task types the employee ticks off by hand; everything else is completed by
 *  submitting its daily form. */
const MANUAL_TASK_TYPES = new Set(["general_duty", "checklist"]);

/** Which inline form finishes a given seeded task, so an incomplete row can
 *  jump straight to it instead of the employee discovering it by failing. */
const TASK_ANCHOR: Record<string, string> = {
  cleaning_report: "report-cleaning",
  cleaning_photos: "report-cleaning",
  barista_report: "report-barista",
  bar_clean_confirmation: "report-barista",
  kitchen_report: "report-kitchen",
  kitchen_photos: "report-kitchen",
  inventory_count: "report-kitchen",
};

type Props = {
  attendance: AttendanceRecord | null;
  tasks: StaffTask[];
  gamification: Gamification;
  lang: Lang;
  role: StaffRole;
  reports: { cleaning: ReportStatus; barista: ReportStatus; kitchen: ReportStatus };
  latestWater: { salt_ratio: number } | null;
  beverageConsumed: boolean | null;
};

function hoursSince(iso: string, lang: Lang) {
  const hours = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
  return hours.toLocaleString(localeFor(lang), { maximumFractionDigits: 1 });
}

export default function ShiftControls({
  attendance,
  tasks,
  gamification,
  lang,
  role,
  reports,
  latestWater,
  beverageConsumed,
}: Props) {
  const [state, action, pending] = useActionState(staffOperation, undefined);
  const [photoState, photoAction, photoPending] = useActionState(completeChecklistTask, undefined);
  const [locationPending, setLocationPending] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [elapsedHours, setElapsedHours] = useState<string | null>(null);
  const [photoTaskId, setPhotoTaskId] = useState<string | null>(null);
  const [noteTaskId, setNoteTaskId] = useState<string | null>(null);
  const [taskNote, setTaskNote] = useState("");

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
    if (state?.operation === "end_shift" && state.result?.ok === true) {
      setShowSuccess(true);
      const timer = window.setTimeout(() => setShowSuccess(false), 7000);
      return () => window.clearTimeout(timer);
    }
  }, [state]);

  function submit(operation: string, extras?: Record<string, string>) {
    const form = new FormData();
    form.set("operation", operation);
    Object.entries(extras ?? {}).forEach(([key, value]) => form.set(key, value));
    startTransition(() => action(form));
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
  const done = tasks.filter((task) => task.completed).length;
  const remaining = tasks.filter((task) => task.is_required && !task.completed).length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const Chevron = lang === "ar" ? ChevronLeft : ChevronRight;

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

      <DailyReport
        role={role}
        lang={lang}
        reports={reports}
        latestWater={latestWater}
        beverageConsumed={beverageConsumed}
      />

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
              const anchor = TASK_ANCHOR[task.task_type];
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
                      <div className="staff-todo-yes-no"><button type="button" className="staff-secondary" disabled={taskBusy} onClick={() => submit("complete_task", { task_id: task.id, task_yes_no_answer: "true" })}>نعم</button><button type="button" className="staff-secondary" disabled={taskBusy} onClick={() => submit("complete_task", { task_id: task.id, task_yes_no_answer: "false" })}>لا</button></div>
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
                      <button type="button" className="staff-todo-action staff-todo-action--go" onClick={() => { setNoteTaskId(noteTaskId === task.id ? null : task.id); setTaskNote(""); }} disabled={taskBusy} aria-label="إضافة ملاحظة لإكمال المهمة"><MessageSquareText /></button>
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
                    ) : anchor ? (
                      <a className="staff-todo-action" href={`#${anchor}`} aria-label={task.title}>
                        <Chevron />
                      </a>
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
                  {noteTaskId === task.id ? <div className="staff-todo-note-entry"><textarea value={taskNote} onChange={(event) => setTaskNote(event.target.value)} maxLength={1000} rows={3} placeholder="اكتب ملاحظتك قبل إكمال المهمة" /><button type="button" className="staff-primary" disabled={taskBusy || !taskNote.trim()} onClick={() => { setNoteTaskId(null); submit("complete_task", { task_id: task.id, task_note: taskNote.trim() }); }}>إرسال الملاحظة وإكمال المهمة</button></div> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="staff-block-card staff-break-row">
        <h2 className="staff-block-title">
          <Coffee /> {t("break", lang)}
          <span className="staff-count">{attendance.break_duration_minutes}/60</span>
        </h2>
        {attendance.break_ended_at ? (
          <button type="button" className="staff-choice" disabled>
            {t("break_done", lang)}
          </button>
        ) : (
          <button
            type="button"
            className="staff-choice"
            data-on={breakActive}
            onClick={() => submit(breakActive ? "end_break" : "start_break")}
            disabled={pending}
          >
            {breakActive ? t("break_end", lang) : t("break_start", lang)}
          </button>
        )}
      </section>

      <RewardStrip gamification={gamification} lang={lang} />

      <div className="staff-finish-bar">
        {locationError ? <p className="staff-inline-error">{locationError}</p> : null}
        {state?.error ? (
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
