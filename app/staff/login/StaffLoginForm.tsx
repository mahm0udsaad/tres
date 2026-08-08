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
        <div className="staff-phone-input" dir="ltr">
          <span className="staff-phone-prefix">+966</span>
          <input
            name="phone_number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            autoFocus
            placeholder="5X XXX XXXX"
            aria-label="رقم الجوال بدون مفتاح الدولة"
          />
        </div>
        <input type="hidden" name="phone_country" value="+966" />
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
