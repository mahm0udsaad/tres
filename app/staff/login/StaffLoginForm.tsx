"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginStaff } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="staff-primary staff-block" type="submit" disabled={pending}>
      {pending ? "جارٍ تسجيل الدخول…" : "دخول الموظفين"}
    </button>
  );
}

export default function StaffLoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginStaff, undefined);
  return (
    <form action={action} className="staff-form">
      <input type="hidden" name="next" value={next} />
      <label>
        <span>رقم الجوال</span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          autoFocus
          placeholder="+966 5X XXX XXXX"
        />
      </label>
      <label>
        <span>كلمة المرور</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
      </label>
      <p className="staff-form-error" aria-live="polite">{state?.error ?? ""}</p>
      <SubmitButton />
    </form>
  );
}
