import { sendWhatsappMessage, type WhatsAppTemplateParams } from "./whatsapp";
import { sendSmsMessage } from "./sms";
import { sendEmailMessage, emailConfigured } from "./email";
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

/** Receipt-style email the store can send when the UPI advance is confirmed.
 * Plain inline-styled HTML that renders in every mail client. */
export function buildAdvanceReceivedEmailHtml(order: OrderLike, origin: string): string {
  const trackUrl = `${origin}/track-order?order=${order.orderNumber}`;
  const balance = formatINR(order.balanceDue ?? 0);
  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">`,
    `  <div style="background:#0f172a;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">`,
    `    <h1 style="margin:0;font-size:20px">✅ UPI advance received — ${order.orderNumber}</h1>`,
    `  </div>`,
    `  <div style="border:1px solid #e2e8f0;border-top:0;padding:22px;border-radius:0 0 10px 10px">`,
    `    <p style="margin:0 0 14px">Hi there,</p>`,
    `    <p style="margin:0 0 14px">Great news — we've confirmed your UPI advance of <b>${formatINR(order.advancePaid ?? 0)}</b> for order <b>${order.orderNumber}</b>.</p>`,
    `    <table style="width:100%;border-collapse:collapse;margin:0 0 14px;font-size:14px">`,
    `      <tr>`,
    `        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b">Order number</td>`,
    `        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">${order.orderNumber}</td>`,
    `      </tr>`,
    `      <tr>`,
    `        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b">Advance paid (UPI)</td>`,
    `        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">${formatINR(order.advancePaid ?? 0)}</td>`,
    `      </tr>`,
    `      <tr>`,
    `        <td style="padding:8px 0;color:#64748b">Balance on delivery</td>`,
    `        <td style="padding:8px 0;text-align:right;font-weight:600">${balance}</td>`,
    `      </tr>`,
    `    </table>`,
    `    <p style="margin:0 0 14px">Please keep <b>${balance}</b> ready as cash when your order arrives.</p>`,
    `    <a href="${trackUrl}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Track your order live</a>`,
    `    <p style="margin:18px 0 0;color:#94a3b8;font-size:12px">Thank you for ordering from Night Corner 🌙</p>`,
    `  </div>`,
    `</div>`,
  ].join("\n");
}

/** Outcome of the receipt-email send, returned to callers so the store can
 * surface it (admin order page) instead of the send being invisible. */
export type EmailSendOutcome =
  | { attempted: false; reason: "no-email" | "disabled" }
  | { attempted: true; ok: boolean; error?: string; configured: boolean };

/** Fires the advance-received confirmation to the customer via the store's
 * enabled channels (WhatsApp, SMS, Messenger) plus a receipt email when the
 * customer has an email address and email notifications are on. Returns the
 * email outcome so callers can record it. Never throws: external I/O
 * failures are swallowed. */
export async function notifyCustomerAdvanceReceived(
  mobile: string,
  email: string,
  order: OrderLike,
  origin: string
): Promise<EmailSendOutcome | null> {
  if (!mobile && !email) return null;
  const settings = await getSettings().catch(() => null);
  if (!settings) return null;
  if (mobile) {
    await sendToCustomerPhone(mobile, buildAdvanceReceivedMessage(order, origin), settings, {
      userId: order.userId,
    });
  }
  if (!email) return { attempted: false, reason: "no-email" };
  if (!settings.notifyEmail) return { attempted: false, reason: "disabled" };
  const res = await sendEmailMessage(
    email,
    `UPI advance received — order ${order.orderNumber}`,
    buildAdvanceReceivedEmailHtml(order, origin)
  );
  return { attempted: true, ok: res.ok, error: res.error, configured: emailConfigured() };
}

/** Confirmation message for a fully-paid (UPI) order. */
export function buildPaymentReceivedMessage(order: OrderLike, origin: string): string {
  const trackUrl = `${origin}/track-order?order=${order.orderNumber}`;
  return [
    `✅ Payment received for order ${order.orderNumber}!`,
    `We've received your payment of ${formatINR(order.total)} via UPI.`,
    `Your order is confirmed — no cash needed at delivery.`,
    `Track live: ${trackUrl}`,
  ].join("\n");
}

/** Receipt-style email for a fully-paid (UPI) order. */
export function buildPaymentReceivedEmailHtml(order: OrderLike, origin: string): string {
  const trackUrl = `${origin}/track-order?order=${order.orderNumber}`;
  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">`,
    `  <div style="background:#0f172a;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">`,
    `    <h1 style="margin:0;font-size:20px">✅ Payment received — ${order.orderNumber}</h1>`,
    `  </div>`,
    `  <div style="border:1px solid #e2e8f0;border-top:0;padding:22px;border-radius:0 0 10px 10px">`,
    `    <p style="margin:0 0 14px">Hi there,</p>`,
    `    <p style="margin:0 0 14px">Thank you! We've received your payment of <b>${formatINR(order.total)}</b> for order <b>${order.orderNumber}</b>.</p>`,
    `    <table style="width:100%;border-collapse:collapse;margin:0 0 14px;font-size:14px">`,
    `      <tr>`,
    `        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b">Order number</td>`,
    `        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">${order.orderNumber}</td>`,
    `      </tr>`,
    `      <tr>`,
    `        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b">Amount paid (UPI)</td>`,
    `        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">${formatINR(order.total)}</td>`,
    `      </tr>`,
    `      <tr>`,
    `        <td style="padding:8px 0;color:#64748b">Payment status</td>`,
    `        <td style="padding:8px 0;text-align:right;font-weight:600">PAID ✓</td>`,
    `      </tr>`,
    `    </table>`,
    `    <p style="margin:0 0 14px">Nothing to pay at delivery — your order is fully prepaid.</p>`,
    `    <a href="${trackUrl}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Track your order live</a>`,
    `    <p style="margin:18px 0 0;color:#94a3b8;font-size:12px">Thank you for ordering from Night Corner 🌙</p>`,
    `  </div>`,
    `</div>`,
  ].join("\n");
}

/** Fires the payment-received confirmation for a fully-paid (UPI) order via
 * the store's enabled channels (WhatsApp, SMS, Messenger) plus a receipt
 * email when the customer has an email address and email notifications are
 * on. Returns the email outcome so callers can record it. Never throws:
 * external I/O failures are swallowed. */
export async function notifyCustomerPaymentReceived(
  mobile: string,
  email: string,
  order: OrderLike,
  origin: string
): Promise<EmailSendOutcome | null> {
  if (!mobile && !email) return null;
  const settings = await getSettings().catch(() => null);
  if (!settings) return null;
  if (mobile) {
    await sendToCustomerPhone(mobile, buildPaymentReceivedMessage(order, origin), settings, {
      userId: order.userId,
    });
  }
  if (!email) return { attempted: false, reason: "no-email" };
  if (!settings.notifyEmail) return { attempted: false, reason: "disabled" };
  const res = await sendEmailMessage(
    email,
    `Payment received — order ${order.orderNumber}`,
    buildPaymentReceivedEmailHtml(order, origin)
  );
  return { attempted: true, ok: res.ok, error: res.error, configured: emailConfigured() };
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
