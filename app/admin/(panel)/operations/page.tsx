import OperationsForms from "../../_components/OperationsForms";
import { supabaseAdmin } from "../../../lib/supabase";
import type { StaffRole } from "../../../lib/staff-shared";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  let branches: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
  }[] = [];
  let profiles: {
    user_id: string;
    full_name: string;
    role: StaffRole;
    branch_id: string | null;
  }[] = [];
  let dbError = "";

  try {
    const supabase = supabaseAdmin();
    const [branchResult, profileResult] = await Promise.all([
      supabase.from("branches").select("id,name,latitude,longitude,radius_meters").order("name"),
      supabase.from("staff_profiles").select("user_id,full_name,role,branch_id").order("full_name"),
    ]);
    if (branchResult.error) throw branchResult.error;
    if (profileResult.error) throw profileResult.error;
    branches = (branchResult.data ?? []) as typeof branches;
    profiles = (profileResult.data ?? []) as typeof profiles;
  } catch (error) {
    dbError = error instanceof Error ? error.message : "تعذّر تحميل بيانات الفريق.";
  }

  return (
    <>
      <div className="admin-page-head">
        <h1>الفريق والفروع</h1>
        <p>إعداد حسابات الموظفين، نطاق الحضور، ومهام اليوم.</p>
      </div>
      {dbError ? (
        <div className="a-card a-card--pad" style={{ marginBottom: 16, color: "var(--danger)", borderColor: "var(--danger)" }}>
          {dbError}. طبّق ترحيل Stage 1 أولاً.
        </div>
      ) : (
        <OperationsForms branches={branches} profiles={profiles} />
      )}
    </>
  );
}
