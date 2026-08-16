import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logActivity, notifyAdmin } from "@/lib/admin";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";
import { broadcastOrderUpdate } from "@/lib/realtime";

const schema = z.object({
  status: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]),
  // Proof of delivery — same requirements as the delivery-app route: a photo
  // and the customer's 4-digit PIN are both required to mark an order
  // DELIVERED. (6-digit PINs remain valid for legacy orders.)
  deliveryPhotoUrl: z.string().url().optional(),
  deliveryPin: z.string().regex(/^\d{4,6}$/).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, user: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const newStatus = parsed.data.status;

  // Proof of delivery: the customer's 4-digit delivery PIN is required before
  // DELIVERED — matches the delivery-app route so the admin panel can't
  // bypass the handover verification.
  if (newStatus === "DELIVERED") {
    if (!parsed.data.deliveryPin) {
      return NextResponse.json({ error: "The customer's delivery PIN is required" }, { status: 400 });
    }
    if (!order.deliveryPin || parsed.data.deliveryPin.trim() !== order.deliveryPin) {
      return NextResponse.json({ error: "Incorrect delivery PIN — ask the customer" }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: newStatus,
        ...(newStatus === "OUT_FOR_DELIVERY" && !order.outForDeliveryAt ? { outForDeliveryAt: new Date() } : {}),
        ...(newStatus === "DELIVERED"
          ? { deliveredAt: new Date(), deliveryPhotoUrl: parsed.data.deliveryPhotoUrl }
          : {}),
      },
    });

    // Restore stock on cancellation/refund if not already cancelled.
    if (
      (newStatus === "CANCELLED" || newStatus === "REFUNDED") &&
      order.status !== "CANCELLED" &&
      order.status !== "REFUNDED"
    ) {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            sold: { decrement: item.quantity },
          },
        });
        await tx.inventoryTx.create({
          data: {
            productId: item.productId,
            change: item.quantity,
            reason: "ADJUSTMENT",
            orderId: order.id,
            userId: admin.id,
            note: `Stock restored on ${newStatus}`,
          },
        });
      }
    }
  });

  // Notify customer.
  await prisma.notification
    .create({
      data: {
        userId: order.userId,
        type: "ORDER",
        title: "Order update",
        body: `Your order ${order.orderNumber} is now ${newStatus.replace(/_/g, " ")}`,
      },
    })
    .catch(() => {});

  if (newStatus === "CANCELLED") {
    notifyAdmin("ORDER", "🔔 Order cancelled", `${order.orderNumber} was cancelled`).catch(() => {});
  }

  // Live push to the delivery dashboard / tracking pages. Awaited so the
  // serverless function doesn't freeze before the WebSocket completes.
  await broadcastOrderUpdate({ orderId: order.id, orderNumber: order.orderNumber, status: newStatus }).catch(() => {});

  // Await the activity-log write — fire-and-forget promises can be dropped
  // when a serverless function (Vercel) freezes right after the response.
  await logActivity({
    userId: admin.id,
    userName: admin.name ?? "Admin",
    action: "ORDER_STATUS_CHANGED",
    entity: "Order",
    entityId: order.id,
    meta: { from: order.status, to: newStatus },
  });

  return NextResponse.json({ ok: true });
}
