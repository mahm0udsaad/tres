"use client";

import { useActionState } from "react";
import { KeyRound, Save } from "lucide-react";
import { changeOwnPassword } from "./actions";

const COPY = {
  ar: { current: "كلمة المرور الحالية", next: "كلمة المرور الجديدة", confirm: "تأكيد كلمة المرور الجديدة", save: "تغيير كلمة المرور", saving: "جارٍ التغيير…" },
  en: { current: "Current password", next: "New password", confirm: "Confirm new password", save: "Change password", saving: "Changing…" },
  bn: { current: "বর্তমান পাসওয়ার্ড", next: "নতুন পাসওয়ার্ড", confirm: "নতুন পাসওয়ার্ড নিশ্চিত করুন", save: "পাসওয়ার্ড পরিবর্তন করুন", saving: "পরিবর্তন হচ্ছে…" },
} as const;

export default function PasswordForm({ lang }: { lang: keyof typeof COPY }) {
  const [state, action, pending] = useActionState(changeOwnPassword, undefined);
  const copy = COPY[lang];
  return <section className="staff-card staff-account-card"><div className="staff-card-head"><div><p className="staff-eyebrow">PASSWORD</p><h2>{copy.save}</h2></div><KeyRound /></div><form action={action} className="staff-form"><label className="staff-field-wide"><span>{copy.current}</span><input name="current_password" type="password" autoComplete="current-password" required minLength={8} /></label><label><span>{copy.next}</span><input name="password" type="password" autoComplete="new-password" required minLength={8} /></label><label><span>{copy.confirm}</span><input name="password_confirmation" type="password" autoComplete="new-password" required minLength={8} /></label><div className="staff-field-wide">{state?.error ? <p className="staff-form-error">{state.error}</p> : null}{state?.message ? <p className="staff-form-success">{state.message}</p> : null}<button className="staff-primary" disabled={pending}><Save /> {pending ? copy.saving : copy.save}</button></div></form></section>;
}
