import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, logActivity, notifyAdmin } from "@/lib/admin";
import { broadcastOrderUpdate } from "@/lib/realtime";

/**
 * Accept / claim an order.
 *
 * A delivery rider taps "Accept" on an available (unassigned) order and it
 * becomes theirs: assignedTo is locked to them and the order no longer shows
 * in the shared pool. Admins may reassign an order to anyone (or unassign).
 */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireRole("STAFF", "ADMIN");

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // A rider may only claim orders that aren't already taken by someone else.
  if (staff.role !== "ADMIN" && order.assignedTo && order.assignedTo !== staff.id) {
    return NextResponse.json({ error: "This order is already assigned to another rider" }, { status: 403 });
  }

  const data: { assignedTo: string; assignedToName: string | null } = {
    assignedTo: staff.id,
    assignedToName: staff.name || staff.email || null,
  };

  await prisma.order.update({ where: { id: order.id }, data });

  await logActivity({
    userId: staff.id,
    userName: staff.name ?? "Delivery Staff",
    action: "ASSIGN_DELIVERY",
    entity: "Order",
    entityId: order.id,
    meta: { orderNumber: order.orderNumber, assignedTo: staff.id, assignedToName: data.assignedToName, via: "DELIVERY_ACCEPT" },
  });

  notifyAdmin(
    "ORDER",
    "🛵 Order accepted",
    `${staff.name ?? "A rider"} accepted ${order.orderNumber}`
  ).catch(() => {});

  await broadcastOrderUpdate({ orderId: order.id, orderNumber: order.orderNumber, status: order.status }).catch(() => {});

  return NextResponse.json({ ok: true, assignedTo: data.assignedTo, assignedToName: data.assignedToName });
}
