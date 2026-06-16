import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES, getCategory } from "../../lib/menu";
import MenuExperience from "../MenuExperience";
import { availableItemImages } from "../../lib/itemImages";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = getCategory(category);
  return {
    title: cat ? `${cat.ar} — منيو تريس` : "المنيو — تريس",
    description: cat ? `${cat.ar} — ${cat.tagline}. منيو تريس.` : undefined,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!getCategory(category)) notFound();
  return <MenuExperience initialId={category} images={availableItemImages()} />;
}
