import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, logActivity, notifyAdmin } from "@/lib/admin";
import { statusLabel } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { sendWhatsappMessage } from "@/lib/whatsapp";
import { sendSmsMessage } from "@/lib/sms";
import { parseAddressSnapshot } from "@/lib/address";

// Delivery staff may only move orders forward through the final two steps.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OUT_FOR_DELIVERY: ["PLACED", "CONFIRMED", "PREPARING", "PACKED"],
  DELIVERED: ["PLACED", "CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY"],
};

const schema = z.object({ status: z.enum(["OUT_FOR_DELIVERY", "DELIVERED"]) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const staff = await requireRole("STAFF", "ADMIN");

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const newStatus = parsed.data.status;

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (!(ALLOWED_TRANSITIONS[newStatus] ?? []).includes(order.status)) {
    return NextResponse.json(
      {
        error: `Cannot mark a ${order.status.replace(/_/g, " ").toLowerCase()} order as ${newStatus.replace(/_/g, " ")}`,
      },
      { status: 400 }
    );
  }

  await prisma.order.update({ where: { id: order.id }, data: { status: newStatus } });

  // Notify the customer (awaited — serverless may freeze after the response).
  try {
    await prisma.notification.create({
      data: {
        userId: order.userId,
        type: "ORDER",
        title: "Order update",
        body: `Your order ${order.orderNumber} is now ${statusLabel(newStatus)}`,
      },
    });
  } catch {
    // non-critical
  }

  if (newStatus === "OUT_FOR_DELIVERY") {
    // Tell the customer their order is on the way — via SMS and/or WhatsApp,
    // whichever the store has enabled. Non-blocking: external I/O must never
    // fail the status update.
    const settings = await getSettings().catch(() => null);
    const addr = parseAddressSnapshot(order.addressSnapshot);
    const mobile = addr?.mobile;
    if (mobile && settings) {
      const trackUrl = `${new URL(req.url).origin}/track-order?order=${order.orderNumber}`;
      const msg = [
        `🌙 Your Night Corner order ${order.orderNumber} is out for delivery!`,
        order.eta ? `Estimated arrival: ${order.eta}.` : "",
        `Track live: ${trackUrl}`,
      ]
        .filter(Boolean)
        .join("\n");
      const sends = [];
      if (settings.notifyWhatsapp) sends.push(sendWhatsappMessage(mobile, msg));
      if (settings.notifySms) sends.push(sendSmsMessage(mobile, msg));
      if (sends.length) {
        // Both senders catch their own errors; never let this affect the response.
        Promise.all(sends).catch(() => {});
      }
    }
  }

  if (newStatus === "DELIVERED") {
    notifyAdmin("ORDER", "✅ Order delivered", `${order.orderNumber} was delivered`).catch(() => {});
  }

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
