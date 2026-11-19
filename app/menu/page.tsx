import type { Metadata } from "next";
import MenuBoard from "./MenuBoard";
import MenuClassic from "./MenuClassic";
import { availableItemImages } from "../lib/itemImages";
import { getMenu } from "../lib/data";
import { getActiveTheme } from "../lib/theme";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "المنيو",
  description:
    "شوف منيو تريس: القهوة المختصة، مشاريب الحليب، الماتشا والحلا. كل الأسعار بالريال السعودي.",
  alternates: { canonical: "/menu" },
  openGraph: {
    title: "المنيو — تريس",
    description: "شوف منيو تريس: القهوة المختصة، مشاريب الحليب، الماتشا والحلا.",
    url: "/menu",
  },
};

export default async function MenuPage() {
  const [{ categories }, theme] = await Promise.all([getMenu(), getActiveTheme()]);
  // The menu-board redesign belongs to the winter skin; every other skin keeps
  // the menu it already has.
  const Menu = theme === "winter" ? MenuBoard : MenuClassic;
  return <Menu initialId={null} images={availableItemImages()} categories={categories} />;
}
