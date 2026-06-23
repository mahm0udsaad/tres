import type { Metadata } from "next";
import MenuExperience from "./MenuExperience";
import { availableItemImages } from "../lib/itemImages";
import { getMenu } from "../lib/data";

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
  const { categories } = await getMenu();
  return <MenuExperience initialId={null} images={availableItemImages()} categories={categories} />;
}
