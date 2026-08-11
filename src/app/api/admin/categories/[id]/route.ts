import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logActivity } from "@/lib/admin";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const body = await req.json();
  const cat = await prisma.category.update({ where: { id: params.id }, data: body });
  logActivity({ userId: admin.id, userName: admin.name ?? "Admin", action: "CATEGORY_UPDATED", entity: "Category", entityId: cat.id });
  return NextResponse.json(cat);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  // Reassign products to an "Uncategorized" fallback if needed, then delete.
  const fallback =
    (await prisma.category.findUnique({ where: { slug: "uncategorized" } })) ??
    (await prisma.category.create({
      data: { name: "Uncategorized", slug: "uncategorized", order: 999 },
    }));
  await prisma.product.updateMany({ where: { categoryId: params.id }, data: { categoryId: fallback.id } });
  await prisma.category.delete({ where: { id: params.id } });
  logActivity({ userId: admin.id, userName: admin.name ?? "Admin", action: "CATEGORY_DELETED", entity: "Category", entityId: params.id });
  return NextResponse.json({ ok: true });
}
