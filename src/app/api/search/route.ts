import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ products: [], categories: [] });
  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: q } },
        { shortDesc: { contains: q } },
        { keywords: { contains: q } },
        { sku: { contains: q.toUpperCase() } },
      ],
    },
    select: { name: true, slug: true, image: true, price: true },
    take: 10,
  });
  const categories = await prisma.category.findMany({
    where: { active: true, OR: [{ name: { contains: q } }, { description: { contains: q } }] },
    select: { name: true, slug: true },
    take: 5,
  });
  return NextResponse.json({ products, categories });
}
