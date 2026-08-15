import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logActivity } from "@/lib/admin";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const count = await prisma.category.count();
  const baseSlug = slugify(parsed.data.name);
  let slug = baseSlug;
  let n = 1;
  while (await prisma.category.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++n}`;
  }
  let cat;
  try {
    cat = await prisma.category.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        slug,
        order: count,
        image: `/images/categories/${baseSlug}.svg`,
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Category already exists" }, { status: 409 });
    }
    throw e;
  }
  logActivity({ userId: admin.id, userName: admin.name ?? "Admin", action: "CATEGORY_CREATED", entity: "Category", entityId: cat.id });
  return NextResponse.json(cat);
}
