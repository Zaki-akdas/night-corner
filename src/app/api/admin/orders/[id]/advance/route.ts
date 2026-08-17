import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logActivity } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import { notifyCustomerAdvanceReceived } from "@/lib/customer-alerts";

const schema = z.object({
  received: z.boolean(),
});

/**
 * Marks a split-payment order's UPI advance as received (or unmarks it).
 * Lightweight manual confirmation — the store checks its UPI app and clicks
 * "Mark UPI received"; no payment gateway involved. Timestamped + audited.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: { select: { mobile: true, email: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentMethod !== "SPLIT") {
    return NextResponse.json(
      { error: "Only split (UPI advance + COD) orders have an advance to confirm" },
      { status: 400 }
    );
  }

  const wasReceived = !!order.advanceReceivedAt;
  const advanceReceivedAt = parsed.data.received ? new Date() : null;
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { advanceReceivedAt },
  });

  let receiptEmail = null;
  if (parsed.data.received && !wasReceived) {
    // First-time confirmation — tell the customer on their phone (SMS /
    // WhatsApp / Messenger per store settings) and in-app, mirroring the
    // gateway-confirmed path in markPaymentVerified.
    receiptEmail = await notifyCustomerAdvanceReceived(
      order.user?.mobile ?? "",
      order.user?.email ?? "",
      order,
      new URL(req.url).origin
    ).catch(() => null);
    await prisma.notification
      .create({
        data: {
          userId: order.userId,
          type: "ORDER",
          title: "UPI advance confirmed ✓",
          body: `Your UPI advance of ${formatINR(order.advancePaid)} for order ${order.orderNumber} is confirmed. Balance ${formatINR(order.balanceDue)} is cash on delivery.`,
        },
      })
      .catch(() => {});
  }

  await logActivity({
    userId: admin.id,
    userName: admin.name ?? "Admin",
    action: parsed.data.received ? "ADVANCE_RECEIVED" : "ADVANCE_UNMARKED",
    entity: "Order",
    entityId: order.id,
    meta: {
      orderNumber: order.orderNumber,
      advance: order.advancePaid,
      received: parsed.data.received,
      receiptEmail: parsed.data.received ? receiptEmail ?? null : undefined,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, advanceReceivedAt: updated.advanceReceivedAt });
}
