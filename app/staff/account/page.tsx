import Link from "next/link";
import { ArrowRight, KeyRound } from "lucide-react";
import { requireStaff } from "../../lib/staff";
import { dashboardLang } from "../../lib/staff-shared";
import PasswordForm from "./PasswordForm";
import OwnerNavigation from "../owner/OwnerNavigation";

export const dynamic = "force-dynamic";

export default async function StaffAccountPage() {
  const { profile } = await requireStaff();
  const lang = dashboardLang(profile);
  const owner = profile.role === "owner";
  return <main className="staff-content staff-account-page">{owner ? <OwnerNavigation variant="bar" /> : <Link className="staff-back-link" href="/staff"><ArrowRight /> {lang === "bn" ? "ড্যাশবোর্ড" : lang === "en" ? "Dashboard" : "لوحة الموظف"}</Link>}<section className="staff-welcome"><div><h1>{lang === "bn" ? "পাসওয়ার্ড পরিবর্তন" : lang === "en" ? "Change password" : "تغيير كلمة المرور"}</h1><p>{lang === "bn" ? "আপনার বর্তমান পাসওয়ার্ড লিখুন, তারপর একটি নতুন পাসওয়ার্ড বেছে নিন।" : lang === "en" ? "Enter your current password, then choose a new one." : "أدخل كلمة المرور الحالية ثم اختر كلمة جديدة سهلة التذكر وآمنة."}</p></div><div className="staff-branch-pill"><KeyRound /> {profile.full_name}</div></section><PasswordForm lang={lang} /></main>;
}
