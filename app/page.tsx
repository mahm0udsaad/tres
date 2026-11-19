import { getMenu, getHome } from "./lib/data";
import HomeClient from "./HomeClient";
import WinterHome from "./WinterHome";
import FindUs from "./components/FindUs";
import { getActiveTheme } from "./lib/theme";

export const dynamic = "force-dynamic";

export default async function Home() {
  const theme = await getActiveTheme();

  // Winter: the owner wants the home page to be the choices and nothing else —
  // the tile screen, then فروعنا (the map) under it. The menu has its own page
  // behind the first tile, so it is not repeated here. The page snaps from
  // one section to the next as it scrolls (.wn-page in winter-theme.css).
  if (theme === "winter") {
    return (
      <div className="page wn-page">
        <WinterHome />
        <FindUs />
      </div>
    );
  }

  const [{ categories }, home] = await Promise.all([getMenu(), getHome()]);
  // The branch block reads the store settings on the server, so it is handed
  // to the client shell as a slot.
  return (
    <HomeClient categories={categories} today={home.today} best={home.best} findUs={<FindUs />} />
  );
}
