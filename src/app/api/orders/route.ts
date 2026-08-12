import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getOpenStatus } from "@/lib/hours";
import { computeOrderPricing } from "@/lib/pricing";
import { generateOrderNumber } from "@/lib/orders";
import { notifyOrderToBusiness } from "@/lib/whatsapp";
import { logActivity, notifyAdmin } from "@/lib/admin";

const schema = z.object({
  items: z
    .array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(50) }))
    .min(1),
  addressId: z.string(),
  paymentMethod: z.enum(["COD", "UPI", "ONLINE"]),
  couponCode: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order data" }, { status: 400 });
  }
  const { items, addressId, paymentMethod, couponCode } = parsed.data;

  const settings = await getSettings();
  const status = getOpenStatus(settings);
  if (!status.isOpen) {
    return NextResponse.json(
      { error: "Ordering is currently closed. We open at 10 PM." },
      { status: 403 }
    );
  }

  // Validate address belongs to user and has coordinates.
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: session.user.id },
  });
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  if (!address.lat || !address.lng) {
    return NextResponse.json({ error: "Address location is required" }, { status: 400 });
  }

  // Validate payment method is enabled.
  if (paymentMethod === "COD" && !settings.codEnabled)
    return NextResponse.json({ error: "COD is currently unavailable" }, { status: 400 });
  if (paymentMethod === "UPI" && !settings.upiEnabled)
    return NextResponse.json({ error: "UPI is currently unavailable" }, { status: 400 });
  if (paymentMethod === "ONLINE" && !settings.onlineEnabled)
    return NextResponse.json({ error: "Online payment is currently unavailable" }, { status: 400 });

  try {
    // Fetch full product records for SKU/image snapshots.
    const productRecords = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
    });
    const productMap = new Map(productRecords.map((p) => [p.id, p]));

    // Recompute price/delivery server-side (never trust client totals).
    const pricing = await computeOrderPricing(settings, items, {
      lat: address.lat,
      lng: address.lng,
      couponCode,
    });
    if (pricing.subtotal < settings.minOrderAmount) {
      return NextResponse.json(
        { error: `Minimum order is ₹${settings.minOrderAmount}` },
        { status: 400 }
      );
    }

    // Atomic-ish order creation with stock re-check & deduction.
    const orderNumber = await generateOrderNumber();
    const result = await prisma.$transaction(async (tx) => {
      // Re-check stock under transaction.
      for (const line of items) {
        const p = await tx.product.findUnique({ where: { id: line.productId } });
        if (!p || !p.active) throw new Error("A product is no longer available");
        if (line.quantity > p.stock)
          throw new Error(`Only ${p.stock} of ${p.name} available`);
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: session.user.id,
          addressId: address.id,
          addressSnapshot: JSON.stringify(address),
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          deliveryCharge: pricing.deliveryCharge,
          tax: pricing.tax,
          total: pricing.total,
          distanceKm: pricing.distanceKm,
          paymentMethod,
          paymentStatus: paymentMethod === "COD" ? "PENDING" : "PENDING",
          couponCode: pricing.couponCode,
          status: "PLACED",
          eta: `${settings.deliveryTimeMins} mins`,
          items: {
            create: pricing.lines.map((l) => {
              const p = productMap.get(l.productId)!;
              return {
                productId: l.productId,
                name: l.name,
                sku: p.sku,
                image: p.image,
                unitPrice: l.unitPrice,
                quantity: l.quantity,
                lineTotal: l.lineTotal,
              };
            }),
          },
        },
        include: { items: true },
      });

      // Deduct stock & record inventory transactions.
      for (const line of items) {
        await tx.product.update({
          where: { id: line.productId },
          data: {
            stock: { decrement: line.quantity },
            sold: { increment: line.quantity },
          },
        });
        await tx.inventoryTx.create({
          data: {
            productId: line.productId,
            change: -line.quantity,
            reason: "ORDER",
            orderId: order.id,
            userId: session.user.id,
            note: `Order ${order.orderNumber}`,
          },
        });
      }

      // Increment coupon usage.
      if (pricing.couponCode) {
        await tx.coupon.update({
          where: { code: pricing.couponCode },
          data: { usedCount: { increment: 1 } },
        });
      }

      return order;
    });

    // Notifications & activity log. These are DB writes, so await them before
    // responding — on serverless (Vercel) the function may be frozen right after
    // the response, silently dropping fire-and-forget promises.
    const addressText = [
      address.fullName,
      address.mobile,
      [address.house, address.street].filter(Boolean).join(", "),
      [address.area, address.landmark].filter(Boolean).join(", "),
      `${address.city} - ${address.pincode}`,
      address.state,
    ].join("\n");
    const customerName = session.user.name || address.fullName;
    const customerMobile = address.mobile;

    try {
      await prisma.notification.create({
        data: {
          userId: session.user.id,
          type: "ORDER",
          title: "Order confirmed 🎉",
          body: `Your order ${orderNumber} has been placed.`,
        },
      });
      await logActivity({
        userId: session.user.id,
        userName: customerName,
        action: "ORDER_PLACED",
        entity: "Order",
        entityId: result.id,
        meta: { total: result.total },
      });
      await notifyAdmin(
        "ORDER",
        "🔔 New order",
        `${orderNumber} · ₹${result.total} · ${customerName}`
      );
    } catch {
      // Non-critical: order is already placed; never fail the response on these.
    }

    // External WhatsApp notification — non-blocking is fine.
    notifyOrderToBusiness(result, addressText, customerName, customerMobile).catch(() => {});

    return NextResponse.json({
      orderId: result.id,
      orderNumber: result.orderNumber,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}


