import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings, formatINR } from "@/lib/settings";
import { ProductDetailClient } from "@/components/product/product-detail-client";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductCard } from "@/components/product-card";
import { Star, Truck, Shield, Clock, Leaf } from "lucide-react";

export const dynamic = "force-dynamic";

function safeParse(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.description,
    openGraph: { images: [product.image] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
    include: { category: true },
  });
  if (!product || !product.active) notFound();
  const settings = await getSettings();

  const related = await prisma.product.findMany({
    where: { categoryId: product.categoryId, active: true, id: { not: product.id } },
    take: 5,
  });
  const fbt = await prisma.product.findMany({
    where: { active: true, bestSeller: true, id: { not: product.id } },
    take: 4,
  });
  const discountPct =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.image,
    description: product.description,
    sku: product.sku,
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: product.price,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-6 text-xs text-slate-400">
        <Link href="/" className="hover:text-white">Home</Link> /{" "}
        <Link href="/shop" className="hover:text-white">Shop</Link> /{" "}
        <Link href={`/category/${product.category.slug}`} className="hover:text-white">{product.category.name}</Link> /{" "}
        <span className="text-slate-200">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <ProductGallery
            images={
              product.gallery ? safeParse(product.gallery) : [product.image]
            }
            productName={product.name}
          />
          {discountPct > 0 && (
            <div className="mt-3">
              <span className="chip bg-neon-purple text-white shadow-neon">{discountPct}% OFF</span>
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
            {product.isVeg ? (
              <span className="chip border border-emerald-500/40 text-emerald-300">
                <Leaf className="h-3 w-3" /> Veg
              </span>
            ) : (
              <span className="chip border border-rose-500/40 text-rose-300">Non-veg</span>
            )}
            <span className="chip border border-white/10 text-slate-300">{product.category.name}</span>
            {product.bestSeller && (
              <span className="chip bg-warm-yellow/90 text-night-900">
                <Star className="h-3 w-3 fill-night-900" /> Best Seller
              </span>
            )}
          </div>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-white">{product.name}</h1>
          <p className="mt-2 text-slate-300">{product.description}</p>
          {product.freshnessNote && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              <Clock className="h-4 w-4" /> {product.freshnessNote}
            </div>
          )}

          <div className="mt-5 flex items-end gap-3">
            <span className="text-4xl font-extrabold text-white">{formatINR(product.price)}</span>
            {product.mrp > product.price && (
              <>
                <span className="pb-1 text-lg text-slate-500 line-through">{formatINR(product.mrp)}</span>
                <span className="pb-1 font-semibold text-emerald-400">{discountPct}% off</span>
              </>
            )}
            <span className="pb-1 ml-auto text-sm text-slate-400">{product.unit}</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-300 sm:grid-cols-3">
            <div className="card flex items-center gap-2 p-2.5"><Truck className="h-4 w-4 text-neon-blue" /> {settings.deliveryTimeMins} min delivery</div>
            <div className="card flex items-center gap-2 p-2.5"><Shield className="h-4 w-4 text-neon-purple" /> Secure checkout</div>
            <div className="card flex items-center gap-2 p-2.5"><Clock className="h-4 w-4 text-warm-yellow" /> 10 PM–6 AM</div>
          </div>

          <div className="mt-5">
            {product.stock > 0 ? (
              <div className="mb-3 text-sm text-emerald-300">
                In stock · only {product.stock} left tonight
              </div>
            ) : (
              <div className="mb-3 text-sm text-rose-300">Out of stock</div>
            )}
          </div>

          <ProductDetailClient product={product} />

          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="card p-3">
              <dt className="text-xs uppercase tracking-wider text-slate-500">SKU</dt>
              <dd className="text-slate-200">{product.sku}</dd>
            </div>
            <div className="card p-3">
              <dt className="text-xs uppercase tracking-wider text-slate-500">Category</dt>
              <dd className="text-slate-200">{product.category.name}</dd>
            </div>
          </dl>
        </div>
      </div>

      {fbt.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 font-display text-2xl font-extrabold text-white">Frequently bought together</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {fbt.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 font-display text-2xl font-extrabold text-white">You might also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
