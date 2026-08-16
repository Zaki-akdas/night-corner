import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";
import { logActivity } from "./admin";

/**
 * Razorpay-compatible payment gateway helpers. The gateway is OPTIONAL: when
 * NEXT_PUBLIC_PAYMENT_GATEWAY_KEY / PAYMENT_GATEWAY_SECRET are not set the
 * store keeps the manual UPI flow (pay to the shop's UPI ID) and the
 * ship-gate is disabled. When configured, UPI and split advances are verified
 * by real captured payments before an order can go OUT_FOR_DELIVERY.
 *
 * Server-side only — never import from a client component.
 */
const GATEWAY_API = "https://api.razorpay.com/v1";

export function gatewayConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_KEY && process.env.PAYMENT_GATEWAY_SECRET
  );
}

function authHeader(): string {
  const key = process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_KEY!;
  const secret = process.env.PAYMENT_GATEWAY_SECRET!;
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Creates a Razorpay order (amount in INR) and returns the gateway order id. */
export async function createRazorpayOrder(opts: {
  amount: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string }> {
  const res = await fetch(`${GATEWAY_API}/orders`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(opts.amount * 100), // paise
      currency: "INR",
      receipt: opts.receipt.slice(0, 40),
      notes: opts.notes ?? {},
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Payment gateway error (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Verifies the client-side success signature ("<rzOrderId>|<rzPaymentId>"). */
export function verifyPaymentSignature(opts: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.PAYMENT_GATEWAY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret)
    .update(`${opts.orderId}|${opts.paymentId}`)
    .digest("hex");
  return safeEqual(expected, opts.signature);
}

/** Verifies the webhook X-Razorpay-Signature over the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.PAYMENT_GATEWAY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

/**
 * Marks an order's payment as gateway-verified:
 *  - UPI orders → paymentStatus PAID + paymentVerifiedAt
 *  - Split orders → advanceReceivedAt (advance captured; balance stays COD)
 * Idempotent: a second capture for the same order is a no-op. Notifies the
 * customer in-app and writes an ActivityLog entry.
 */
export async function markPaymentVerified(
  orderId: string,
  opts: { paymentRef: string; via: "WEBHOOK" | "CLIENT" }
): Promise<{ changed: boolean }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  const isSplit = order.paymentMethod === "SPLIT";
  if (isSplit) {
    if (order.advanceReceivedAt) return { changed: false };
  } else if (order.paymentStatus === "PAID") {
    return { changed: false };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: isSplit
      ? { advanceReceivedAt: new Date() }
      : { paymentStatus: "PAID", paymentVerifiedAt: new Date() },
  });

  try {
    await prisma.notification.create({
      data: {
        userId: order.userId,
        type: "ORDER",
        title: isSplit ? "UPI advance confirmed ✓" : "Payment received ✓",
        body: isSplit
          ? `Your UPI advance of ₹${order.advancePaid} for order ${order.orderNumber} is confirmed. Balance ₹${order.balanceDue} is cash on delivery.`
          : `Your payment of ₹${order.total} for order ${order.orderNumber} has been received. Thank you!`,
      },
    });
  } catch {
    // non-critical
  }

  await logActivity({
    userId: order.userId,
    action: "PAYMENT_VERIFIED",
    entity: "Order",
    entityId: order.id,
    meta: {
      orderNumber: order.orderNumber,
      method: order.paymentMethod,
      amount: isSplit ? order.advancePaid : order.total,
      paymentRef: opts.paymentRef,
      via: opts.via,
    },
  }).catch(() => {});

  return { changed: true };
}
