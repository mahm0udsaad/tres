import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { requireStaff, type StaffProfile } from "../../lib/staff";
import TeamManager from "./TeamManager";
import "./team.css";

export const dynamic = "force-dynamic";

export default async function StaffTeamPage() {
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
          <p>تواصل مع الإدارة لتعيين فرع لحسابك قبل إدارة الفريق.</p>
        </section>
      </main>
    );
  }

  const { data: members } = await supabase
    .from("staff_profiles")
    .select("user_id,full_name,role,branch_id,scheduled_start,is_active")
    .eq("branch_id", branch.id)
    .order("full_name");

  return (
    <main className="staff-content staff-team-page">
      <Link className="staff-back-link" href="/staff"><ArrowRight /> لوحة الموظفين</Link>

      <section className="staff-welcome">
        <div>
          <p className="staff-eyebrow">BRANCH TEAM</p>
          <h1>فريق الفرع</h1>
          <p>أنشئ حسابات موظفي فرعك وسلّمهم بيانات الدخول، أو عطّل الحسابات غير المستخدمة.</p>
        </div>
        <div className="staff-branch-pill"><MapPin /> {branch.name}</div>
      </section>

      <TeamManager
        members={(members ?? []) as StaffProfile[]}
        selfUserId={profile.user_id}
      />
    </main>
  );
}
