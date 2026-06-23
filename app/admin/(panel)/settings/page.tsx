import SettingsForm from "../../_components/SettingsForm";
import { getSettings, type Settings } from "../../../lib/admin-data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let settings: Settings;
  try {
    settings = await getSettings();
  } catch {
    settings = { id: 1, hours: [], announcement: null, announcement_active: false, phone: null, address: null, instagram: null, tiktok: null, snapchat: null, theme: "classic" };
  }
  return (
    <>
      <div className="admin-page-head">
        <h1>الإعدادات</h1>
        <p>معلومات المتجر التي تظهر للزبائن.</p>
      </div>
      <SettingsForm settings={settings} />
    </>
  );
}
