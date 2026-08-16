import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, markPaymentVerified } from "@/lib/payments";

/**
 * Razorpay webhook — the authoritative "payment captured" confirmation.
 * Signature is verified over the RAW body (never re-encoded JSON) with the
 * gateway secret. Idempotent: repeated captures are no-ops. When the gateway
 * is not configured we acknowledge (200) so Razorpay stops retrying.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!process.env.PAYMENT_GATEWAY_SECRET) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number } } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity;
    const gatewayOrderId = payment?.order_id;
    const paymentId = payment?.id ?? "";
    if (!gatewayOrderId) return NextResponse.json({ ok: true });

    const order = await prisma.order.findFirst({ where: { paymentId: gatewayOrderId } });
    if (!order) return NextResponse.json({ ok: true, ignored: true, reason: "unknown order" });

    await markPaymentVerified(order.id, {
      paymentRef: paymentId,
      via: "WEBHOOK",
      origin: new URL(req.url).origin,
    });
  }

  return NextResponse.json({ ok: true });
}
