import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireAdmin();
  const categories = await prisma.category.findMany({ orderBy: { order: "asc" } });
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-extrabold text-white">Add Product</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
