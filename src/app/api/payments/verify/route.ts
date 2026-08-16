import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";
import { gatewayConfigured, verifyPaymentSignature, markPaymentVerified } from "@/lib/payments";

const schema = z.object({
  orderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

/**
 * Client-side verification: the Razorpay checkout returns a payment id +
 * signature; we verify the HMAC and mark the order paid. The webhook remains
 * the authoritative confirmation, but this gives the customer instant feedback.
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
  if (!order.paymentId) {
    return NextResponse.json({ error: "No payment was started for this order" }, { status: 400 });
  }

  const valid = verifyPaymentSignature({
    orderId: order.paymentId,
    paymentId: parsed.data.razorpayPaymentId,
    signature: parsed.data.razorpaySignature,
  });
  if (!valid) {
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  await markPaymentVerified(order.id, {
    paymentRef: parsed.data.razorpayPaymentId,
    via: "CLIENT",
  });
  return NextResponse.json({ ok: true });
}
