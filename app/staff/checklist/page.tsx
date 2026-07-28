import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { requireStaff } from "../../lib/staff";
import type { ChecklistTemplate } from "../../lib/staff-shared";
import ChecklistManager from "./ChecklistManager";
import "./checklist.css";

export const dynamic = "force-dynamic";

export default async function StaffChecklistPage() {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "supervisor") redirect("/staff");

  const { data: branch } = profile.branch_id
    ? await supabase
        .from("branches")
        .select("id,name")
        .eq("id", profile.branch_id)
        .maybeSingle()
    : { data: null };

  if (!branch) {
    return (
      <main className="staff-content">
        <Link className="staff-back-link" href="/staff"><ArrowRight /> لوحة الموظفين</Link>
        <section className="staff-card staff-no-branch">
          <MapPin />
          <h1>لم يتم تعيين فرع</h1>
          <p>تواصل مع الإدارة لتعيين فرع لحسابك قبل إدارة قائمة المهام.</p>
        </section>
      </main>
    );
  }

  const { data: templates } = await supabase
    .from("checklist_templates")
    .select("id,branch_id,role,title,requires_photo,is_required,sort_order,is_active")
    .eq("branch_id", branch.id)
    .order("sort_order")
    .order("created_at");

  return (
    <main className="staff-content staff-checklist-page">
      <Link className="staff-back-link" href="/staff"><ArrowRight /> لوحة الموظفين</Link>

      <section className="staff-welcome">
        <div>
          <p className="staff-eyebrow">DAILY CHECKLIST</p>
          <h1>قائمة مهام الفرع</h1>
          <p>
            بنود تتكرر يوميًا وتظهر لموظفيك عند بدء الوردية — البنود التي تتطلب
            صورة لا يمكن إكمالها بدون إثبات مصوّر.
          </p>
        </div>
        <div className="staff-branch-pill"><MapPin /> {branch.name}</div>
      </section>

      <ChecklistManager templates={(templates ?? []) as ChecklistTemplate[]} />
    </main>
  );
}
