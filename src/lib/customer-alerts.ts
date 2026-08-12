import { sendWhatsappMessage } from "./whatsapp";
import { sendSmsMessage } from "./sms";
import { getSettings, formatINR } from "./settings";

/**
 * Customer order-status alerts via SMS + WhatsApp. Used at every milestone —
 * order placed, out for delivery, delivered — through whichever channels the
 * store has enabled (Admin → Settings). External I/O never fails the caller;
 * every sender catches its own errors and this helper swallows failures.
 */
export type CustomerOrderStatus = "PLACED" | "OUT_FOR_DELIVERY" | "DELIVERED";

export type OrderLike = {
  orderNumber: string;
  total: number;
  eta?: string | null;
  deliveryPin?: string | null;
  paymentMethod?: string;
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
        `Total: ${formatINR(order.total)}${order.paymentMethod ? ` · ${order.paymentMethod}` : ""}`,
        order.eta ? `Estimated delivery: ${order.eta}.` : "",
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
  const sends: Promise<unknown>[] = [];
  if (settings.notifyWhatsapp) sends.push(sendWhatsappMessage(mobile, msg));
  if (settings.notifySms) sends.push(sendSmsMessage(mobile, msg));
  await Promise.all(sends).catch(() => {});
}
