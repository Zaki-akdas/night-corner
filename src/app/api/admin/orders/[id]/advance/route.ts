import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logActivity } from "@/lib/admin";

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

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentMethod !== "SPLIT") {
    return NextResponse.json(
      { error: "Only split (UPI advance + COD) orders have an advance to confirm" },
      { status: 400 }
    );
  }

  const advanceReceivedAt = parsed.data.received ? new Date() : null;
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { advanceReceivedAt },
  });

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
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, advanceReceivedAt: updated.advanceReceivedAt });
}
