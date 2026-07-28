"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MapPin, Plus, UserPlus } from "lucide-react";
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from "../../lib/staff-shared";
import { saveOperations } from "../actions";

type Branch = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
};

type Profile = {
  user_id: string;
  full_name: string;
  role: StaffRole;
  branch_id: string | null;
};

function SubmitButton({
  icon,
  children,
}: {
  icon: "branch" | "staff" | "task";
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  const Icon = icon === "branch" ? MapPin : icon === "staff" ? UserPlus : Plus;
  return (
    <button type="submit" className="a-btn a-btn--primary" disabled={pending}>
      <Icon /> {pending ? "جارٍ الحفظ…" : children}
    </button>
  );
}

function Result({ state }: { state: { error?: string; message?: string } | undefined }) {
  return (
    <p
      className="a-ops-message"
      data-error={state?.error ? "true" : "false"}
      aria-live="polite"
    >
      {state?.error ?? state?.message ?? ""}
    </p>
  );
}

export default function OperationsForms({
  branches,
  profiles,
}: {
  branches: Branch[];
  profiles: Profile[];
}) {
  const [branchState, branchAction] = useActionState(saveOperations, undefined);
  const [staffState, staffAction] = useActionState(saveOperations, undefined);
  const [taskState, taskAction] = useActionState(saveOperations, undefined);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className="a-ops-grid">
      <section className="a-card a-card--pad">
        <div className="a-section-title" style={{ marginTop: 0 }}>
          <h2>إضافة فرع</h2>
        </div>
        <form action={branchAction} className="a-ops-form">
          <input type="hidden" name="operation" value="save_branch" />
          <div className="a-field">
            <label>اسم الفرع</label>
            <input className="a-input" name="name" required />
          </div>
          <div className="a-row-2">
            <div className="a-field">
              <label>خط العرض</label>
              <input className="a-input" name="latitude" type="number" step="any" required />
            </div>
            <div className="a-field">
              <label>خط الطول</label>
              <input className="a-input" name="longitude" type="number" step="any" required />
            </div>
          </div>
          <div className="a-field">
            <label>نصف القطر المسموح (متر)</label>
            <input className="a-input" name="radius_meters" type="number" min="10" max="5000" defaultValue="100" required />
          </div>
          <div className="a-ops-actions">
            <SubmitButton icon="branch">إنشاء الفرع</SubmitButton>
            <Result state={branchState} />
          </div>
        </form>
        {branches.length ? (
          <div className="a-ops-list" aria-label="الفروع الحالية">
            {branches.map((branch) => (
              <form action={branchAction} className="a-ops-branch-edit" key={branch.id}>
                <input type="hidden" name="operation" value="save_branch" />
                <input type="hidden" name="id" value={branch.id} />
                <input className="a-input" name="name" defaultValue={branch.name} aria-label="اسم الفرع" required />
                <div className="a-row-2">
                  <input className="a-input" name="latitude" type="number" step="any" defaultValue={branch.latitude} aria-label="خط العرض" required />
                  <input className="a-input" name="longitude" type="number" step="any" defaultValue={branch.longitude} aria-label="خط الطول" required />
                </div>
                <div className="a-ops-actions">
                  <input className="a-input" name="radius_meters" type="number" min="10" max="5000" defaultValue={branch.radius_meters} aria-label="نصف القطر بالمتر" required />
                  <button type="submit" className="a-btn a-btn--ghost a-btn--sm">تحديث</button>
                </div>
              </form>
            ))}
          </div>
        ) : null}
      </section>

      <section className="a-card a-card--pad">
        <div className="a-section-title" style={{ marginTop: 0 }}>
          <h2>إنشاء حساب موظف</h2>
        </div>
        <form action={staffAction} className="a-ops-form">
          <input type="hidden" name="operation" value="create_staff" />
          <div className="a-field">
            <label>الاسم</label>
            <input className="a-input" name="full_name" required />
          </div>
          <div className="a-row-2">
            <div className="a-field">
              <label>البريد الإلكتروني</label>
              <input className="a-input" name="email" type="email" required />
            </div>
            <div className="a-field">
              <label>كلمة مرور مؤقتة</label>
              <input className="a-input" name="password" type="password" minLength={8} required />
            </div>
          </div>
          <div className="a-row-2">
            <div className="a-field">
              <label>الدور</label>
              <select className="a-select" name="role" defaultValue="employee">
                {STAFF_ROLES.map((role) => <option value={role} key={role}>{ROLE_LABELS[role]}</option>)}
              </select>
            </div>
            <div className="a-field">
              <label>الفرع</label>
              <select className="a-select" name="branch_id" required defaultValue="">
                <option value="" disabled>اختر الفرع</option>
                {branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}
              </select>
            </div>
          </div>
          <div className="a-field">
            <label>وقت بداية الوردية المعتاد (اختياري)</label>
            <input className="a-input" name="scheduled_start" type="time" />
            <p className="a-hint">يُمنح حافز الحضور في الوقت حتى 15 دقيقة بعد هذا الموعد.</p>
          </div>
          <div className="a-ops-actions">
            <SubmitButton icon="staff">إنشاء الحساب</SubmitButton>
            <Result state={staffState} />
          </div>
        </form>
      </section>

      <section className="a-card a-card--pad a-ops-wide">
        <div className="a-section-title" style={{ marginTop: 0 }}>
          <h2>إسناد مهمة يومية</h2>
        </div>
        <form action={taskAction} className="a-ops-form">
          <input type="hidden" name="operation" value="assign_task" />
          <div className="a-row-2">
            <div className="a-field">
              <label>الموظف</label>
              <select className="a-select" name="user_id" required defaultValue="">
                <option value="" disabled>اختر الموظف</option>
                {profiles
                  .filter((profile) => !["owner", "manager", "shift_manager"].includes(profile.role))
                  .map((profile) => <option value={profile.user_id} key={profile.user_id}>{profile.full_name}</option>)}
              </select>
            </div>
            <div className="a-field">
              <label>التاريخ</label>
              <input className="a-input" name="task_date" type="date" defaultValue={today} required />
            </div>
          </div>
          <div className="a-field">
            <label>وصف المهمة</label>
            <input className="a-input" name="title" placeholder="مثال: ترتيب منطقة الاستلام" required />
          </div>
          <div className="a-ops-actions">
            <SubmitButton icon="task">إسناد المهمة</SubmitButton>
            <Result state={taskState} />
          </div>
        </form>
      </section>

      <section className="a-card a-card--pad a-ops-wide">
        <div className="a-section-title" style={{ marginTop: 0 }}>
          <h2>الفريق الحالي</h2>
          <span className="a-pill a-pill--read">{profiles.length} حساب</span>
        </div>
        <div className="a-ops-list">
          {profiles.map((profile) => (
            <div className="a-ops-person" key={profile.user_id}>
              <span className="avatar">{profile.full_name.slice(0, 1)}</span>
              <div className="main">
                <strong>{profile.full_name}</strong>
                <small>{ROLE_LABELS[profile.role]} · {branches.find((branch) => branch.id === profile.branch_id)?.name ?? "بلا فرع"}</small>
              </div>
            </div>
          ))}
          {!profiles.length ? <p className="a-hint">لا توجد حسابات موظفين بعد.</p> : null}
        </div>
      </section>
    </div>
  );
}
