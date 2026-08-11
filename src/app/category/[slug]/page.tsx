import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const cats = await prisma.category.findMany({ select: { slug: true } });
  return cats.map((c) => ({ slug: c.slug }));
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const category = await prisma.category.findUnique({
    where: { slug: params.slug },
    include: { products: { where: { active: true } } },
  });
  if (!category || !category.active) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="card relative mb-8 overflow-hidden p-8">
        {category.image && (
          <Image src={category.image} alt={category.name} fill className="object-cover opacity-30" />
        )}
        <div className="relative">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-neon-purple">Category</div>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-white sm:text-4xl">{category.name}</h1>
          <p className="mt-2 max-w-2xl text-slate-300">{category.description}</p>
          <p className="mt-1 text-sm text-slate-400">{category.products.length} products</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:gap-5">
        {category.products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
