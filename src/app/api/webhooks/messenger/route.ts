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
 *
 * Degradation: databases that haven't run the messenger migration have no
 * `MessengerIdentity` table. The webhook must then still acknowledge Meta's
 * events (Meta requires a 2xx) without erroring — it returns
 * `{ ok: true, messenger: "disabled" }` and skips PSID linking until the
 * migration is applied. Only genuine database failures (unreachable DB)
 * return a 5xx, so Meta retries the event later.
 */

const ORDER_RE = /\bNC-\d{4}-\d{5}\b/i;

/** True when the MessengerIdentity table exists in the connected database;
 * null when the database itself is unreachable (so the caller can 5xx). */
async function messengerIdentityTableExists(): Promise<boolean | null> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'MessengerIdentity'"
    )) as Array<{ n: number }>;
    return (rows[0]?.n ?? 0) === 1;
  } catch {
    return null;
  }
}

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

  // Degrade gracefully when the messenger migration hasn't been applied.
  const tableOk = await messengerIdentityTableExists();
  if (tableOk === null) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
  if (!tableOk) {
    console.warn(
      "[messenger-webhook] MessengerIdentity table is missing — PSID linking disabled " +
        "(run `prisma migrate deploy` to enable Messenger notifications)."
    );
    return NextResponse.json(
      { ok: true, messenger: "disabled", reason: "MessengerIdentity table missing" },
      { status: 200 }
    );
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
