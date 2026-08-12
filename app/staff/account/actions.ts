"use server";

import { requireStaff } from "../../lib/staff";

export type PasswordActionState = { error?: string; message?: string };

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function changeOwnPassword(
  _previous: PasswordActionState | undefined,
  form: FormData,
): Promise<PasswordActionState> {
  const { supabase } = await requireStaff();
  const currentPassword = text(form.get("current_password"));
  const password = text(form.get("password"));
  const confirmation = text(form.get("password_confirmation"));
  if (!currentPassword) return { error: "أدخل كلمة المرور الحالية." };
  if (password.length < 8) return { error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." };
  if (password !== confirmation) return { error: "تأكيد كلمة المرور غير مطابق." };
  if (password === currentPassword) return { error: "اختر كلمة مرور جديدة مختلفة." };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { error: "انتهت الجلسة. سجل الدخول مرة أخرى." };
  const user = userData.user;
  const identifier = user.phone
    ? { phone: user.phone.startsWith("+") ? user.phone : `+${user.phone}`, password: currentPassword }
    : user.email
      ? { email: user.email, password: currentPassword }
      : null;
  if (!identifier) return { error: "لا يوجد رقم جوال مرتبط بالحساب." };
  const verified = await supabase.auth.signInWithPassword(identifier);
  if (verified.error) return { error: "كلمة المرور الحالية غير صحيحة." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "weak_password") return { error: "كلمة المرور الجديدة ضعيفة. استخدم 8 أحرف على الأقل مع أرقام ورموز." };
    if (code === "reauthentication_needed" || code === "invalid_credentials") return { error: "كلمة المرور الحالية غير صحيحة." };
    return { error: "تعذّر تغيير كلمة المرور. تحقق من الحالية وحاول مرة أخرى." };
  }
  return { message: "تم تغيير كلمة المرور بنجاح. استخدمها في تسجيل الدخول القادم." };
}
