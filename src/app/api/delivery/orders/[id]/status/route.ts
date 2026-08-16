import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, logActivity, notifyAdmin } from "@/lib/admin";
import { statusLabel } from "@/lib/orders";
import { parseAddressSnapshot } from "@/lib/address";
import { broadcastOrderUpdate } from "@/lib/realtime";
import { notifyCustomerOrderStatus } from "@/lib/customer-alerts";

// Delivery staff may only move orders forward through the final two steps.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OUT_FOR_DELIVERY: ["PLACED", "CONFIRMED", "PREPARING", "PACKED"],
  DELIVERED: ["PLACED", "CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY"],
};

const schema = z.object({
  status: z.enum(["OUT_FOR_DELIVERY", "DELIVERED"]),
  // 4-digit PINs are current; 6-digit values remain valid for legacy orders
  // created before the 4-digit format was reintroduced.
  deliveryPin: z.string().regex(/^\d{4,6}$/).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireRole("STAFF", "ADMIN");

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const newStatus = parsed.data.status;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (staff.role !== "ADMIN" && order.assignedTo !== staff.id) {
    return NextResponse.json({ error: "This order is not assigned to you" }, { status: 403 });
  }

  if (!(ALLOWED_TRANSITIONS[newStatus] ?? []).includes(order.status)) {
    return NextResponse.json(
      {
        error: `Cannot mark a ${order.status.replace(/_/g, " ").toLowerCase()} order as ${newStatus.replace(/_/g, " ")}`,
      },
      { status: 400 }
    );
  }

  // Claim on action: when a rider moves an unassigned order forward, it
  // belongs to them from that point on (matches the accept flow).
  if (staff.role !== "ADMIN" && !order.assignedTo) {
    const claim = await prisma.order.update({
      where: { id: order.id },
      data: {
        assignedTo: staff.id,
        assignedToName: staff.name || staff.email || null,
      },
    });
    order.assignedTo = claim.assignedTo;
    order.assignedToName = claim.assignedToName;
    await logActivity({
      userId: staff.id,
      userName: staff.name ?? "Delivery Staff",
      action: "ASSIGN_DELIVERY",
      entity: "Order",
      entityId: order.id,
      meta: { orderNumber: order.orderNumber, assignedTo: staff.id, via: "STATUS_CLAIM" },
    }).catch(() => {});
  }

  // Proof of delivery: the customer's 4-digit delivery PIN is required before
  // an order can be marked Delivered.
  if (newStatus === "DELIVERED") {
    if (!parsed.data.deliveryPin) {
      return NextResponse.json(
        { error: "The customer's delivery PIN is required" },
        { status: 400 }
      );
    }
    if (!order.deliveryPin || parsed.data.deliveryPin.trim() !== order.deliveryPin) {
      return NextResponse.json({ error: "Incorrect delivery PIN — ask the customer" }, { status: 400 });
    }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: newStatus,
      ...(newStatus === "OUT_FOR_DELIVERY" && !order.outForDeliveryAt ? { outForDeliveryAt: new Date() } : {}),
      ...(newStatus === "DELIVERED" ? { deliveredAt: new Date() } : {}),
    },
  });

  // Notify the customer (awaited — serverless may freeze after the response).
  try {
    const body =
      newStatus === "OUT_FOR_DELIVERY" && order.deliveryPin
        ? `Your order ${order.orderNumber} is now Out for Delivery. 🛵\nDelivery PIN: ${order.deliveryPin} — share it at handover.`
        : `Your order ${order.orderNumber} is now ${statusLabel(newStatus)}`;
    await prisma.notification.create({
      data: {
        userId: order.userId,
        type: "ORDER",
        title: "Order update",
        body,
      },
    });
  } catch {
    // non-critical
  }

  if (newStatus === "OUT_FOR_DELIVERY" || newStatus === "DELIVERED") {
    // Tell the customer their order is on the way / delivered — via SMS and/or
    // WhatsApp, whichever the store has enabled. Non-blocking: external I/O
    // must never fail the status update.
    const addr = parseAddressSnapshot(order.addressSnapshot);
    const mobile = addr?.mobile;
    if (mobile) {
      notifyCustomerOrderStatus(mobile, order, newStatus, new URL(req.url).origin).catch(() => {});
    }
  }

  if (newStatus === "DELIVERED") {
    notifyAdmin("ORDER", "✅ Order delivered", `${order.orderNumber} was delivered`).catch(() => {});
  }

  // Live push to the delivery dashboard / tracking pages. Awaited so the
  // serverless function doesn't freeze before the WebSocket completes.
  await broadcastOrderUpdate({ orderId: order.id, orderNumber: order.orderNumber, status: newStatus }).catch(() => {});

  await logActivity({
    userId: staff.id,
    userName: staff.name ?? "Delivery Staff",
    action: "ORDER_STATUS_CHANGED",
    entity: "Order",
    entityId: order.id,
    meta: { from: order.status, to: newStatus, by: "DELIVERY" },
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
