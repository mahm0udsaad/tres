import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { requireStaff } from "../../../lib/staff";
import OwnerStaffManager from "../OwnerStaffManager";
import { loadOwnerOverview } from "../overview";
import "../../team/team.css";
import "../owner.css";

export const dynamic = "force-dynamic";

export default async function OwnerTeamPage() {
  const { profile, supabase } = await requireStaff();
  if (profile.role !== "owner") redirect("/staff");
  const { overview, error } = await loadOwnerOverview(supabase, 1);
  if (!overview) return <main className="staff-content"><p className="staff-form-error">{error ?? "تعذّر تحميل الفريق."}</p></main>;
  return <main className="staff-content staff-team-page owner-staff-page">
    <Link className="staff-back-link" href="/staff/owner"><ArrowRight /> لوحة المالك</Link>
    <section className="staff-welcome"><div><p className="staff-eyebrow">OWNER TEAM</p><h1>إدارة الفريق</h1><p>أنشئ حسابات الموظفين والمشرفين واختر فرع كل حساب.</p></div><div className="staff-branch-pill"><MapPin /> {overview.branches.length} فروع</div></section>
    <OwnerStaffManager branches={overview.branches} staff={overview.staff} />
  </main>;
}
