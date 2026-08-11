import { prisma } from "./prisma";
import type { AppSettings } from "./settings";

export type CartLine = { productId: string; quantity: number };
export type PriceBreakdown = {
  lines: {
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  tax: number;
  total: number;
  freeDelivery: boolean;
  distanceKm: number;
  couponCode?: string;
};

/**
 * SERVER-SIDE pricing authority. Never trusts price/qty/totals from the client.
 * Re-reads products from DB and recomputes everything.
 */
export async function computeOrderPricing(
  settings: AppSettings,
  lines: CartLine[],
  opts: {
    lat?: number;
    lng?: number;
    couponCode?: string;
  }
): Promise<PriceBreakdown> {
  if (!lines.length) throw new Error("Cart is empty");

  const productIds = lines.map((l) => l.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
  });

  const computedLines = [];
  let subtotal = 0;
  for (const line of lines) {
    const qty = Math.max(1, Math.floor(line.quantity));
    const product = products.find((p) => p.id === line.productId);
    if (!product) throw new Error("Product not found");
    if (!product.active) throw new Error(`${product.name} is unavailable`);
    if (qty > product.stock)
      throw new Error(`Only ${product.stock} of ${product.name} available`);
    const unitPrice = product.price;
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    computedLines.push({
      productId: product.id,
      name: product.name,
      quantity: qty,
      unitPrice,
      lineTotal,
    });
  }

  // delivery
  let deliveryCharge = 0;
  let distanceKm = 0;
  let freeDelivery = false;
  if (opts.lat != null && opts.lng != null) {
    const { computeDelivery } = await import("./delivery");
    const res = computeDelivery(settings, opts.lat, opts.lng, subtotal);
    if (!res.withinRange) throw new Error(res.reason);
    deliveryCharge = res.deliveryCharge;
    distanceKm = res.distanceKm;
    freeDelivery = res.freeDelivery;
  }

  // coupon
  let discount = 0;
  let couponCode: string | undefined;
  if (opts.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: opts.couponCode.toUpperCase().trim() },
    });
    const now = new Date();
    if (
      coupon &&
      coupon.active &&
      subtotal >= coupon.minOrder &&
      (!coupon.startsAt || coupon.startsAt <= now) &&
      (!coupon.expiresAt || coupon.expiresAt >= now) &&
      (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit)
    ) {
      const raw =
        coupon.type === "PERCENT" ? (subtotal * coupon.value) / 100 : coupon.value;
      discount = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
      if (coupon.freeDelivery) {
        deliveryCharge = 0;
        freeDelivery = true;
      }
      couponCode = coupon.code;
    }
  }

  const taxable = Math.max(0, subtotal - discount);
  const tax = +(taxable * (settings.taxPercent / 100)).toFixed(2);
  const total = +(taxable + tax + deliveryCharge).toFixed(2);

  return {
    lines: computedLines,
    subtotal: +subtotal.toFixed(2),
    discount: +discount.toFixed(2),
    deliveryCharge,
    tax,
    total,
    freeDelivery,
    distanceKm,
    couponCode,
  };
}
