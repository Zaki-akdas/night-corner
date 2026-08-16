import { sendWhatsappMessage, type WhatsAppTemplateParams } from "./whatsapp";
import { sendSmsMessage } from "./sms";
import { sendMessengerMessage, getMessengerPsid } from "./messenger";
import { getSettings, formatINR, type AppSettings } from "./settings";
import { paymentMethodLabel } from "./orders";

/**
 * Customer order-status alerts via SMS + WhatsApp. Used at every milestone —
 * order placed (with the proof-of-delivery PIN), out for delivery, delivered —
 * through whichever channels the store has enabled (Admin → Settings). External
 * I/O never fails the caller; every sender catches its own errors and this
 * helper swallows failures.
 */
export type CustomerOrderStatus = "PLACED" | "OUT_FOR_DELIVERY" | "DELIVERED";

export type OrderLike = {
  orderNumber: string;
  total: number;
  eta?: string | null;
  deliveryPin?: string | null;
  paymentMethod?: string;
  advancePaid?: number;
  balanceDue?: number;
  userId?: string | null;
};

export function buildCustomerOrderMessage(
  order: OrderLike,
  status: CustomerOrderStatus,
  origin: string
): string {
  const trackUrl = `${origin}/track-order?order=${order.orderNumber}`;
  switch (status) {
    case "PLACED":
      return [
        `🌙 Order confirmed! Your Night Corner order ${order.orderNumber} is in.`,
`Total: ${formatINR(order.total)}${order.paymentMethod ? ` · ${paymentMethodLabel(order.paymentMethod)}` : ""}`,
order.paymentMethod === "SPLIT" && order.advancePaid ? `💳 Pay ${formatINR(order.advancePaid)} now via UPI — balance ${formatINR(order.balanceDue ?? 0)} cash on delivery.` : "",
        order.eta ? `Estimated delivery: ${order.eta}.` : "",
        order.deliveryPin
          ? `🔑 Your delivery PIN: ${order.deliveryPin} — keep it ready. Your delivery person will ask for it at handover.`
          : "",
        `Track live: ${trackUrl}`,
      ]
        .filter(Boolean)
        .join("\n");
    case "OUT_FOR_DELIVERY":
      return [
        `🌙 Your Night Corner order ${order.orderNumber} is out for delivery!`,
        order.eta ? `Estimated arrival: ${order.eta}.` : "",
        order.deliveryPin
          ? `🔑 Your delivery PIN: ${order.deliveryPin} (tell the delivery person at handover)`
          : "",
        `Track live: ${trackUrl}`,
      ]
        .filter(Boolean)
        .join("\n");
    case "DELIVERED":
      return [
        `✅ Your Night Corner order ${order.orderNumber} has been delivered!`,
        "Enjoy your midnight treats. 🌙 See you again soon!",
      ].join("\n");
  }
}

export async function notifyCustomerOrderStatus(
  mobile: string,
  order: OrderLike,
  status: CustomerOrderStatus,
  origin: string
): Promise<void> {
  if (!mobile) return;
  const settings = await getSettings().catch(() => null);
  if (!settings) return;
  const msg = buildCustomerOrderMessage(order, status, origin);
  await sendToCustomerPhone(mobile, msg, settings, {
    userId: order.userId,
    whatsappTemplate: order.deliveryPin
      ? { parameters: [order.orderNumber, order.deliveryPin] }
      : undefined,
  });
}

/** Compact message for the "Resend PIN" action (the original confirmation
 * message was missed or deleted). Sends only the PIN + how to use it. */
export function buildDeliveryPinMessage(order: OrderLike, origin: string): string {
  const trackUrl = `${origin}/track-order?order=${order.orderNumber}`;
  return [
    `🔑 Your Night Corner delivery PIN for order ${order.orderNumber}: ${order.deliveryPin}`,
    "Share it with your delivery person at handover — and don't share it with anyone else.",
    order.eta ? `Estimated delivery: ${order.eta}.` : "",
    `Track live: ${trackUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Re-sends just the delivery PIN to the customer's phone via the store's
 * enabled channels (WhatsApp and/or SMS). Swallows failures like the other
 * senders — external I/O never fails the caller. */
export async function resendCustomerDeliveryPin(
  mobile: string,
  order: OrderLike,
  origin: string
): Promise<void> {
  if (!mobile || !order.deliveryPin) return;
  const settings = await getSettings().catch(() => null);
  if (!settings) return;
  await sendToCustomerPhone(mobile, buildDeliveryPinMessage(order, origin), settings, {
    userId: order.userId,
    whatsappTemplate: { parameters: [order.orderNumber, order.deliveryPin] },
  });
}

/** Confirmation message for a split order whose UPI advance the store received. */
export function buildAdvanceReceivedMessage(order: OrderLike, origin: string): string {
  const trackUrl = `${origin}/track-order?order=${order.orderNumber}`;
  return [
    `✅ UPI advance received for order ${order.orderNumber}!`,
    `We've confirmed your advance of ${formatINR(order.advancePaid ?? 0)} via UPI.`,
    `Balance ${formatINR(order.balanceDue ?? 0)} is cash on delivery.`,
    `Track live: ${trackUrl}`,
  ].join("\n");
}

/** Fires the advance-received confirmation to the customer's phone via the
 * store's enabled channels (WhatsApp, SMS, Messenger) — mirroring the other
 * order alerts. Never throws: external I/O failures are swallowed. */
export async function notifyCustomerAdvanceReceived(
  mobile: string,
  order: OrderLike,
  origin: string
): Promise<void> {
  if (!mobile) return;
  const settings = await getSettings().catch(() => null);
  if (!settings) return;
  await sendToCustomerPhone(mobile, buildAdvanceReceivedMessage(order, origin), settings, {
    userId: order.userId,
  });
}

/** Shared sender: fans the message out to whichever channels the store has
 * enabled — WhatsApp, SMS, and Messenger (when a PSID is known for this
 * customer) — never throwing on external failures. */
async function sendToCustomerPhone(
  mobile: string,
  msg: string,
  settings: AppSettings,
  opts?: { userId?: string | null; whatsappTemplate?: WhatsAppTemplateParams }
): Promise<void> {
  const sends: Promise<unknown>[] = [];
  if (settings.notifyWhatsapp) sends.push(sendWhatsappMessage(mobile, msg, opts?.whatsappTemplate));
  if (settings.notifySms) sends.push(sendSmsMessage(mobile, msg));
  if (settings.notifyMessenger) {
    // Messenger needs the customer's PSID — silently skipped until their
    // Messenger chat is linked (webhook / Connect on Messenger link).
    const psid = await getMessengerPsid({ mobile, userId: opts?.userId });
    if (psid) sends.push(sendMessengerMessage(psid, msg));
  }
  await Promise.all(sends).catch(() => {});
}
