"use client";

import { startTransition, useActionState, useState } from "react";
import {
  Camera,
  CheckCircle2,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import { reviewTask, type ReviewActionState } from "./actions";

export type ReviewableTask = {
  id: string;
  title: string;
  notes: string | null;
  task_date: string;
  employeeName: string;
  branchName: string | null;
  response_type: "completion" | "yes_no";
  yes_no_answer: boolean | null;
  completed_at: string | null;
  photoUrl: string | null;
};

/** Rejection asks one extra question — redo it, or just record the verdict —
 *  because "not good enough" and "do it again" are different instructions. */
type RejectMode = "redo" | "flag";

export default function TaskReviewCard({ task }: { task: ReviewableTask }) {
  const [state, action, pending] = useActionState<ReviewActionState | undefined, FormData>(
    reviewTask,
    undefined,
  );
  const [rejecting, setRejecting] = useState(false);
  const [notes, setNotes] = useState("");
  const [noteError, setNoteError] = useState("");

  function approve() {
    const form = new FormData();
    form.set("task_id", task.id);
    form.set("decision", "approved");
    startTransition(() => action(form));
  }

  function reject(mode: RejectMode) {
    if (!notes.trim()) {
      setNoteError("اكتب سبب الرفض ليعرف الموظف ما المطلوب.");
      return;
    }
    const form = new FormData();
    form.set("task_id", task.id);
    form.set("decision", "rejected");
    form.set("review_notes", notes.trim());
    form.set("reopen", mode === "redo" ? "redo" : "flag");
    setRejecting(false);
    startTransition(() => action(form));
  }

  // Once reviewed the card reports the outcome instead of vanishing silently.
  if (state?.message) {
    return (
      <article className="task-review-card task-review-card--done">
        <CheckCircle2 />
        <div>
          <strong>{task.title}</strong>
          <p>{state.message}</p>
        </div>
      </article>
    );
  }

  return (
    <article className="task-review-card">
      <header>
        <div>
          <span className="task-review-kind">مهمة · {task.employeeName}</span>
          <h3>{task.title}</h3>
          <time dateTime={task.task_date}>
            {new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" }).format(
              new Date(`${task.task_date}T12:00:00`),
            )}
            {task.branchName ? ` · ${task.branchName}` : ""}
          </time>
        </div>
        {task.response_type === "yes_no" ? (
          <span className={`task-review-answer ${task.yes_no_answer ? "is-yes" : "is-no"}`}>
            {task.yes_no_answer ? <CheckCircle2 /> : <XCircle />}
            {task.yes_no_answer ? "نعم" : "لا"}
          </span>
        ) : (
          <span className="task-review-answer is-yes">
            <CheckCircle2 /> تم التنفيذ
          </span>
        )}
      </header>

      {task.notes ? (
        <section className="task-review-notes">
          <MessageSquareText />
          <p>{task.notes}</p>
        </section>
      ) : null}

      {task.photoUrl ? (
        <a className="task-review-photo" href={task.photoUrl} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={task.photoUrl} alt={`صورة إثبات المهمة: ${task.title}`} />
          <span><Camera /> عرض صورة الإثبات</span>
        </a>
      ) : null}

      {state?.error ? <p className="staff-inline-error" role="alert">{state.error}</p> : null}

      <div className="task-review-actions">
        <button type="button" className="staff-primary" onClick={approve} disabled={pending}>
          {pending ? <LoaderCircle className="spin" /> : <CheckCircle2 />}
          اعتماد
        </button>
        <button
          type="button"
          className="report-reject-button"
          onClick={() => { setNotes(""); setNoteError(""); setRejecting(true); }}
          disabled={pending}
        >
          <XCircle />
          رفض
        </button>
      </div>

      {rejecting ? (
        <div
          className="task-reject-backdrop"
          role="presentation"
          onMouseDown={() => setRejecting(false)}
        >
          <section
            className="task-reject-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`reject-${task.id}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="staff-eyebrow">REJECT TASK</p>
                <h2 id={`reject-${task.id}`}>رفض: {task.title}</h2>
              </div>
              <button type="button" className="staff-icon-button" onClick={() => setRejecting(false)} aria-label="إغلاق">
                <X />
              </button>
            </header>

            <label className="staff-field-wide">
              <span>سبب الرفض (يصل للموظف)</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={notes}
                autoFocus
                onChange={(event) => { setNotes(event.target.value); setNoteError(""); }}
                placeholder="مثال: الماكينة ما زالت متسخة من الأسفل"
              />
            </label>
            {noteError ? <p className="staff-inline-error" role="alert">{noteError}</p> : null}

            <p className="task-reject-hint">ماذا تريد أن يحدث بعد الرفض؟</p>
            <div className="task-reject-options">
              <button type="button" className="staff-primary" onClick={() => reject("redo")}>
                <RotateCcw />
                <span>
                  <strong>إعادة المهمة للموظف</strong>
                  <small>تعود المهمة لقائمته مع السبب لينفذها من جديد</small>
                </span>
              </button>
              <button type="button" className="task-reject-flag" onClick={() => reject("flag")}>
                <XCircle />
                <span>
                  <strong>تسجيل الرفض فقط</strong>
                  <small>تبقى المهمة منتهية ويُسجَّل الرفض في تقييم الموظف</small>
                </span>
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
}
