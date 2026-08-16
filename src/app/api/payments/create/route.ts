import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";
import { gatewayConfigured, createRazorpayOrder } from "@/lib/payments";

const schema = z.object({ orderId: z.string() });

/**
 * Starts a gateway payment for an order: creates a Razorpay order for the
 * amount the customer still owes (full total for UPI, the advance for split)
 * and remembers the gateway order id on the order so the webhook can match it.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!gatewayConfigured()) {
    return NextResponse.json({ error: "Payment gateway is not configured" }, { status: 400 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const order = await prisma.order.findFirst({
    where: { id: parsed.data.orderId, userId: user.id },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (["CANCELLED", "REFUNDED"].includes(order.status)) {
    return NextResponse.json({ error: "This order cannot be paid" }, { status: 400 });
  }
  if (order.paymentMethod === "COD") {
    return NextResponse.json({ error: "This order is cash on delivery — nothing to pay now" }, { status: 400 });
  }
  if (order.paymentMethod === "UPI" && order.paymentStatus === "PAID") {
    return NextResponse.json({ error: "This order is already paid" }, { status: 400 });
  }
  if (order.paymentMethod === "SPLIT" && order.advanceReceivedAt) {
    return NextResponse.json({ error: "The UPI advance is already confirmed" }, { status: 400 });
  }

  const amount = order.paymentMethod === "SPLIT" ? order.advancePaid : order.total;
  if (amount <= 0) return NextResponse.json({ error: "Nothing to pay" }, { status: 400 });

  const rz = await createRazorpayOrder({
    amount,
    receipt: order.orderNumber,
    notes: { order_id: order.id, order_number: order.orderNumber, method: order.paymentMethod },
  });

  // Remember the gateway order id so the webhook / verify step can match it.
  await prisma.order.update({ where: { id: order.id }, data: { paymentId: rz.id } });

  return NextResponse.json({
    razorpayOrderId: rz.id,
    amount: rz.amount / 100,
    currency: rz.currency,
    key: process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_KEY,
  });
}
