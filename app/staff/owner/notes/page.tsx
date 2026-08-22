import { CalendarDays, MessageSquareText } from "lucide-react";
import { redirect } from "next/navigation";
import { requireStaff } from "../../../lib/staff";
import OwnerNavigation from "../OwnerNavigation";
import "../owner.css";

export const dynamic = "force-dynamic";

type NoteHistoryRow = {
  entity_type: string;
  entity_id: string;
  employee_id: string;
  employee_name: string;
  title: string;
  record_date: string;
  note: string;
  created_at: string;
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    calendar: "gregory",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function OwnerNotesPage() {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") redirect("/staff");

  const { data, error } = await supabase.rpc("get_owner_note_history", {
    p_employee_id: null,
    p_limit: 500,
    p_offset: 0,
  });
  const notes = (data ?? []) as NoteHistoryRow[];

  return (
    <main className="staff-content owner-notes-page">
      <OwnerNavigation variant="bar" />
      <section className="staff-welcome">
        <div>
          <h1>سجل ملاحظات الموظفين</h1>
          <p>كل ملاحظة محفوظة باسم الموظف وتاريخ المهمة؛ لا تختفي بعد الإرسال.</p>
        </div>
        <div className="staff-branch-pill">
          <MessageSquareText /> {notes.length} ملاحظة
        </div>
      </section>

      <section className="staff-card owner-note-history">
        {error ? (
          <p className="staff-form-error">تعذّر تحميل الملاحظات. حاول مرة أخرى.</p>
        ) : notes.length ? (
          <ol>
            {notes.map((note) => (
              <li key={`${note.entity_type}:${note.entity_id}`}>
                <div className="owner-note-history-head">
                  <div>
                    <strong>{note.employee_name}</strong>
                    <span>{note.title}</span>
                  </div>
                  <time dateTime={note.created_at}>
                    <CalendarDays /> {dateLabel(note.record_date)} · {timeLabel(note.created_at)}
                  </time>
                </div>
                <p>{note.note}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="staff-empty">لا توجد ملاحظات مرسلة حتى الآن.</p>
        )}
      </section>
    </main>
  );
}
