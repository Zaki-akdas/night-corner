import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const body = await req.json();
  const coupon = await prisma.coupon.update({ where: { id: params.id }, data: body });
  return NextResponse.json(coupon);
}
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  await prisma.coupon.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
