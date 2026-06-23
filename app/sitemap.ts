import type { MetadataRoute } from "next";
import { getMenu } from "./lib/data";
import { SITE_URL } from "./lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const { categories } = await getMenu();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/menu`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/complaints`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/menu/${c.id}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes].map((r) => ({
    lastModified: now,
    ...r,
  }));
}
