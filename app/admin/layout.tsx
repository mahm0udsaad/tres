import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "لوحة التحكم — تريس",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-app">{children}</div>;
}
