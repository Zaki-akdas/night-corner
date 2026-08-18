import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import Link from "next/link";
import { ArrowLeft, Plus, Package } from "lucide-react";
import { CategoryProductTable } from "./category-product-table";

export const dynamic = "force-dynamic";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();

  const [category, allCategories] = await Promise.all([
    prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!category) notFound();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/categories"
          className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-extrabold text-white">
            {category.name}
          </h1>
          <p className="text-slate-400">
            {category.products.length} product{category.products.length !== 1 ? "s" : ""} · /{category.slug}
            {category.description && (
              <span className="ml-2 text-slate-500">· {category.description}</span>
            )}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="btn-primary py-2 text-sm"
        >
          <Plus className="h-4 w-4" /> Add Product
        </Link>
      </div>

      {/* Product Table */}
      {category.products.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center">
          <Package className="mb-4 h-12 w-12 text-slate-600" />
          <p className="text-lg font-semibold text-white">No products yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Add products to this category or assign existing products to it.
          </p>
          <Link
            href="/admin/products/new"
            className="btn-primary mt-4 py-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Add Product
          </Link>
        </div>
      ) : (
        <CategoryProductTable
          products={category.products}
          totalCount={category.products.length}
          categories={allCategories}
        />
      )}
    </div>
  );
}
