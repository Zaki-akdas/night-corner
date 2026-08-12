import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase Realtime broadcast helper. When an order is created or
 * changes status, we push a small {orderNumber, status} event on the shared
 * channel; browsers (delivery dashboard, tracking page) receive it instantly
 * and refetch. Only non-sensitive identifiers are broadcast — never addresses,
 * PINs, or payment data.
 *
 * Non-blocking by design: this is an optimization for live updates, and a
 * provider hiccup must never affect the order write itself.
 */
const CHANNEL = "delivery-orders";

export type OrderUpdateEvent = {
  orderId: string;
  orderNumber: string;
  status: string;
};

/**
 * Sends one live update over the shared channel and resolves when the message
 * is out. Returns a promise so serverless runtimes (Vercel) can await it — a
 * fire-and-forget WebSocket here would be killed the moment the response
 * flushes. Callers wrap it in .catch() so it can never fail the write itself.
 */
export async function broadcastOrderUpdate(event: OrderUpdateEvent): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return; // silently skip — polling fallback covers it

  const supabase = createClient(url, key, {
    realtime: { params: { eventsPerSecond: 20 } },
  });
  let channel: ReturnType<typeof supabase.channel> | null = null;
  try {
    channel = supabase.channel(CHANNEL);
    await new Promise<void>((resolve) => {
      channel!.subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve();
      });
    });
    await channel.send({
      type: "broadcast",
      event: REALTIME_EVENT,
      payload: event,
    });
  } catch {
    // ignore — polling fallback covers it
  } finally {
    if (channel) await supabase.removeChannel(channel).catch(() => {});
  }
}

export const REALTIME_CHANNEL = CHANNEL;
export const REALTIME_EVENT = "order-updated";
