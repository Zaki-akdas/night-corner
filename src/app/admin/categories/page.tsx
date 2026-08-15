import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { CategoryManager } from "./category-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold text-white">Categories</h1>
      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? "",
          image: c.image ?? "",
          order: c.order,
          active: c.active,
          productCount: c._count.products,
        }))}
      />
    </div>
  );
}
