import type { Metadata } from "next";
import MenuExperience from "./MenuExperience";
import { availableItemImages } from "../lib/itemImages";

export const metadata: Metadata = {
  title: "المنيو — تريس",
  description: "شوف منيو تريس: القهوة المختصة، مشاريب الحليب، الماتشا والحلا. كل الأسعار بالريال السعودي.",
};

export default function MenuPage() {
  return <MenuExperience initialId={null} images={availableItemImages()} />;
}
