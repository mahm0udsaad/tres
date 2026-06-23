import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MenuExperience from "../MenuExperience";
import { availableItemImages } from "../../lib/itemImages";
import { getMenu, getMenuCategory } from "../../lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = await getMenuCategory(category);
  if (!cat) {
    return { title: "المنيو", alternates: { canonical: "/menu" } };
  }
  const title = `${cat.ar} — المنيو`;
  const description = `${cat.ar} في تريس — ${cat.tagline}. كل الأسعار بالريال السعودي.`;
  return {
    title,
    description,
    alternates: { canonical: `/menu/${cat.id}` },
    openGraph: {
      title: `${cat.ar} — منيو تريس`,
      description,
      url: `/menu/${cat.id}`,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const { categories } = await getMenu();
  const cat = categories.find((c) => c.id === category);
  if (!cat) notFound();
  return <MenuExperience initialId={category} images={availableItemImages()} categories={categories} />;
}
