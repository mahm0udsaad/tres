"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { Camera, MessageSquareText, Pencil, Save, Trash2, Users, X } from "lucide-react";
import { ROLE_LABELS, type StaffRole } from "../../lib/staff-shared";
import {
  assignOwnerCustomTask,
  deleteOwnerAssignedTask,
  updateOwnerAssignedTask,
} from "./actions";

type Employee = { user_id: string; full_name: string; role: StaffRole; branch_id: string | null };
type Task = {
  id: string; user_id: string; task_date: string; title: string; notes: string | null;
  is_required: boolean; requires_photo: boolean; requires_note: boolean;
  response_type: "completion" | "yes_no"; sort_order: number;
};

export default function OwnerTaskManager({ employees, tasks, branchNames, initialEmployeeId }: {
  employees: Employee[];
  tasks: Task[];
  branchNames: Record<string, string>;
  initialEmployeeId?: string | null;
}) {
  const [createState, createAction, creating] = useActionState(assignOwnerCustomTask, undefined);
  const [updateState, updateAction, updating] = useActionState(updateOwnerAssignedTask, undefined);
  const [deleteState, deleteAction, deleting] = useActionState(deleteOwnerAssignedTask, undefined);
  const [editing, setEditing] = useState<Task | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(Boolean(initialEmployeeId) || tasks.length === 0);

  return <>
    <div className="owner-manager-toolbar">
      <div><h2>مهام اليوم</h2><p>كل مهمة هنا أنشأها المالك وحدد من ينفذها.</p></div>
      <button type="button" className="staff-primary" onClick={() => setShowCreateForm((visible) => !visible)}>
        {showCreateForm ? <X /> : <Save />}
        {showCreateForm ? "إغلاق النموذج" : "مهمة جديدة"}
      </button>
    </div>
    {showCreateForm ? <section className="staff-card staff-checklist-form-card">
      <div className="staff-card-head"><div><h2>مهمة جديدة</h2><p>اكتب المطلوب واختر الموظف. الخيارات الإضافية اختيارية.</p></div><Users className="staff-checklist-head-icon" /></div>
      {employees.length === 0 ? <div className="staff-empty staff-empty-action">أنشئ حسابات الموظفين أولاً.<Link href="/staff/owner/team">فتح الموظفين</Link></div> : <form className="staff-form staff-checklist-form" action={(form) => startTransition(() => createAction(form))}>
        <label className="staff-field-wide"><span>عنوان المهمة</span><input name="task_title" required maxLength={200} placeholder="مثال: فحص مخزون الحليب" /></label>
        <label><span>تاريخ التنفيذ</span><input name="task_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
        <label><span>نوع الإجابة</span><select name="task_response_type" defaultValue="completion"><option value="completion">إكمال المهمة</option><option value="yes_no">نعم أو لا</option></select></label>
        <label className="staff-field-wide"><span>تعليمات للموظف (اختياري)</span><textarea name="task_notes" rows={3} maxLength={1000} /></label>
        <fieldset className="staff-task-assignees"><legend>من سينفذ المهمة؟</legend>{employees.map((employee) => <label key={employee.user_id}><input name="employee_ids" type="checkbox" value={employee.user_id} defaultChecked={employee.user_id === initialEmployeeId} /><span>{employee.full_name}<small>{ROLE_LABELS[employee.role]} · {employee.branch_id ? branchNames[employee.branch_id] ?? "فرع" : "بدون فرع"}</small></span></label>)}</fieldset>
        <label className="staff-checklist-check"><input name="task_photo" type="checkbox" /><span><Camera /> تتطلب صورة إثبات</span></label>
        <label className="staff-checklist-check"><input name="task_note_required" type="checkbox" /><span><MessageSquareText /> تتطلب ملاحظة من الموظف</span></label>
        <label className="staff-checklist-check"><input name="task_required" type="checkbox" defaultChecked /><span>مهمة إلزامية</span></label>
        <div className="staff-field-wide">{createState?.error ? <p className="staff-form-error">{createState.error}</p> : null}{createState?.message ? <p className="staff-form-success">{createState.message}</p> : null}<button className="staff-primary" disabled={creating}><Save /> {creating ? "جارٍ التوزيع…" : "إنشاء وتوزيع المهمة"}</button></div>
      </form>}
    </section> : null}

    <section className="staff-card staff-checklist-list">
      <div className="staff-card-head"><div><h2>المهام الحالية</h2><p>اضغط تعديل أو حذف قبل أن يكملها الموظف.</p></div><span className="staff-team-count">{tasks.length}</span></div>
      {deleteState?.error ? <p className="staff-form-error">{deleteState.error}</p> : null}{deleteState?.message ? <p className="staff-form-success">{deleteState.message}</p> : null}
      {tasks.length ? <ul className="staff-checklist-items">{tasks.map((task) => { const employee = employees.find((item) => item.user_id === task.user_id); return <li key={task.id}><div className="staff-checklist-item-info"><strong>{task.title}</strong><span>{employee?.full_name ?? "موظف"} · {task.task_date}</span></div><div className="staff-checklist-item-actions"><button type="button" className="staff-checklist-edit" onClick={() => setEditing(task)} aria-label="تعديل المهمة"><Pencil /></button><form action={(form) => startTransition(() => deleteAction(form))}><input type="hidden" name="task_id" value={task.id} /><button className="staff-checklist-edit staff-checklist-off" disabled={deleting} aria-label="حذف المهمة"><Trash2 /></button></form></div></li>; })}</ul> : <p className="staff-empty">لا توجد مهام. ابدأ بإنشاء أول مهمة أعلاه.</p>}
    </section>

    {editing ? <div className="owner-member-modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}><section className="owner-member-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="staff-eyebrow">EDIT TASK</p><h2>تعديل المهمة</h2></div><button type="button" className="staff-icon-button" onClick={() => setEditing(null)}><X /></button></header><form className="staff-form staff-checklist-form" action={(form) => startTransition(() => updateAction(form))} onSubmit={() => setEditing(null)}>
      <input type="hidden" name="assigned_task_id" value={editing.id} />
      <label className="staff-field-wide"><span>الموظف</span><select name="employee_id" defaultValue={editing.user_id}>{employees.map((employee) => <option key={employee.user_id} value={employee.user_id}>{employee.full_name}</option>)}</select></label>
      <label><span>التاريخ</span><input name="task_date" type="date" defaultValue={editing.task_date} required /></label><input type="hidden" name="task_sort_order" value={editing.sort_order} />
      <label><span>نوع الإجابة</span><select name="task_response_type" defaultValue={editing.response_type}><option value="completion">إكمال</option><option value="yes_no">نعم أو لا</option></select></label>
      <label className="staff-field-wide"><span>المهمة</span><input name="task_title" defaultValue={editing.title} required maxLength={200} /></label>
      <label className="staff-field-wide"><span>التعليمات</span><textarea name="task_notes" defaultValue={editing.notes ?? ""} maxLength={1000} rows={3} /></label>
      <label className="staff-checklist-check"><input name="task_photo" type="checkbox" defaultChecked={editing.requires_photo} /><span>تحتاج صورة</span></label><label className="staff-checklist-check"><input name="task_note_required" type="checkbox" defaultChecked={editing.requires_note} /><span>تحتاج ملاحظة</span></label><label className="staff-checklist-check"><input name="task_required" type="checkbox" defaultChecked={editing.is_required} /><span>إلزامية</span></label>
      <div className="staff-field-wide">{updateState?.error ? <p className="staff-form-error">{updateState.error}</p> : null}<button className="staff-primary" disabled={updating}><Save /> {updating ? "جارٍ الحفظ…" : "حفظ التعديل"}</button></div>
    </form></section></div> : null}
  </>;
}
