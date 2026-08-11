import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logActivity } from "@/lib/admin";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const body = await req.json();
  const product = await prisma.product.update({ where: { id: params.id }, data: body });
  logActivity({
    userId: admin.id,
    userName: admin.name ?? "Admin",
    action: "PRODUCT_UPDATED",
    entity: "Product",
    entityId: product.id,
    meta: body,
  });
  return NextResponse.json(product);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  await prisma.product.update({ where: { id: params.id }, data: { active: false } });
  logActivity({
    userId: admin.id,
    userName: admin.name ?? "Admin",
    action: "PRODUCT_DELETED",
    entity: "Product",
    entityId: params.id,
  });
  return NextResponse.json({ ok: true });
}
