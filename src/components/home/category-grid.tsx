import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { SectionHeading } from "./section-heading";

export async function CategoryGrid() {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <SectionHeading
        eyebrow="🛍️ Categories"
        title="Explore by Craving"
        subtitle="Six curated sections for everything you need after dark."
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((c, i) => (
          <Link
            key={c.id}
            href={`/category/${c.slug}`}
            className="group card relative aspect-square overflow-hidden p-0"
          >
            {c.image && (
              <Image
                src={c.image}
                alt={c.name}
                fill
                sizes="200px"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                priority={i < 3}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="text-sm font-bold text-white">{c.name}</div>
              <div className="text-[11px] text-slate-300">{c._count.products} items</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
