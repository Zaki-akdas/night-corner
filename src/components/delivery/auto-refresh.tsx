"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Volume2, VolumeX } from "lucide-react";
import { useOrderUpdates } from "@/lib/realtime-client";
import { playNewOrderAlert } from "@/lib/new-order-alert";

// Slow safety net: realtime is the primary trigger; this only catches gaps
// when the WebSocket is down (e.g. flaky networks, blocked WS).
const FALLBACK_POLL_MS = 60_000;

export function AutoRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Starts null so SSR and the first client render agree (no ticking text in
  // the HTML) — the timestamp appears only after mount.
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [visible, setVisible] = useState(
    () => typeof document !== "undefined" && document.visibilityState === "visible"
  );
  const [mounted, setMounted] = useState(false);
  const [live, setLive] = useState(false);
  // Sound + vibration alerts default ON; a stored preference is applied only
  // after mount so the first client render matches SSR (no hydration error).
  const [soundOn, setSoundOn] = useState(true);
  // Order numbers we've already alerted on — ensures exactly one alert per
  // new order, even if realtime replays events or the poll catches up.
  const seenOrders = useRef<Set<string>>(new Set());
  useEffect(() => setMounted(true), []);

  // Seed the seen-set with orders already on the dashboard, so only genuinely
  // new order numbers trigger an alert.
  useEffect(() => {
    document.querySelectorAll("[data-order-number]").forEach((el) => {
      const n = el.getAttribute("data-order-number");
      if (n) seenOrders.current.add(n);
    });
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("nc-delivery-sound") === "off") setSoundOn(false);
    } catch {
      // storage unavailable — keep default
    }
  }, []);

  const alertFor = (orderNumber: string) => {
    if (seenOrders.current.has(orderNumber)) return false;
    seenOrders.current.add(orderNumber);
    if (soundOn) playNewOrderAlert();
    return true;
  };

  const sync = () => {
    router.refresh();
    setLastSync(new Date());
    // Fallback detection for when realtime is down: once the refresh renders,
    // alert for any order card we haven't seen yet (the poll picks it up).
    window.setTimeout(() => {
      document.querySelectorAll("[data-order-number]").forEach((el) => {
        const n = el.getAttribute("data-order-number");
        if (n) alertFor(n);
      });
    }, 800);
  };

  // Live pushes arrive instantly over Supabase Realtime.
  const rtStatus = useOrderUpdates((event) => {
    // New orders are created as PLACED; other statuses are just updates.
    if (event.status === "PLACED") {
      alertFor(event.orderNumber);
      // Refresh even in a background tab so the order is already on screen
      // when the delivery person switches back.
      sync();
    } else if (typeof document !== "undefined" && document.visibilityState === "visible") {
      sync();
    }
  });
  useEffect(() => {
    setLive(rtStatus === "connected");
  }, [rtStatus]);

  useEffect(() => {
    const start = () => {
      if (timer.current) return;
      timer.current = setInterval(sync, FALLBACK_POLL_MS);
    };
    const stop = () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };

    const onVisibility = () => {
      const isVisible = document.visibilityState === "visible";
      setVisible(isVisible);
      // Just resume polling when the tab becomes visible. A refresh here could
      // race with hydration on first paint and corrupt the server HTML.
      if (isVisible) start();
      else stop();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  const toggleSound = () => {
    setSoundOn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("nc-delivery-sound", next ? "on" : "off");
      } catch {
        // storage unavailable — in-memory only
      }
      return next;
    });
  };

  const ago = lastSync ? Math.max(0, Math.round((Date.now() - lastSync.getTime()) / 1000)) : null;

  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            live ? "animate-pulse bg-emerald-400" : visible ? "bg-amber-400" : "bg-slate-500"
          }`}
          aria-hidden
        />
        {!mounted || visible ? (live ? "Live · realtime" : "Live · polling") : "Paused"}
        {lastSync && mounted && visible && <span className="text-slate-500">· {ago}s</span>}
      </span>
      <button
        onClick={toggleSound}
        aria-label={soundOn ? "Mute new-order alerts" : "Unmute new-order alerts"}
        title={soundOn ? "New-order alerts on (sound & vibration)" : "New-order alerts muted"}
        className={`btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs ${
          soundOn ? "" : "opacity-60"
        }`}
      >
        {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        {mounted && <span className="hidden sm:inline">{soundOn ? "Alerts on" : "Alerts off"}</span>}
      </button>
      <button
        onClick={sync}
        className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Refresh
      </button>
    </div>
  );
}
