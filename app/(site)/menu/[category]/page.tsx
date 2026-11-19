import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MenuBoard from "../MenuBoard";
import MenuClassic from "../MenuClassic";
import { availableItemImages } from "../../../lib/itemImages";
import { getMenu, getMenuCategory } from "../../../lib/data";
import { getActiveTheme } from "../../../lib/theme";

// Prerender every live category at build time; one added later renders on its
// first visit and is cached from then on.
export async function generateStaticParams() {
  const { categories } = await getMenu();
  return categories.map((c) => ({ category: c.id }));
}

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
  const [{ categories }, theme] = await Promise.all([getMenu(), getActiveTheme()]);
  const cat = categories.find((c) => c.id === category);
  if (!cat) notFound();
  const Menu = theme === "winter" ? MenuBoard : MenuClassic;
  return <Menu initialId={category} images={availableItemImages()} categories={categories} />;
}
