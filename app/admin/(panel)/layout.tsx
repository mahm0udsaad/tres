import Link from "next/link";
import { headers } from "next/headers";
import { LogOut } from "lucide-react";
import AdminNav from "../_components/AdminNav";
import { overview } from "../../lib/admin-data";
import { opsConfigured, opsOrigin } from "../../lib/hosts";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const onOpsHost = (await headers()).get("x-ops-host") === "1";
  // Link the menu-admin "Operations" tab at the ops subdomain (external) when a
  // subdomain is configured but we're on the main domain.
  const opsOperationsUrl =
    !onOpsHost && opsConfigured() ? `${opsOrigin()}/admin/operations` : null;

  let newFeedback = 0;
  try {
    newFeedback = (await overview()).newFeedback;
  } catch {
    // DB not reachable yet — render the shell anyway.
  }
  return (
    <div className="admin-shell">
      <AdminNav
        newFeedback={newFeedback}
        opsHost={onOpsHost}
        opsOperationsUrl={opsOperationsUrl}
      />
      <div>
        <header className="admin-topbar">
          <Link href={onOpsHost ? "/admin/operations" : "/admin"} className="brand">
            <span className="mark">T</span>
            <span>
              تريس
              <span className="sub" style={{ display: "block" }}>
                {onOpsHost ? "منظومة العمليات" : "لوحة التحكم"}
              </span>
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
