import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="a-login">
      <div className="a-login-card">
        <div className="a-login-mark">T</div>
        <h1>لوحة تحكم تريس</h1>
        <p>أدخل رمز الدخول لإدارة موقعك</p>
        <LoginForm next={next ?? "/admin"} />
      </div>
    </div>
  );
}
