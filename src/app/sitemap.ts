import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://nightcorner.in";
  const staticRoutes = ["", "/shop", "/categories", "/track-order", "/faq", "/login", "/signup"].map(
    (p) => ({ url: base + p, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.7 })
  );
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { slug: true, updatedAt: true },
  });
  const categories = await prisma.category.findMany({
    where: { active: true },
    select: { slug: true },
  });
  return [
    ...staticRoutes,
    ...products.map((p) => ({
      url: `${base}/shop/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map((c) => ({
      url: `${base}/category/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
