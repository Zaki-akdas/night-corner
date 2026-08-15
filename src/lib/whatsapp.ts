import type { Order, OrderItem } from "@prisma/client";
import { formatINR, getSettings } from "./settings";

/**
 * Builds the WhatsApp order message and, if Cloud API credentials are present,
 * sends it. Without credentials we expose a wa.me deep link so the flow still
 * works from any device (the click triggers the WhatsApp app with a prefilled
 * message). Never called from the client with secrets.
 */
export function buildOrderMessage(
  order: Order & { items: OrderItem[] },
  addressText: string,
  customerName: string,
  customerMobile: string
): string {
  const lines = order.items
    .map((i) => `${i.quantity} × ${i.name}`)
    .join("\n");
  const time = new Date(order.createdAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return [
    "NEW ORDER — NIGHT CORNER 🌙",
    "",
    `Order ID: ${order.orderNumber}`,
    "",
    "Customer:",
    customerName,
    "",
    "Mobile:",
    customerMobile,
    "",
    "Items:",
    lines,
    "",
    `Subtotal: ${formatINR(order.subtotal)}`,
    order.discount > 0 ? `Discount: ${formatINR(order.discount)}` : "",
    `Delivery: ${formatINR(order.deliveryCharge)}`,
    order.tax > 0 ? `Tax: ${formatINR(order.tax)}` : "",
    `Total: ${formatINR(order.total)}`,
    "",
    "Address:",
    addressText,
    "",
    "Payment:",
    order.paymentMethod,
    "",
    "Order Time:",
    time,
  ]
    .filter(Boolean)
    .join("\n");
}

export function waMeLink(phone: string, message: string): string {
  const clean = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

/** Parameters for a Meta-approved template message (business-initiated
 * messages outside the 24h customer window MUST use a template). When
 * WHATSAPP_TEMPLATE_NAME is set and a template is supplied, the message is
 * sent as type:"template" with these body parameters; otherwise it falls back
 * to free-form text (fine for test numbers / the 24h window). */
export type WhatsAppTemplateParams = {
  parameters: string[];
  language?: string;
};

export async function sendWhatsappMessage(
  phone: string,
  message: string,
  template?: WhatsAppTemplateParams
): Promise<{ ok: boolean; link?: string; error?: string }> {
  const link = waMeLink(phone, message);
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_BUSINESS_NUMBER_ID;
  if (!token || !phoneNumberId) {
    // Demo mode: return a wa.me link instead of failing.
    return { ok: true, link };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
        template && process.env.WHATSAPP_TEMPLATE_NAME
          ? {
              messaging_product: "whatsapp",
              to: phone.replace(/[^\d]/g, ""),
              type: "template",
              template: {
                name: process.env.WHATSAPP_TEMPLATE_NAME,
                language: {
                  code: template.language || process.env.WHATSAPP_TEMPLATE_LANG || "en",
                },
                components: [
                  {
                    type: "body",
                    parameters: template.parameters.map((t) => ({ type: "text", text: t })),
                  },
                ],
              },
            }
          : {
              messaging_product: "whatsapp",
              to: phone.replace(/[^\d]/g, ""),
              type: "text",
              text: { body: message },
            }
      ),
      }
    );
    if (!res.ok) return { ok: false, link, error: await res.text() };
    return { ok: true, link };
  } catch (e) {
    return { ok: false, link, error: String(e) };
  }
}

export async function notifyOrderToBusiness(
  order: Order & { items: OrderItem[] },
  addressText: string,
  customerName: string,
  customerMobile: string
) {
  const settings = await getSettings();
  const msg = buildOrderMessage(
    order,
    addressText,
    customerName,
    customerMobile
  );
  return sendWhatsappMessage(settings.whatsappNumber, msg);
}
