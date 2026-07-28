import type { Metadata } from "next";
import "./staff.css";

export const metadata: Metadata = {
  title: "لوحة الموظفين — تريس",
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="staff-app">{children}</div>;
}
