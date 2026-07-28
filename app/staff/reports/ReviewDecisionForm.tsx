"use client";

import { useActionState } from "react";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import {
  reviewStaffReport,
  type ReviewActionState,
} from "./actions";

export default function ReviewDecisionForm({
  reportId,
  reportType,
}: {
  reportId: string;
  reportType: "cleaning" | "barista" | "kitchen";
}) {
  const [state, formAction, pending] = useActionState<
    ReviewActionState | undefined,
    FormData
  >(reviewStaffReport, undefined);

  return (
    <form action={formAction} className="report-review-form">
      <input type="hidden" name="report_id" value={reportId} />
      <input type="hidden" name="report_type" value={reportType} />
      <label>
        <span>ملاحظات المراجعة</span>
        <textarea
          name="review_notes"
          rows={3}
          placeholder="اختياري عند التأكيد، ومطلوب عند الرفض"
          disabled={pending}
        />
      </label>
      {state?.error ? (
        <p className="staff-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.message ? (
        <p className="staff-form-success" role="status">
          {state.message}
        </p>
      ) : null}
      <div className="report-review-actions">
        <button
          className="staff-primary"
          type="submit"
          name="decision"
          value="confirmed"
          disabled={pending}
        >
          {pending ? <LoaderCircle className="spin" /> : <CheckCircle2 />}
          تأكيد
        </button>
        <button
          className="report-reject-button"
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending}
        >
          <XCircle />
          رفض مع ملاحظات
        </button>
      </div>
    </form>
  );
}
