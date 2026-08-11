import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product-card";
import { ShopFilters } from "@/components/shop/shop-filters";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  category?: string;
  min?: string;
  max?: string;
  sort?: string;
  veg?: string;
  available?: string;
  discount?: string;
};

export default async function ShopPage({ searchParams }: { searchParams: SP }) {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  });

  const where: Prisma.ProductWhereInput = { active: true };
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q } },
      { shortDesc: { contains: searchParams.q } },
      { keywords: { contains: searchParams.q } },
      { sku: { contains: searchParams.q.toUpperCase() } },
    ];
  }
  if (searchParams.category) {
    where.category = { slug: searchParams.category };
  }
  if (searchParams.veg === "1") where.isVeg = true;
  if (searchParams.available === "1") where.stock = { gt: 0 };
  const priceFilter: Prisma.FloatFilter = {};
  if (searchParams.min) priceFilter.gte = Number(searchParams.min);
  if (searchParams.max) priceFilter.lte = Number(searchParams.max);
  if (Object.keys(priceFilter).length) where.price = priceFilter;

  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
  if (searchParams.sort === "price-asc") orderBy = { price: "asc" };
  if (searchParams.sort === "price-desc") orderBy = { price: "desc" };
  if (searchParams.sort === "newest") orderBy = { createdAt: "desc" };

  let products = await prisma.product.findMany({ where, orderBy, take: 60 });
  if (searchParams.discount === "1") products = products.filter((p) => p.mrp > p.price);
  if (searchParams.sort === "popular")
    products = products.sort((a, b) => Number(b.bestSeller) - Number(a.bestSeller) || b.sold - a.sold);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Shop <span className="heading-gradient">Midnight Essentials</span>
        </h1>
        <p className="mt-1 text-slate-400">
          {products.length} products · open 10 PM – 6 AM · delivery within 10 KM
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <ShopFilters
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
          active={searchParams}
        />
        <div>
          {products.length === 0 ? (
            <div className="card grid place-items-center p-16 text-center">
              <div className="text-5xl">🔍</div>
              <p className="mt-3 text-slate-300">No products match your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
