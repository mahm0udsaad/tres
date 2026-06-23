import MenuManager from "../../_components/MenuManager";
import { adminMenu } from "../../../lib/admin-data";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  let menu: Awaited<ReturnType<typeof adminMenu>> = [];
  try {
    menu = await adminMenu();
  } catch {
    // DB not reachable yet.
  }
  return <MenuManager menu={menu} />;
}
