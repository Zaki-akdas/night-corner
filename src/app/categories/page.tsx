import { prisma } from "@/lib/prisma";
import { CategoryGrid } from "@/components/home/category-grid";

export const dynamic = "force-dynamic";

export default function CategoriesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-2 font-display text-3xl font-extrabold text-white">All Categories</h1>
      <p className="mb-8 text-slate-400">Browse every section of the Night Corner midnight store.</p>
      <CategoryGrid />
    </div>
  );
}
