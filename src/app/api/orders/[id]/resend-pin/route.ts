import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, logActivity } from "@/lib/admin";
import { parseAddressSnapshot } from "@/lib/address";
import { resendCustomerDeliveryPin } from "@/lib/customer-alerts";

// Cooldown between PIN resends — the message goes out over paid SMS/WhatsApp
// channels, so throttle it. Stored in the activity log so the limit holds
// across serverless instances.
const RESEND_COOLDOWN_MS = 2 * 60_000; // 2 minutes

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const order = await prisma.order.findFirst({
    where:
      (user as { role?: string }).role === "ADMIN"
        ? { id }
        : { id, userId: user.id },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!order.deliveryPin) {
    return NextResponse.json({ error: "No delivery PIN on this order" }, { status: 400 });
  }
  if (["CANCELLED", "REFUNDED", "DELIVERED"].includes(order.status)) {
    return NextResponse.json({ error: "This order no longer needs a delivery PIN" }, { status: 400 });
  }

  // Rate-limit: one resend per order every couple of minutes.
  const recent = await prisma.activityLog.findFirst({
    where: {
      action: "PIN_RESENT",
      entityId: order.id,
      createdAt: { gte: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return NextResponse.json(
      { error: "Delivery PIN was just sent — try again in a couple of minutes" },
      { status: 429 }
    );
  }

  const mobile = parseAddressSnapshot(order.addressSnapshot)?.mobile;
  if (!mobile) {
    return NextResponse.json({ error: "No mobile number on this order" }, { status: 400 });
  }

  // Sends via the store's enabled channels (WhatsApp and/or SMS). External I/O
  // failures are swallowed inside the sender — never fail the request on them.
  await resendCustomerDeliveryPin(mobile, order, new URL(req.url).origin);

  await logActivity({
    userId: user.id,
    userName: user.name ?? "Customer",
    action: "PIN_RESENT",
    entity: "Order",
    entityId: order.id,
    meta: { orderNumber: order.orderNumber },
  });

  return NextResponse.json({ ok: true });
}
