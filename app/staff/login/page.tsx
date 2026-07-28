import StaffLoginForm from "./StaffLoginForm";

export const dynamic = "force-dynamic";

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="staff-login">
      <section className="staff-login-card">
        <div className="staff-login-mark">T</div>
        <p className="staff-eyebrow">TRES · STAFF</p>
        <h1>لوحة فريق تريس</h1>
        <p>سجّل دخولك لبدء الوردية ومتابعة مهام اليوم.</p>
        {query.error === "profile" ? (
          <div className="staff-alert staff-alert--error">
            الحساب غير مرتبط بملف موظف نشط. تواصل مع الإدارة.
          </div>
        ) : null}
        {query.error === "config" ? (
          <div className="staff-alert staff-alert--error">
            لم يتم إعداد اتصال Supabase للموظفين بعد.
          </div>
        ) : null}
        <StaffLoginForm next={query.next ?? "/staff"} />
      </section>
    </main>
  );
}
