import "server-only";
import { supabaseAdmin } from "./supabase";

/**
 * The only module that touches the service-role Auth admin API for staff
 * provisioning. It creates/deletes bare auth.users records — profile
 * registration (branch scoping + role allowlist) always happens through the
 * `register_branch_staff` RPC under the supervisor's own session, so the
 * database enforces the delegation limits even if this server code changes.
 *
 * Never import this from client components or from anywhere under app/staff —
 * scripts/check-staff-security.mjs guards the staff tree against service-role
 * access.
 */

export type CreatedAuthUser =
  | { userId: string; error: null }
  | { userId: null; error: string };

export async function createStaffAuthUser(email: string, password: string): Promise<CreatedAuthUser> {
  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    return { userId: null, error: "لم يتم إعداد مفاتيح الخادم بعد. تواصل مع الإدارة." };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data?.user) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "email_exists") {
      return { userId: null, error: "هذا البريد الإلكتروني مستخدم مسبقًا لحساب آخر." };
    }
    if (code === "weak_password") {
      return { userId: null, error: "كلمة المرور ضعيفة — استخدم 8 أحرف على الأقل." };
    }
    return { userId: null, error: "تعذّر إنشاء الحساب. حاول مرة أخرى." };
  }

  return { userId: data.user.id, error: null };
}

/** Best-effort rollback when profile registration fails after auth creation. */
export async function deleteStaffAuthUser(userId: string): Promise<void> {
  try {
    await supabaseAdmin().auth.admin.deleteUser(userId);
  } catch {
    // The orphaned auth user has no staff profile, so it cannot use /staff;
    // the owner can remove it from the Supabase dashboard if needed.
  }
}
