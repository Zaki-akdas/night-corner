import type { Order, OrderItem } from "@prisma/client";
import { formatINR, getSettings } from "./settings";

/**
 * SMS sender. Uses Fast2SMS (simple Indian provider, REST + API key) when
 * FAST2SMS_API_KEY is set. Without credentials it returns ok:true so flows
 * still work in demo mode — mirroring the WhatsApp lib's behavior.
 * Server-side only: never call this from the client.
 */
export async function sendSmsMessage(
  phone: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    // Demo mode: no provider configured — pretend success.
    return { ok: true };
  }
  try {
    const res = await fetch(
      "https://www.fast2sms.com/dev/bulkV2?" +
        new URLSearchParams({
          authorization: apiKey,
          message,
          language: "english",
          route: "qtp",
          numbers: phone.replace(/[^\d]/g, ""),
        })
    );
    const data = (await res.json().catch(() => ({}))) as { return?: boolean; message?: string };
    if (!res.ok || data.return === false) {
      return { ok: false, error: data.message || `SMS failed (HTTP ${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * SMS the store owner when a new order is placed. This is the SMS counterpart
 * to notifyOrderToBusiness (WhatsApp): it's a reliable channel even when the
 * WhatsApp business account isn't set up. Message is compact — SMS is charged
 * per segment. Sent to the same owner number as the WhatsApp alert.
 */
export async function notifyOrderToBusinessSms(
  order: Order & { items: OrderItem[] },
  addressText: string,
  customerName: string,
  customerMobile: string
): Promise<{ ok: boolean; error?: string }> {
  const settings = await getSettings();
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const time = new Date(order.createdAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const msg = [
    "🌙 NEW ORDER — NIGHT CORNER",
    `Order: ${order.orderNumber}`,
    `Total: ${formatINR(order.total)} · ${itemCount} item(s) · ${order.paymentMethod}${order.paymentMethod === "SPLIT" ? ` (collect ${formatINR(order.balanceDue)} cash)` : ""}`,
    `Customer: ${customerName} · ${customerMobile}`,
    `Address: ${addressText}`,
    `Time: ${time}`,
  ].join("\n");
  return sendSmsMessage(settings.whatsappNumber, msg);
}
