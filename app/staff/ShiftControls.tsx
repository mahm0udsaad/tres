"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
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
} from "lucide-react";
import type {
  AttendanceRecord,
  Gamification,
  StaffTask,
} from "../lib/staff-shared";
import { completeChecklistTask, staffOperation } from "./actions";

const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const MANUAL_TASK_TYPES = new Set(["general_duty", "checklist"]);

type Props = {
  attendance: AttendanceRecord | null;
  tasks: StaffTask[];
  gamification: Gamification;
};

type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

function hoursSince(iso: string) {
  const hours = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
  return hours.toLocaleString("ar-SA", { maximumFractionDigits: 1 });
}

export default function ShiftControls({ attendance, tasks, gamification }: Props) {
  const [state, action, pending] = useActionState(staffOperation, undefined);
  const [photoState, photoAction, photoPending] = useActionState(completeChecklistTask, undefined);
  const [locationPending, setLocationPending] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [elapsedHours, setElapsedHours] = useState<string | null>(null);

  useEffect(() => {
    if (!attendance) {
      setElapsedHours(null);
      return;
    }
    const update = () => setElapsedHours(hoursSince(attendance.start_time));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [attendance]);

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
      setLocationError(
        "هذا المتصفح لا يدعم تحديد الموقع. · This browser does not support location.",
      );
      return;
    }
    setLocationPending(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }: GeolocationPosition) => {
        const location: Coordinates = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        };
        setLocationPending(false);
        submit(operation, {
          latitude: String(location.latitude),
          longitude: String(location.longitude),
          accuracy: String(location.accuracy),
        });
      },
      (error) => {
        setLocationPending(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "اسمح بالوصول إلى الموقع لبدء أو إنهاء الوردية. · Allow location access to start or end your shift."
            : "تعذّر تحديد موقعك بدقة — حاول في مكان مكشوف. · Couldn't get an accurate location — try again outdoors.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 15_000 },
    );
  }

  function completeWithPhoto(taskId: string, file: File) {
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("photo", file);
    startTransition(() => photoAction(form));
  }

  const busy = pending || locationPending;
  const taskBusy = pending || photoPending;
  const breakActive = Boolean(attendance?.break_started_at && !attendance.break_ended_at);
  const completedTasks = tasks.filter((task) => task.completed).length;
  const missing = Array.isArray(state?.result?.missing)
    ? (state.result.missing as { id: string | null; title: string; task_type?: string }[])
    : [];
  const missingHasReportTask = missing.some(
    (item) => item.task_type && !MANUAL_TASK_TYPES.has(item.task_type) && item.task_type !== "break",
  );

  return (
    <>
      {showSuccess ? (
        <section className="staff-success" role="status">
          <div className="staff-success-icon"><Award /></div>
          <p>أحسنت!</p>
          <h2>اكتملت الوردية بنجاح</h2>
          <div>
            <span>{String(state?.result?.hours_worked ?? 0)} ساعة</span>
            <span>{String(state?.result?.tasks_completed ?? 0)} مهام</span>
            <span>+{String(state?.result?.points_earned ?? 0)} نقطة</span>
            <span>{String(state?.result?.streak_count ?? 1)} أيام متتالية</span>
          </div>
        </section>
      ) : null}

      <section className="staff-shift-card">
        <div className="staff-shift-status">
          <span className={attendance ? "is-active" : ""} />
          {attendance ? "وردية جارية · Shift running" : "جاهز لبدء الوردية · Ready to start"}
        </div>
        {attendance ? (
          <>
            <strong className="staff-hours" suppressHydrationWarning>{elapsedHours ?? "—"}</strong>
            <span className="staff-hours-label">ساعة منذ تسجيل الحضور</span>
            <button
              type="button"
              className="staff-shift-button staff-shift-button--end"
              onClick={() => locateAndSubmit("end_shift")}
              disabled={busy}
            >
              {busy ? <LoaderCircle className="spin" /> : <LogOut />}
              <span>إنهاء الوردية · End shift</span>
              <small>سيتم التحقق من مهام اليوم أولاً · Today's tasks are checked first</small>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="staff-shift-button"
            onClick={() => locateAndSubmit("start_shift")}
            disabled={busy}
          >
            {busy ? <LoaderCircle className="spin" /> : <LogIn />}
            <span>بدء الوردية · Start shift</span>
            <small><MapPin /> يجب أن تكون داخل نطاق الفرع · Be inside the branch area</small>
          </button>
        )}
        {locationError ? <p className="staff-inline-error">{locationError}</p> : null}
        {state?.error ? (
          <div className="staff-alert staff-alert--error" role="alert">
            <CircleAlert />
            <span>{state.error}</span>
          </div>
        ) : null}
        {state?.message && state.operation !== "end_shift" ? (
          <div className="staff-alert staff-alert--success" role="status">
            <Check />
            <span>{state.message}</span>
          </div>
        ) : null}
      </section>

      {missing.length > 0 ? (
        <section className="staff-card staff-missing">
          <h2>متطلبات ناقصة · Missing requirements</h2>
          <p>أكمل هذه العناصر قبل إنهاء الوردية: · Complete these before ending your shift:</p>
          <ul>
            {missing.map((item, index) => <li key={item.id ?? index}>{item.title}</li>)}
          </ul>
          {missingHasReportTask ? (
            <a className="staff-missing-link" href="/staff/submissions">
              فتح النماذج اليومية · Open daily forms
            </a>
          ) : null}
        </section>
      ) : null}

      <div className="staff-summary-grid">
        <section className="staff-card staff-break">
          <div className="staff-card-head">
            <div>
              <p className="staff-eyebrow">BREAK</p>
              <h2>استراحة الوردية</h2>
            </div>
            <Coffee />
          </div>
          <strong>{attendance?.break_duration_minutes ?? 0} / 60</strong>
          <span>دقيقة مستخدمة</span>
          {attendance ? (
            attendance.break_ended_at ? (
              <button type="button" className="staff-secondary" disabled>تمت الاستراحة</button>
            ) : (
              <button
                type="button"
                className="staff-secondary"
                onClick={() => submit(breakActive ? "end_break" : "start_break")}
                disabled={pending}
              >
                {breakActive ? "إنهاء الاستراحة" : "بدء الاستراحة"}
              </button>
            )
          ) : (
            <p className="staff-muted">تتاح بعد بدء الوردية.</p>
          )}
        </section>

        <section className="staff-card staff-points">
          <div className="staff-card-head">
            <div>
              <p className="staff-eyebrow">REWARDS</p>
              <h2>إنجازك</h2>
            </div>
            <Award />
          </div>
          <strong>{gamification.points}</strong>
          <span>نقطة إجمالية · {gamification.streak_count} أيام متتالية</span>
          <div className="staff-badges">
            {gamification.badges.length
              ? gamification.badges.map((badge) => <span key={badge}>{badge.replaceAll("_", " ")}</span>)
              : <span>أكمل أول وردية لفتح شارة</span>}
          </div>
        </section>
      </div>

      {attendance ? (
        <section className="staff-card staff-tasks">
          <div className="staff-card-head">
            <div>
              <p className="staff-eyebrow">TODAY</p>
              <h2>مهام اليوم</h2>
            </div>
            <span className="staff-task-count">{completedTasks}/{tasks.length}</span>
          </div>
          {photoState?.error ? (
            <p className="staff-inline-error" role="alert">{photoState.error}</p>
          ) : null}
          {tasks.length ? (
            <ul>
              {tasks.map((task) => {
                const manual = MANUAL_TASK_TYPES.has(task.task_type);
                const needsPhoto = task.requires_photo && !task.completed;
                return (
                  <li key={task.id} data-completed={task.completed}>
                    {manual && needsPhoto ? (
                      <label
                        className="staff-task-photo"
                        data-busy={taskBusy}
                        aria-label={`إرفاق صورة لإكمال ${task.title}`}
                      >
                        {taskBusy ? <LoaderCircle className="spin" /> : <Camera />}
                        <input
                          type="file"
                          accept={PHOTO_ACCEPT}
                          capture="environment"
                          disabled={taskBusy}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) completeWithPhoto(task.id, file);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    ) : (
                      <button
                        type="button"
                        aria-label={`إكمال ${task.title}`}
                        disabled={task.completed || taskBusy || !manual}
                        onClick={() => submit("complete_task", { task_id: task.id })}
                      >
                        {task.completed ? <Check /> : null}
                      </button>
                    )}
                    <span>{task.title}</span>
                    {task.requires_photo ? (
                      <small className="staff-task-phototag" data-attached={Boolean(task.photo_path)}>
                        <Camera /> {task.photo_path ? "تم إرفاق صورة · Photo attached" : "تتطلب صورة · Photo required"}
                      </small>
                    ) : null}
                    {task.is_required ? <small>مطلوبة · Required</small> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="staff-empty">لا توجد مهام مخصصة لك اليوم.</p>
          )}
        </section>
      ) : null}
    </>
  );
}
