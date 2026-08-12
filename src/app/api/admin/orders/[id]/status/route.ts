import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logActivity, notifyAdmin } from "@/lib/admin";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

const schema = z.object({ status: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true, user: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const newStatus = parsed.data.status;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: newStatus } });

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
            reason: newStatus === "REFUNDED" ? "ADJUSTMENT" : "ADJUSTMENT",
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
