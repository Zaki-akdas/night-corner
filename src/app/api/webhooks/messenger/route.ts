import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { parseAddressSnapshot } from "@/lib/address";

/**
 * Meta Messenger webhook.
 *
 * GET  — webhook verification. Meta calls this with `hub.challenge` when the
 *        Page subscription is configured; we echo it back only when
 *        `hub.verify_token` matches MESSENGER_WEBHOOK_VERIFY_TOKEN.
 *
 * POST — ingests message events. Messenger addresses customers by Page-Scoped
 *        ID (PSID), so every event lets us record the PSID and link it to a
 *        Night Corner account: either via the m.me deep-link `ref` (carries
 *        the userId) or by matching an order number quoted in the message text
 *        (links the order's mobile). Once linked, delivery notifications can
 *        be sent over Messenger like WhatsApp/SMS.
 *
 * Signature: real Messenger payloads are HMAC-signed with the app secret
 * (X-Hub-Signature-256). Enforced when MESSENGER_APP_SECRET is set; without it
 * (demo) POSTs are accepted so the flow can be exercised locally.
 */

const ORDER_RE = /\bNC-\d{4}-\d{5}\b/i;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.MESSENGER_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, {
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "Webhook verification failed" }, { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();

  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (appSecret) {
    const sig = req.headers.get("x-hub-signature-256") ?? "";
    const expected = "sha256=" + createHmac("sha256", appSecret).update(raw).digest("hex");
    if (sig !== expected) {
      return NextResponse.json({ error: "Bad signature" }, { status: 403 });
    }
  }

  let payload: { entry?: Array<{ id?: string; messaging?: Array<Record<string, any>> }> };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const entry of payload.entry ?? []) {
    const pageId = String(entry.id ?? "");
    for (const event of entry.messaging ?? []) {
      const psid = event.sender?.id;
      if (!psid) continue;

      const text = typeof event.message?.text === "string" ? event.message.text : "";
      const ref = event.referral?.ref ?? event.postback?.payload ?? null;

      // Link via the m.me deep-link ref (carries the Night Corner userId).
      let userId: string | null = null;
      if (ref) {
        const user = await prisma.user
          .findUnique({ where: { id: String(ref) }, select: { id: true } })
          .catch(() => null);
        if (user) userId = user.id;
      }

      // Link via an order number quoted in the message ("track NC-2026-00001").
      let mobile: string | null = null;
      const orderMatch = text.match(ORDER_RE);
      if (orderMatch) {
        const order = await prisma.order
          .findUnique({
            where: { orderNumber: orderMatch[0].toUpperCase() },
            select: { addressSnapshot: true },
          })
          .catch(() => null);
        mobile = order ? (parseAddressSnapshot(order.addressSnapshot)?.mobile ?? null) : null;
      }

      await prisma.messengerIdentity
        .upsert({
          where: { psid },
          create: {
            psid,
            pageId,
            ...(userId ? { userId } : {}),
            ...(mobile ? { mobile } : {}),
          },
          update: {
            pageId,
            ...(userId ? { userId } : {}),
            ...(mobile ? { mobile } : {}),
          },
        })
        .catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
