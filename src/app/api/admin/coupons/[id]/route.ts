import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const body = await req.json();
  const coupon = await prisma.coupon.update({ where: { id }, data: body });
  return NextResponse.json(coupon);
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
