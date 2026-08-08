"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Camera, ListPlus, Pencil, Power, Save, X } from "lucide-react";
import { ROLE_LABELS, type ChecklistTemplate, type StaffRole } from "../../lib/staff-shared";
import { saveChecklistTemplate, toggleChecklistTemplate } from "./actions";

const TARGET_ROLES: (StaffRole | "")[] = [
  "",
  "supervisor",
  "employee",
  "cleaning_staff",
  "barista",
  "kitchen_manager",
];

function roleLabel(role: StaffRole | null) {
  return role ? ROLE_LABELS[role] : "جميع أدوار الحضور";
}

export default function ChecklistManager({ templates, branches, owner = false }: { templates: ChecklistTemplate[]; branches?: { id: string; name: string }[]; owner?: boolean }) {
  const [saveState, saveAction, saving] = useActionState(saveChecklistTemplate, undefined);
  const [toggleState, toggleAction, toggling] = useActionState(toggleChecklistTemplate, undefined);
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function startEdit(template: ChecklistTemplate) {
    setEditing(template);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const active = templates.filter((template) => template.is_active);
  const inactive = templates.filter((template) => !template.is_active);

  return (
    <>
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
