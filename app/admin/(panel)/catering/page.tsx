import CateringManager from "../../_components/CateringManager";
import { listCateringPackages, type AdminCateringPackage } from "../../../lib/admin-data";

export const dynamic = "force-dynamic";

export default async function CateringAdminPage() {
  let packages: AdminCateringPackage[] = [];
  try {
    packages = await listCateringPackages();
  } catch {
    // migration not applied yet — the manager shows its empty state
  }
  return <CateringManager packages={packages} />;
}
