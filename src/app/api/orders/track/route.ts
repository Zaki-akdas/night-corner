import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const orderNumber = new URL(req.url).searchParams.get("orderNumber")?.trim();
  if (!orderNumber) return NextResponse.json({ error: "Enter an order number" }, { status: 400 });
  const order = await prisma.order.findUnique({
    where: { orderNumber: orderNumber.toUpperCase() },
    select: { orderNumber: true, status: true, total: true, createdAt: true, paymentMethod: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json(order);
}
