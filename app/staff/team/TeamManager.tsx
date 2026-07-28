"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Check, Clock, Copy, KeyRound, LogIn, LogOut, UserPlus, UserX, UserCheck } from "lucide-react";
import {
  LANGUAGE_LABELS,
  NATIONALITIES,
  PROVISIONABLE_ROLES,
  ROLE_LABELS,
  languageForNationality,
  suggestStaffEmail,
  type StaffProfile,
} from "../../lib/staff-shared";
import { createBranchStaff, overrideBranchShift, toggleBranchStaffActive } from "./actions";

export default function TeamManager({
  members,
  selfUserId,
  activeShiftIds,
}: {
  members: StaffProfile[];
  selfUserId: string;
  activeShiftIds: string[];
}) {
  const [createState, createAction, creating] = useActionState(createBranchStaff, undefined);
  const [toggleState, toggleAction, toggling] = useActionState(toggleBranchStaffActive, undefined);
  const [overrideState, overrideAction, overriding] = useActionState(overrideBranchShift, undefined);
  const [email, setEmail] = useState("");
  const emailEdited = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [copied, setCopied] = useState(false);
  const [nationality, setNationality] = useState("Saudi Arabia");
  const [language, setLanguage] = useState<"ar" | "en">(languageForNationality("Saudi Arabia"));
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const active = new Set(activeShiftIds);

  const credentials = createState?.credentials;

  function onNameChange(name: string) {
    if (!emailEdited.current) setEmail(name.trim() ? suggestStaffEmail(name) : "");
  }

  async function copyCredentials() {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(
        `الموظف: ${credentials.fullName}\nالبريد: ${credentials.email}\nكلمة المرور: ${credentials.password}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard unavailable — the values stay visible for manual copy.
    }
  }

  return (
    <>
      <section className="staff-card staff-team-create">
        <div className="staff-card-head">
          <div>
            <p className="staff-eyebrow">NEW ACCOUNT</p>
            <h2>إنشاء حساب موظف</h2>
          </div>
          <UserPlus className="staff-team-head-icon" />
        </div>

        {credentials ? (
          <div className="staff-team-credentials" role="status">
            <div className="staff-team-credentials-head">
              <KeyRound />
              <div>
                <strong>بيانات دخول {credentials.fullName}</strong>
                <p>احفظها الآن وسلّمها للموظف — لن تظهر مرة أخرى بعد مغادرة الصفحة.</p>
              </div>
            </div>
            <dl>
              <div>
                <dt>البريد الإلكتروني</dt>
                <dd dir="ltr">{credentials.email}</dd>
              </div>
              <div>
                <dt>كلمة المرور المؤقتة</dt>
                <dd dir="ltr">{credentials.password}</dd>
              </div>
            </dl>
            <button type="button" className="staff-secondary" onClick={copyCredentials}>
              {copied ? <Check /> : <Copy />} {copied ? "تم النسخ" : "نسخ البيانات"}
            </button>
          </div>
        ) : null}

        <form
          ref={formRef}
          className="staff-form staff-team-form"
          action={(form) => startTransition(() => createAction(form))}
        >
          <label>
            <span>اسم الموظف</span>
            <input
              name="full_name"
              required
              maxLength={120}
              placeholder="مثال: أحمد السالم"
              onChange={(event) => onNameChange(event.target.value)}
            />
          </label>
          <label>
            <span>الدور</span>
            <select name="role" required defaultValue="employee">
              {PROVISIONABLE_ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </label>
          <label className="staff-field-wide">
            <span>البريد الإلكتروني لتسجيل الدخول</span>
            <input
              name="email"
              type="email"
              dir="ltr"
              required
              value={email}
              onChange={(event) => {
                emailEdited.current = true;
                setEmail(event.target.value);
              }}
              placeholder="name@tres-staff.com"
            />
          </label>
          <label>
            <span>كلمة المرور (اختياري)</span>
            <input
              name="password"
              dir="ltr"
              minLength={8}
              placeholder="تُولَّد تلقائيًا إن تُركت فارغة"
              autoComplete="off"
            />
          </label>
          <label>
            <span>الجنسية</span>
            <select
              name="nationality"
              value={nationality}
              onChange={(event) => {
                setNationality(event.target.value);
                setLanguage(languageForNationality(event.target.value));
              }}
            >
              {NATIONALITIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>لغة اللوحة</span>
            <select
              name="preferred_language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as "ar" | "en")}
            >
              {(["ar", "en"] as const).map((code) => (
                <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>بداية الدوام (اختياري)</span>
            <input name="scheduled_start" type="time" />
          </label>
          <div className="staff-field-wide">
            {createState?.error ? <p className="staff-form-error">{createState.error}</p> : null}
            {createState?.message && !createState.error ? (
              <p className="staff-form-success">{createState.message}</p>
            ) : null}
            <button type="submit" className="staff-primary" disabled={creating}>
              <UserPlus /> {creating ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
            </button>
          </div>
        </form>
      </section>

      <section className="staff-card staff-team-list">
        <div className="staff-card-head">
          <div>
            <p className="staff-eyebrow">TEAM</p>
            <h2>موظفو الفرع</h2>
          </div>
          <span className="staff-team-count">{members.length}</span>
        </div>

        {toggleState?.error ? <p className="staff-form-error">{toggleState.error}</p> : null}
        {overrideState?.error ? <p className="staff-form-error">{overrideState.error}</p> : null}
        {overrideState?.message ? <p className="staff-form-success">{overrideState.message}</p> : null}

        {members.length === 0 ? (
          <p className="staff-empty">لا يوجد موظفون في هذا الفرع بعد.</p>
        ) : (
          <ul className="staff-team-members">
            {members.map((member) => {
              const isSelf = member.user_id === selfUserId;
              const protectedRole = !PROVISIONABLE_ROLES.includes(
                member.role as (typeof PROVISIONABLE_ROLES)[number],
              );
              const onShift = active.has(member.user_id);
              const canOverride = !isSelf && !protectedRole && member.is_active;
              const overrideOpen = overrideFor === member.user_id;
              return (
                <li key={member.user_id} data-inactive={!member.is_active}>
                  <div className="staff-team-member-row">
                    <div className="staff-team-member-info">
                      <strong>
                        {member.full_name}
                        {isSelf ? <span className="staff-team-self"> (أنت)</span> : null}
                      </strong>
                      <span>
                        {ROLE_LABELS[member.role]}
                        {member.scheduled_start ? ` · يبدأ ${member.scheduled_start.slice(0, 5)}` : ""}
                      </span>
                    </div>
                    <div className="staff-team-member-actions">
                      {onShift ? (
                        <span className="staff-team-status" data-shift="true"><Clock /> في الوردية</span>
                      ) : null}
                      <span className="staff-team-status" data-active={member.is_active}>
                        {member.is_active ? "نشط" : "معطّل"}
                      </span>
                      {canOverride ? (
                        <button
                          type="button"
                          className="staff-team-toggle"
                          data-deactivate={onShift}
                          onClick={() => setOverrideFor(overrideOpen ? null : member.user_id)}
                        >
                          {onShift ? <LogOut /> : <LogIn />}
                          {onShift ? "إنهاء يدوي" : "بدء يدوي"}
                        </button>
                      ) : null}
                      {!isSelf && !protectedRole ? (
                        <form action={(form) => startTransition(() => toggleAction(form))}>
                          <input type="hidden" name="user_id" value={member.user_id} />
                          <input type="hidden" name="next_active" value={String(!member.is_active)} />
                          <button
                            type="submit"
                            className="staff-team-toggle"
                            disabled={toggling}
                            data-deactivate={member.is_active}
                          >
                            {member.is_active ? <UserX /> : <UserCheck />}
                            {member.is_active ? "تعطيل" : "تفعيل"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  {canOverride && overrideOpen ? (
                    <form
                      className="staff-team-override"
                      action={(form) => {
                        startTransition(() => overrideAction(form));
                        setOverrideFor(null);
                      }}
                    >
                      <input type="hidden" name="employee_id" value={member.user_id} />
                      <input type="hidden" name="action" value={onShift ? "end" : "start"} />
                      <label>
                        <span>
                          {onShift
                            ? "سبب الإنهاء اليدوي (مثال: GPS معطّل، الموظف غادر)"
                            : "سبب البدء اليدوي (مثال: GPS لا يعمل داخل المول)"}
                        </span>
                        <textarea name="reason" required minLength={10} rows={2} />
                      </label>
                      <button type="submit" className="staff-primary" disabled={overriding}>
                        {onShift ? "تأكيد الإنهاء اليدوي" : "تأكيد البدء اليدوي"}
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
