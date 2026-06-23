import Link from "next/link";
import { LogOut } from "lucide-react";
import AdminNav from "../_components/AdminNav";
import { overview } from "../../lib/admin-data";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  let newFeedback = 0;
  try {
    newFeedback = (await overview()).newFeedback;
  } catch {
    // DB not reachable yet — render the shell anyway.
  }
  return (
    <div className="admin-shell">
      <AdminNav newFeedback={newFeedback} />
      <div>
        <header className="admin-topbar">
          <Link href="/admin" className="brand">
            <span className="mark">T</span>
            <span>
              تريس
              <span className="sub" style={{ display: "block" }}>لوحة التحكم</span>
            </span>
          </Link>
          <span className="spacer" />
          <form action={logout}>
            <button type="submit" className="a-iconbtn" aria-label="تسجيل الخروج">
              <LogOut strokeWidth={2} />
            </button>
          </form>
        </header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
