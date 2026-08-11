"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Camera, ListPlus, Pencil, Power, Save, X } from "lucide-react";
import { ROLE_LABELS, type ChecklistTemplate, type StaffRole } from "../../lib/staff-shared";
import { clearOwnerBranchChecklists, saveChecklistTemplate, toggleChecklistTemplate, updateOwnerAssignedTask } from "./actions";

const TARGET_ROLES: (StaffRole | "")[] = [
  "",
  "supervisor",
  "employee",
  "cleaning_staff",
  "barista",
  "kitchen_manager",
];

type AssignedTask = {
  id: string; user_id: string; task_date: string; title: string; notes: string | null;
  is_required: boolean; requires_photo: boolean; requires_note: boolean; response_type: "completion" | "yes_no"; sort_order: number;
};

function roleLabel(role: StaffRole | null) {
  return role ? ROLE_LABELS[role] : "جميع أدوار الحضور";
}

export default function ChecklistManager({ templates, branches, employees, assignedTasks, owner = false }: { templates: ChecklistTemplate[]; branches?: { id: string; name: string }[]; employees?: { user_id: string; full_name: string; role: StaffRole }[]; assignedTasks?: AssignedTask[]; owner?: boolean }) {
  const [saveState, saveAction, saving] = useActionState(saveChecklistTemplate, undefined);
  const [toggleState, toggleAction, toggling] = useActionState(toggleChecklistTemplate, undefined);
  const [clearState, clearAction, clearing] = useActionState(clearOwnerBranchChecklists, undefined);
  const [updateState, updateAction, updating] = useActionState(updateOwnerAssignedTask, undefined);
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);
  const [editingAssigned, setEditingAssigned] = useState<AssignedTask | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function startEdit(template: ChecklistTemplate) {
    setEditing(template);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const active = templates.filter((template) => template.is_active);
  const inactive = templates.filter((template) => !template.is_active);

  return (
    <>
      {owner ? <section className="staff-card staff-checklist-form-card">
        <div className="staff-card-head"><div><p className="staff-eyebrow">RESET SHARED TASKS</p><h2>مسح المهام الموحدة للفرع</h2><p>يبقي المهام الفردية والتقارير كما هي، ويحذف فقط قائمة المهام المتكررة غير المكتملة.</p></div></div>
        <form className="staff-form staff-checklist-form" action={(form) => startTransition(() => clearAction(form))}>
          <label className="staff-field-wide"><span>الفرع</span><select name="clear_branch_id" required defaultValue={branches?.[0]?.id ?? ""}>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <div className="staff-field-wide">{clearState?.error ? <p className="staff-form-error">{clearState.error}</p> : null}{clearState?.message ? <p className="staff-form-success">{clearState.message}</p> : null}<button type="submit" className="staff-secondary" disabled={clearing}>{clearing ? "جارٍ المسح…" : "مسح المهام الموحدة"}</button></div>
        </form>
      </section> : null}
      {owner ? <section className="staff-card staff-checklist-list">
        <div className="staff-card-head"><div><p className="staff-eyebrow">INDIVIDUAL TASKS</p><h2>المهام الفردية الحالية</h2></div><span className="staff-team-count">{assignedTasks?.length ?? 0}</span></div>
        {assignedTasks?.length ? <ul className="staff-checklist-items">{assignedTasks.map((task) => {
          const employee = employees?.find((item) => item.user_id === task.user_id);
          return <li key={task.id}><div className="staff-checklist-item-info"><strong>{task.title}</strong><span>{employee ? `${employee.full_name} · ${ROLE_LABELS[employee.role]}` : "موظف"} · {task.task_date}</span></div><button type="button" className="staff-checklist-edit" onClick={() => setEditingAssigned(task)} aria-label={`تعديل ${task.title}`}><Pencil /></button></li>;
        })}</ul> : <p className="staff-empty">لا توجد مهام فردية غير مكتملة.</p>}
      </section> : null}
      {owner && editingAssigned ? <section className="staff-card staff-checklist-form-card">
        <div className="staff-card-head"><div><p className="staff-eyebrow">EDIT ASSIGNMENT</p><h2>تعديل إسناد المهمة</h2></div><button type="button" className="staff-icon-button" onClick={() => setEditingAssigned(null)}><X /> <span>إلغاء</span></button></div>
        <form key={editingAssigned.id} className="staff-form staff-checklist-form" action={(form) => startTransition(() => updateAction(form))} onSubmit={() => setEditingAssigned(null)}>
          <input type="hidden" name="assigned_task_id" value={editingAssigned.id} />
          <label className="staff-field-wide"><span>الموظف</span><select name="employee_id" required defaultValue={editingAssigned.user_id}>{employees?.map((employee) => <option key={employee.user_id} value={employee.user_id}>{employee.full_name} · {ROLE_LABELS[employee.role]}</option>)}</select></label>
          <label><span>تاريخ التنفيذ</span><input name="task_date" type="date" required defaultValue={editingAssigned.task_date} /></label>
          <label><span>ترتيب المهمة</span><input name="task_sort_order" type="number" min="0" max="999" defaultValue={editingAssigned.sort_order} /></label>
          <label className="staff-field-wide"><span>وصف المهمة</span><input name="task_title" required maxLength={200} defaultValue={editingAssigned.title} /></label>
          <label><span>نوع الإجابة</span><select name="task_response_type" defaultValue={editingAssigned.response_type}><option value="completion">إكمال المهمة</option><option value="yes_no">نعم أو لا</option></select></label>
          <label className="staff-field-wide"><span>ملاحظات (اختياري)</span><textarea name="task_notes" maxLength={1000} rows={3} defaultValue={editingAssigned.notes ?? ""} /></label>
          <label className="staff-checklist-check"><input name="task_photo" type="checkbox" defaultChecked={editingAssigned.requires_photo} /><span><Camera /> تتطلب تصويراً كإثبات</span></label>
          <label className="staff-checklist-check"><input name="task_note_required" type="checkbox" defaultChecked={editingAssigned.requires_note} /><span>تتطلب ملاحظة من الموظف عند الإنجاز</span></label>
          <label className="staff-checklist-check"><input name="task_required" type="checkbox" defaultChecked={editingAssigned.is_required} /><span>مهمة إلزامية</span></label>
          <div className="staff-field-wide">{updateState?.error ? <p className="staff-form-error">{updateState.error}</p> : null}{updateState?.message ? <p className="staff-form-success">{updateState.message}</p> : null}<button type="submit" className="staff-primary" disabled={updating}><Save /> {updating ? "جارٍ الحفظ…" : "حفظ التعديل"}</button></div>
        </form>
      </section> : null}
      <section className="staff-card staff-checklist-form-card">
        <div className="staff-card-head">
          <div>
            <p className="staff-eyebrow">{editing ? "EDIT ITEM" : "NEW ITEM"}</p>
            <h2>{editing ? "تعديل بند" : "إضافة بند جديد"}</h2>
          </div>
          {editing ? (
            <button
              type="button"
              className="staff-icon-button"
              onClick={() => setEditing(null)}
            >
              <X /> <span>إلغاء التعديل</span>
            </button>
          ) : (
            <ListPlus className="staff-checklist-head-icon" />
          )}
        </div>

        <form
          ref={formRef}
          key={editing?.id ?? "new"}
          className="staff-form staff-checklist-form"
          action={(form) => startTransition(() => saveAction(form))}
          onSubmit={() => setEditing(null)}
        >
          {editing ? <input type="hidden" name="template_id" value={editing.id} /> : null}
          {owner ? <label className="staff-field-wide"><span>الفرع</span><select name="branch_id" required defaultValue={editing?.branch_id ?? branches?.[0]?.id ?? ""}>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label> : null}
          <label className="staff-field-wide">
            <span>عنوان البند</span>
            <input
              name="title"
              required
              maxLength={200}
              defaultValue={editing?.title ?? ""}
              placeholder="مثال: نظافة البار قبل التسليم"
            />
          </label>
          <label>
            <span>الدور المستهدف</span>
            <select name="role" defaultValue={editing?.role ?? ""}>
              {TARGET_ROLES.map((role) => (
                <option key={role || "all"} value={role}>
                  {role ? ROLE_LABELS[role] : "جميع أدوار الحضور"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>ترتيب الظهور</span>
            <input
              name="sort_order"
              type="number"
              min="0"
              max="999"
              defaultValue={editing?.sort_order ?? 0}
            />
          </label>
          <label className="staff-checklist-check">
            <input
              name="requires_photo"
              type="checkbox"
              defaultChecked={editing?.requires_photo ?? false}
            />
            <span><Camera /> يتطلب صورة إثبات — لا يكتمل بدونها</span>
          </label>
          <label className="staff-checklist-check">
            <input
              name="is_required"
              type="checkbox"
              defaultChecked={editing?.is_required ?? true}
            />
            <span>بند إلزامي — يمنع إنهاء الوردية</span>
          </label>
          <div className="staff-field-wide">
            {saveState?.error ? <p className="staff-form-error">{saveState.error}</p> : null}
            {saveState?.message && !saveState.error ? (
              <p className="staff-form-success">{saveState.message}</p>
            ) : null}
            <button type="submit" className="staff-primary" disabled={saving}>
              <Save /> {saving ? "جارٍ الحفظ…" : editing ? "حفظ التعديل" : "إضافة البند"}
            </button>
          </div>
        </form>
      </section>

      <section className="staff-card staff-checklist-list">
        <div className="staff-card-head">
          <div>
            <p className="staff-eyebrow">ACTIVE</p>
            <h2>بنود القائمة اليومية</h2>
          </div>
          <span className="staff-team-count">{active.length}</span>
        </div>

        {toggleState?.error ? <p className="staff-form-error">{toggleState.error}</p> : null}

        {active.length === 0 ? (
          <p className="staff-empty">لا توجد بنود بعد — أضف أول بند لقائمة فرعك.</p>
        ) : (
          <ul className="staff-checklist-items">
            {active.map((template) => (
              <li key={template.id}>
                <div className="staff-checklist-item-info">
                  <strong>{template.title}</strong>
                  <span>
                    {roleLabel(template.role)}
                    {template.is_required ? " · إلزامي" : " · اختياري"}
                  </span>
                </div>
                <div className="staff-checklist-item-actions">
                  {template.requires_photo ? (
                    <span className="staff-task-phototag"><Camera /> صورة</span>
                  ) : null}
                  <button
                    type="button"
                    className="staff-checklist-edit"
                    onClick={() => startEdit(template)}
                    aria-label={`تعديل ${template.title}`}
                  >
                    <Pencil />
                  </button>
                  <form action={(form) => startTransition(() => toggleAction(form))}>
                    <input type="hidden" name="template_id" value={template.id} />
                    <input type="hidden" name="next_active" value="false" />
                    <button
                      type="submit"
                      className="staff-checklist-edit staff-checklist-off"
                      disabled={toggling}
                      aria-label={`إيقاف ${template.title}`}
                    >
                      <Power />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {inactive.length > 0 ? (
          <>
            <h3 className="staff-checklist-subhead">بنود موقوفة</h3>
            <ul className="staff-checklist-items" data-inactive="true">
              {inactive.map((template) => (
                <li key={template.id}>
                  <div className="staff-checklist-item-info">
                    <strong>{template.title}</strong>
                    <span>{roleLabel(template.role)}</span>
                  </div>
                  <form action={(form) => startTransition(() => toggleAction(form))}>
                    <input type="hidden" name="template_id" value={template.id} />
                    <input type="hidden" name="next_active" value="true" />
                    <button type="submit" className="staff-secondary" disabled={toggling}>
                      إعادة تفعيل
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </>
  );
}
