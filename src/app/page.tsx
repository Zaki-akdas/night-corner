import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getOpenStatus } from "@/lib/hours";
import { Hero } from "@/components/home/hero";
import { ProductCard } from "@/components/product-card";
import { CategoryGrid } from "@/components/home/category-grid";
import { HowItWorks } from "@/components/home/how-it-works";
import { DeliveryArea } from "@/components/home/delivery-area";
import { Reviews } from "@/components/home/reviews";
import { FAQ } from "@/components/home/faq";
import { CTA } from "@/components/home/cta";
import { SectionHeading } from "@/components/home/section-heading";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { Product } from "@prisma/client";
import { OpenBadgeServer } from "@/components/home/open-badge";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function HomePage() {
  const settings = await getSettings();
  const status = getOpenStatus(settings);

  const [bestSellers, bakery, snacks, chocolates, instant, drinks, deals] =
    await Promise.all([
      prisma.product.findMany({ where: { bestSeller: true, active: true }, take: 8 }),
      prisma.product.findMany({
        where: { category: { slug: "bakery-desserts" }, active: true },
        take: 6,
      }),
      prisma.product.findMany({
        where: { category: { slug: "chips-namkeen" }, active: true },
        take: 6,
      }),
      prisma.product.findMany({
        where: { category: { slug: "chocolates-sweets" }, active: true },
        take: 6,
      }),
      prisma.product.findMany({
        where: { category: { slug: "instant-food" }, active: true },
        take: 6,
      }),
      prisma.product.findMany({
        where: { category: { slug: "drinks-energy" }, active: true },
        take: 6,
      }),
      prisma.product.findMany({
        where: { active: true },
        take: 8,
        orderBy: [{ sold: "desc" }, { updatedAt: "desc" }],
      }),
    ]);

  return (
    <>
      <Hero />

      {/* Open/Closed status banner */}
      <section className="relative z-10 mx-auto -mt-6 max-w-6xl px-4">
        <OpenBadgeServer
          isOpen={status.isOpen}
          label={status.label}
          nextWindowLabel={status.nextWindowLabel}
          openTime={settings.openTime}
          closeTime={settings.closeTime}
          secondsUntilChange={status.secondsUntilChange}
        />
      </section>

      {/* Categories */}
      <CategoryGrid />

      {/* Best sellers */}
      <SectionShell id="best-sellers">
        <SectionHeading
          eyebrow="🔥 Best Sellers"
          title="Tonight's Most-Loved Picks"
          subtitle="What Indore is ordering after dark."
          action={<Link href="/shop?sort=popular" className="btn-ghost text-sm">View all</Link>}
        />
        <ProductGrid products={bestSellers} firstPriority />
      </SectionShell>

      {/* Midnight cravings / deals */}
      <SectionShell>
        <SectionHeading
          eyebrow="⚡ Midnight Cravings"
          title="Sweet Deals for the Night Owls"
          subtitle="Discounts that hit different after midnight."
          action={<Link href="/shop?discount=true" className="btn-ghost text-sm">All deals</Link>}
        />
        <ProductGrid products={deals} />
      </SectionShell>

      {/* Bakery */}
      <SectionShell>
        <SectionHeading
          eyebrow="🧁 Bakery Fresh Tonight"
          title="Baked for Tonight"
          subtitle="Limited fresh stock — once it's gone, it's gone."
          action={<Link href="/category/bakery-desserts" className="btn-ghost text-sm">View bakery</Link>}
        />
        <ProductGrid products={bakery} />
      </SectionShell>

      {/* Snacks */}
      <SectionShell>
        <SectionHeading
          eyebrow="🥨 Snacks"
          title="Crunch Through the Night"
          action={<Link href="/category/chips-namkeen" className="btn-ghost text-sm">View snacks</Link>}
        />
        <ProductGrid products={snacks} />
      </SectionShell>

      {/* Chocolates */}
      <SectionShell>
        <SectionHeading
          eyebrow="🍫 Chocolates"
          title="Sweet Tooth, Sorted"
          action={<Link href="/category/chocolates-sweets" className="btn-ghost text-sm">View chocolates</Link>}
        />
        <ProductGrid products={chocolates} />
      </SectionShell>

      {/* Instant food */}
      <SectionShell>
        <SectionHeading
          eyebrow="🍜 Instant Food"
          title="Midnight Hunger, Solved in Minutes"
          action={<Link href="/category/instant-food" className="btn-ghost text-sm">View instant food</Link>}
        />
        <ProductGrid products={instant} />
      </SectionShell>

      {/* Drinks */}
      <SectionShell>
        <SectionHeading
          eyebrow="🥤 Drinks"
          title="Cold Drinks, Energy Boosts"
          action={<Link href="/category/drinks-energy" className="btn-ghost text-sm">View drinks</Link>}
        />
        <ProductGrid products={drinks} />
      </SectionShell>

      <HowItWorks />
      <DeliveryArea settings={settings} />
      <Reviews />
      <FAQ />
      <CTA whatsappNumber={settings.whatsappNumber} />
    </>
  );
}

function SectionShell({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-7xl px-4 py-14">
      {children}
    </section>
  );
}

function ProductGrid({ products, firstPriority }: { products: Product[]; firstPriority?: boolean }) {
  if (!products.length) {
    return (
      <div className="card grid place-items-center p-10 text-center text-slate-400">
        <Sparkles className="mb-2 h-8 w-8 text-neon-purple" />
        Products coming soon.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:gap-5">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={firstPriority && i === 0 ? true : undefined} />
      ))}
    </div>
  );
}
