import type { Metadata } from "next";
import MenuExperience from "./MenuExperience";
import { availableItemImages } from "../lib/itemImages";

export const metadata: Metadata = {
  title: "المنيو — تريس",
  description: "تصفّح منيو تريس: القهوة المختصة، القهوة، المشروبات والحلا. كل الأسعار بالريال السعودي.",
};

export default function MenuPage() {
  return <MenuExperience initialId={null} images={availableItemImages()} />;
}
