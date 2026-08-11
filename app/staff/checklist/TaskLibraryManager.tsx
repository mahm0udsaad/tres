"use client";

import { startTransition, useActionState, useState } from "react";
import { Camera, CheckSquare, ListPlus, MessageSquareText, Save, Users } from "lucide-react";
import { ROLE_LABELS, type StaffRole } from "../../lib/staff-shared";
import { assignTaskDefinition, saveTaskDefinition } from "./task-library-actions";

export type TaskDefinition = {
  id: string;
  title: string;
  notes: string | null;
  is_required: boolean;
  requires_photo: boolean;
  requires_note: boolean;
  response_type: "completion" | "yes_no";
  is_active: boolean;
};

type Employee = { user_id: string; full_name: string; role: StaffRole };

export default function TaskLibraryManager({ definitions, employees }: { definitions: TaskDefinition[]; employees: Employee[] }) {
  const [saveState, saveAction, saving] = useActionState(saveTaskDefinition, undefined);
  const [assignState, assignAction, assigning] = useActionState(assignTaskDefinition, undefined);
  const [selectedDefinition, setSelectedDefinition] = useState("");

  return (
    <>
      <section className="staff-card staff-checklist-form-card">
        <div className="staff-card-head"><div><p className="staff-eyebrow">TASK LIBRARY</p><h2>إنشاء مهمة</h2><p>أنشئ المهمة أولاً، ثم وزّعها من القسم التالي على الموظفين الذين سينفذونها.</p></div><ListPlus className="staff-checklist-head-icon" /></div>
        <form className="staff-form staff-checklist-form" action={(form) => startTransition(() => saveAction(form))}>
          <label className="staff-field-wide"><span>عنوان المهمة</span><input name="title" required maxLength={200} placeholder="مثال: التأكد من نظافة المطبخ" /></label>
          <label><span>نوع الإجابة</span><select name="response_type" defaultValue="completion"><option value="completion">إكمال المهمة</option><option value="yes_no">نعم أو لا</option></select></label>
          <label className="staff-field-wide"><span>تعليمات للموظف (اختياري)</span><textarea name="notes" rows={3} maxLength={1000} placeholder="أضف ما يجب التحقق منه أو ملاحظات التنفيذ" /></label>
          <label className="staff-checklist-check"><input name="requires_photo" type="checkbox" /><span><Camera /> تتطلب صورة إثبات</span></label>
          <label className="staff-checklist-check"><input name="requires_note" type="checkbox" /><span><MessageSquareText /> تتطلب ملاحظة عند الإنجاز</span></label>
          <label className="staff-checklist-check"><input name="is_required" type="checkbox" defaultChecked /><span><CheckSquare /> مهمة إلزامية</span></label>
          <div className="staff-field-wide">{saveState?.error ? <p className="staff-form-error">{saveState.error}</p> : null}{saveState?.message ? <p className="staff-form-success">{saveState.message}</p> : null}<button type="submit" className="staff-primary" disabled={saving}><Save /> {saving ? "جارٍ الحفظ…" : "إضافة إلى المكتبة"}</button></div>
        </form>
      </section>

      <section className="staff-card staff-checklist-form-card">
        <div className="staff-card-head"><div><p className="staff-eyebrow">ASSIGN TASK</p><h2>اختيار الموظفين للمهمة</h2><p>يمكن توزيع نفس المهمة على أكثر من موظف في اليوم نفسه.</p></div><Users className="staff-checklist-head-icon" /></div>
        {definitions.length === 0 ? <p className="staff-empty">أنشئ مهمة من مكتبة المهام أولاً.</p> : employees.length === 0 ? <p className="staff-empty">أنشئ حساب موظف أولاً، ثم عُد لتوزيع المهمة.</p> : <form className="staff-form staff-checklist-form" action={(form) => startTransition(() => assignAction(form))}>
          <label className="staff-field-wide"><span>المهمة</span><select name="definition_id" required value={selectedDefinition} onChange={(event) => setSelectedDefinition(event.target.value)}><option value="" disabled>اختر مهمة من المكتبة</option>{definitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.title}</option>)}</select></label>
          <label className="staff-field-wide"><span>تاريخ التنفيذ</span><input name="task_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <fieldset className="staff-task-assignees"><legend>الموظفون المنفذون</legend>{employees.map((employee) => <label key={employee.user_id}><input name="employee_ids" type="checkbox" value={employee.user_id} /><span>{employee.full_name}<small>{ROLE_LABELS[employee.role]}</small></span></label>)}</fieldset>
          <div className="staff-field-wide">{assignState?.error ? <p className="staff-form-error">{assignState.error}</p> : null}{assignState?.message ? <p className="staff-form-success">{assignState.message}</p> : null}<button type="submit" className="staff-primary" disabled={assigning || !selectedDefinition}><Users /> {assigning ? "جارٍ التوزيع…" : "توزيع المهمة"}</button></div>
        </form>}
      </section>
    </>
  );
}
