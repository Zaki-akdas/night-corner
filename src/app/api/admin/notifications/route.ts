import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  await requireAdmin();
  const unread = new URL(req.url).searchParams.get("unread");
  const count = await prisma.notification.count({ where: unread ? { read: false, userId: null } : {} });
  return NextResponse.json({ count });
}

export async function POST() {
  await requireAdmin();
  await prisma.notification.updateMany({ where: { read: false, userId: null }, data: { read: true } });
  return NextResponse.json({ ok: true });
}
