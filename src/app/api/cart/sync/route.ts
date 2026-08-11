import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1) })),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({ items: [] }));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ items: [] });

  const ids = parsed.data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: ids } } });

  const items = parsed.data.items
    .map((i) => {
      const p = products.find((x) => x.id === i.productId);
      if (!p) return null;
      return {
        productId: p.id,
        name: p.name,
        slug: p.slug,
        image: p.image,
        unitPrice: p.price,
        mrp: p.mrp,
        maxStock: p.stock,
        unit: p.unit,
        quantity: Math.min(i.quantity, p.stock),
      };
    })
    .filter(Boolean);

  return NextResponse.json({ items });
}
