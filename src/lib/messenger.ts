import { prisma } from "./prisma";

/**
 * Messenger (Meta) sender. Mirrors the WhatsApp lib's shape: real API calls
 * when MESSENGER_PAGE_TOKEN is set, otherwise demo mode (ok:true, no message
 * sent). Server-side only — never call from the client with secrets.
 *
 * Unlike WhatsApp (which addresses E.164 phone numbers), the Messenger API
 * addresses Page-Scoped IDs (PSIDs): a customer must first open a chat with
 * the Page so Meta issues a PSID, which we capture via the messenger webhook
 * or an m.me deep link (see /api/webhooks/messenger).
 */

/** Deep link that opens a chat with the Page. With a ref it also tells the
 * webhook which Night Corner account to link the PSID to. */
export function messengerDeepLink(ref?: string): string {
  const pageId = process.env.MESSENGER_PAGE_ID || "";
  const base = pageId ? `https://m.me/${pageId}` : "https://m.me";
  return ref ? `${base}?ref=${encodeURIComponent(ref)}` : base;
}

export async function sendMessengerMessage(
  psid: string,
  message: string
): Promise<{ ok: boolean; link?: string; error?: string }> {
  const link = messengerDeepLink();
  const token = process.env.MESSENGER_PAGE_TOKEN;
  if (!token) {
    // Demo mode: no credentials configured — pretend success so the
    // notification flows never break.
    return { ok: true, link };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: psid },
          message: { text: message },
        }),
      }
    );
    if (!res.ok) return { ok: false, link, error: await res.text() };
    return { ok: true, link };
  } catch (e) {
    return { ok: false, link, error: String(e) };
  }
}

/** Resolves the customer's Messenger PSID from a linked mobile number and/or
 * Night Corner userId. Returns null when no identity is captured yet — the
 * Messenger channel is then silently skipped. */
export async function getMessengerPsid(opts: {
  mobile?: string | null;
  userId?: string | null;
}): Promise<string | null> {
  const conditions: { mobile?: string; userId?: string }[] = [];
  if (opts.mobile) conditions.push({ mobile: opts.mobile });
  if (opts.userId) conditions.push({ userId: opts.userId });
  if (conditions.length === 0) return null;
  const identity = await prisma.messengerIdentity
    .findFirst({
      where: { OR: conditions },
      orderBy: { updatedAt: "desc" },
    })
    .catch(() => null);
  return identity?.psid ?? null;
}
