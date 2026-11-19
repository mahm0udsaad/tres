import { getMenu, getHome } from "./lib/data";
import HomeClient from "./HomeClient";
import WinterHome from "./WinterHome";
import FindUs from "./components/FindUs";
import { getActiveTheme } from "./lib/theme";

export const dynamic = "force-dynamic";

export default async function Home() {
  const theme = await getActiveTheme();
  const [{ categories }, home] = await Promise.all([getMenu(), getHome()]);
  // The branch block reads the store settings on the server, so it is handed
  // to the client shell as a slot.
  return (
    <HomeClient
      categories={categories}
      today={home.today}
      best={home.best}
      findUs={<FindUs />}
      // Winter opens on its tile screen; the sections under it are shared.
      hero={theme === "winter" ? <WinterHome /> : undefined}
    />
  );
}
