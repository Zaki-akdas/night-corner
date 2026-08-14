import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logActivity } from "@/lib/admin";

const schema = z.object({ assignedTo: z.string().nullable() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  let assignedToName: string | null = null;
  if (parsed.data.assignedTo) {
    const staff = await prisma.user.findUnique({ where: { id: parsed.data.assignedTo } });
    if (!staff || !["STAFF", "ADMIN"].includes(staff.role)) {
      return NextResponse.json({ error: "Not a delivery staff account" }, { status: 400 });
    }
    assignedToName = staff.name || staff.email || staff.mobile || null;
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { assignedTo: parsed.data.assignedTo, assignedToName },
  });

  await logActivity({
    userId: admin.id,
    userName: admin.name ?? undefined,
    action: parsed.data.assignedTo ? "ASSIGN_DELIVERY" : "UNASSIGN_DELIVERY",
    entity: "ORDER",
    entityId: id,
    meta: { orderNumber: order.orderNumber, assignedTo: parsed.data.assignedTo, assignedToName },
  });

  return NextResponse.json(updated);
}
