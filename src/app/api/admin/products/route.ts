import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logActivity } from "@/lib/admin";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().min(2),
  shortDesc: z.string().optional(),
  categoryId: z.string(),
  price: z.number().min(0),
  mrp: z.number().min(0),
  stock: z.number().int().min(0),
  unit: z.string().default("1 pc"),
  sku: z.string().min(2),
  isVeg: z.boolean().default(true),
  featured: z.boolean().default(false),
  bestSeller: z.boolean().default(false),
  keywords: z.string().optional(),
  freshnessNote: z.string().optional(),
  image: z.string().optional(),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const data = parsed.data;
  const baseSlug = slugify(data.name);
  let slug = baseSlug;
  let n = 1;
  while (await prisma.product.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++n}`;
  }
  try {
    const product = await prisma.product.create({
      data: {
        ...data,
        slug,
        startingStock: data.stock,
        image: data.image || `/images/products/${slug}/1.jpg`,
        thumbnail: data.image || `/images/products/${slug}/1.jpg`,
      },
    });
    logActivity({
      userId: admin.id,
      userName: admin.name ?? "Admin",
      action: "PRODUCT_CREATED",
      entity: "Product",
      entityId: product.id,
    });
    return NextResponse.json(product);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      const target = (e as { meta?: { target?: string[] } }).meta?.target?.join(", ");
      return NextResponse.json(
        { error: `A product with this ${target || "value"} already exists` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not create product" }, { status: 400 });
  }
}
