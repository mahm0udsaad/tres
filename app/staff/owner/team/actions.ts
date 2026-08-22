"use server";

import { requireStaff } from "../../../lib/staff";

export type EmployeeTaskDetail = {
  id: string;
  user_id: string;
  task_date: string;
  title: string;
  completed: boolean;
  is_required: boolean;
  response_type: "completion" | "yes_no";
  yes_no_answer: boolean | null;
  employee_note: string | null;
};

export type EmployeeReportDetail = {
  id: string;
  submitted_by: string;
  report_date: string;
  status: string;
  created_at: string;
  type: string;
  note: string;
  employee_note: string | null;
};

export type EmployeeDetailsResult = {
  tasks: EmployeeTaskDetail[];
  reports: EmployeeReportDetail[];
};

type NoteRow = {
  entity_type: string;
  entity_id: string;
  note: string;
};

export async function loadOwnerEmployeeDetails(
  employeeId: string,
): Promise<{ data?: EmployeeDetailsResult; error?: string }> {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") return { error: "هذا الإجراء متاح للمالك فقط." };
  if (!/^[0-9a-f-]{36}$/i.test(employeeId)) return { error: "حساب الموظف غير صالح." };

  const [tasks, cleaning, barista, kitchen, water, notes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,user_id,task_date,title,completed,is_required,response_type,yes_no_answer")
      .eq("user_id", employeeId)
      .eq("task_type", "general_duty")
      .order("task_date", { ascending: false })
      .limit(100),
    supabase
      .from("cleaning_reports")
      .select("id,submitted_by,report_date,status,cleanliness_notes,created_at")
      .eq("submitted_by", employeeId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("barista_reports")
      .select("id,submitted_by,report_date,status,handover_notes,created_at")
      .eq("submitted_by", employeeId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("kitchen_reports")
      .select("id,submitted_by,report_date,status,cleanliness_notes,created_at")
      .eq("submitted_by", employeeId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("water_quality_checks")
      .select("id,recorded_by,check_date,salt_ratio,created_at")
      .eq("recorded_by", employeeId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.rpc("get_owner_note_history", {
      p_employee_id: employeeId,
      p_limit: 250,
      p_offset: 0,
    }),
  ]);

  const firstError = [tasks, cleaning, barista, kitchen, water, notes].find(
    (result) => result.error,
  )?.error;
  if (firstError) return { error: "تعذّر تحميل سجل الموظف. حاول مرة أخرى." };

  const noteByEntity = new Map(
    ((notes.data ?? []) as NoteRow[]).map((row) => [
      `${row.entity_type}:${row.entity_id}`,
      row.note,
    ]),
  );

  return {
    data: {
      tasks: (tasks.data ?? []).map((task) => ({
        ...task,
        employee_note: noteByEntity.get(`task:${task.id}`) ?? null,
      })) as EmployeeTaskDetail[],
      reports: [
        ...(cleaning.data ?? []).map((row) => ({
          ...row,
          type: "النظافة",
          note: row.cleanliness_notes,
          employee_note: noteByEntity.get(`cleaning_report:${row.id}`) ?? null,
        })),
        ...(barista.data ?? []).map((row) => ({
          ...row,
          type: "الباريستا",
          note: row.handover_notes,
          employee_note: noteByEntity.get(`barista_report:${row.id}`) ?? null,
        })),
        ...(kitchen.data ?? []).map((row) => ({
          ...row,
          type: "المطبخ",
          note: row.cleanliness_notes,
          employee_note: noteByEntity.get(`kitchen_report:${row.id}`) ?? null,
        })),
        ...(water.data ?? []).map((row) => ({
          id: row.id,
          submitted_by: row.recorded_by,
          report_date: row.check_date,
          status: "recorded",
          created_at: row.created_at,
          type: "فحص المياه",
          note: `نسبة الأملاح: ${row.salt_ratio}`,
          employee_note: noteByEntity.get(`water_check:${row.id}`) ?? null,
        })),
      ]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 30) as EmployeeReportDetail[],
    },
  };
}
