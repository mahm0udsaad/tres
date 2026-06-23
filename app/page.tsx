import { getMenu, getHome } from "./lib/data";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ categories }, home] = await Promise.all([getMenu(), getHome()]);
  return <HomeClient categories={categories} today={home.today} best={home.best} />;
}
