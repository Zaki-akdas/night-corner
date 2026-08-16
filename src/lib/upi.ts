/**
 * UPI helpers for the split-payment feature (UPI advance + cash on delivery)
 * and the one-tap "pay via UPI app" deep links shown at checkout and on the
 * order page. Pure helpers only — no server-only imports, so they are safe
 * to use from client components.
 */

export type SplitAdvanceType = "delivery" | "percent" | "fixed";

/**
 * Computes the prepaid (UPI) and cash-on-delivery amounts for a split order.
 * The server recomputes this authoritatively at order time — this pure helper
 * only drives the checkout preview UI.
 */
export function computeSplitAmounts(opts: {
  type: SplitAdvanceType;
  value: number;
  total: number;
  deliveryCharge: number;
}): { advance: number; balance: number } {
  const { type, value, total, deliveryCharge } = opts;
  let advance = 0;
  if (type === "delivery") {
    advance = deliveryCharge;
  } else if (type === "percent") {
    advance = total * ((Number.isFinite(value) ? value : 0) / 100);
  } else {
    advance = Number.isFinite(value) ? value : 0;
  }
  advance = Math.max(0, Math.min(advance, total));
  const balance = Math.max(0, total - advance);
  return {
    advance: Math.round(advance * 100) / 100,
    balance: Math.round(balance * 100) / 100,
  };
}

/**
 * Builds a upi://pay deep link that opens the customer's UPI app with the
 * payee, amount and note pre-filled — one tap to pay.
 */
export function upiPayLink(upiId: string, amount: number, note: string): string {
  const params = new URLSearchParams({
    pa: upiId,
    pn: "Night Corner",
    am: amount.toFixed(2),
    tn: note,
    cu: "INR",
  });
  return `upi://pay?${params.toString()}`;
}
