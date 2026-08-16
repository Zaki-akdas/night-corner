import { prisma } from "./prisma";

/** Generates the next unique order number in the form NC-YYYY-XXXXX. */
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `NC-${year}-`;
  // Find the highest existing sequence for this year (row-locked inside the transaction).
  const last = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
  });
  let seq = 1;
  if (last) {
    const parts = last.orderNumber.split("-");
    const n = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}${seq.toString().padStart(5, "0")}`;
}

export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    PLACED: "Order Placed",
    CONFIRMED: "Order Confirmed",
    PREPARING: "Preparing",
    PACKED: "Packed",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
    PENDING: "Pending",
    PARTIAL: "Advance Paid (balance due)",
    PAID: "Paid",
    FAILED: "Failed",
  };
  return map[s] ?? s;
}

/** Human label for a payment method. */
export function paymentMethodLabel(m: string): string {
  const map: Record<string, string> = {
    COD: "Cash on Delivery",
    UPI: "UPI",
    SPLIT: "Split (UPI + Cash)",
    ONLINE: "Online",
  };
  return map[m] ?? m;
}
