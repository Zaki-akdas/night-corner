import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { parseAddressSnapshot, formatAddressLine } from "@/lib/address";

export async function GET(req: Request) {
  const orderNumber = new URL(req.url).searchParams.get("orderNumber")?.trim();
  if (!orderNumber) return NextResponse.json({ error: "Enter an order number" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { orderNumber: orderNumber.toUpperCase() },
    select: {
      orderNumber: true,
      status: true,
      total: true,
      createdAt: true,
      paymentMethod: true,
      eta: true,
      distanceKm: true,
      addressSnapshot: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const settings = await getSettings();
  const addr = parseAddressSnapshot(order.addressSnapshot);

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt,
    paymentMethod: order.paymentMethod,
    eta: order.eta,
    distanceKm: order.distanceKm,
    // Delivery pin + shop origin so the client can draw the route map.
    address: addr
      ? {
          lat: typeof addr.lat === "number" ? addr.lat : null,
          lng: typeof addr.lng === "number" ? addr.lng : null,
          line: formatAddressLine(addr),
        }
      : null,
    shop: { lat: settings.shopLat, lng: settings.shopLng },
  });
}
