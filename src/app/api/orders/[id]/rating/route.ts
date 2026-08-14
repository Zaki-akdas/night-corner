import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";

const schema = z.object({ rating: z.number().int().min(1).max(5) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });

  const order = await prisma.order.findFirst({ where: { id, userId: user.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "DELIVERED") {
    return NextResponse.json({ error: "Rate the delivery after your order is delivered" }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { deliveryRating: parsed.data.rating },
    select: { deliveryRating: true },
  });

  return NextResponse.json(updated);
}
