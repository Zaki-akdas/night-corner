"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { REALTIME_CHANNEL, REALTIME_EVENT, type OrderUpdateEvent } from "./realtime";

/**
 * Subscribes to live order-update broadcasts (Supabase Realtime WebSocket from
 * the browser, so no serverless duration limits). `onEvent` fires for every
 * order event — callers filter by orderNumber if they only care about one
 * order. Returns a connection status for UI ("connected" | "connecting" |
 * "offline"). Reconnects are handled by supabase-js automatically.
 */
export function useOrderUpdates(onEvent: (event: OrderUpdateEvent) => void) {
  const [status, setStatus] = useState<"connecting" | "connected" | "offline">("connecting");
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      setStatus("offline");
      return;
    }
    const supabase = createClient(url, key);
    const channel = supabase
      .channel(REALTIME_CHANNEL)
      .on("broadcast", { event: REALTIME_EVENT }, (payload) => {
        cbRef.current(payload.payload as OrderUpdateEvent);
      })
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setStatus("connected");
        else if (state === "CLOSED") setStatus("offline");
        else setStatus("connecting");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return status;
}
