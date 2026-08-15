"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Volume2, VolumeX } from "lucide-react";
import { useOrderUpdates } from "@/lib/realtime-client";
import {
  playNewOrderAlert,
  playDeliveryPinAlert,
  notifyRider,
  enableRiderNotifications,
} from "@/lib/new-order-alert";
import { useToast } from "@/components/ui/toast";

// Transitions that trigger a rider alert: a new order (PLACED) and the
// handover moment (OUT_FOR_DELIVERY), which carries the delivery-PIN reminder.
const ALERT_STATUSES = new Set(["PLACED", "OUT_FOR_DELIVERY"]);

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
  const toast = useToast();
  // Order-number:status combos we've already alerted on — ensures exactly one
  // alert per transition (PLACED = new order, OUT_FOR_DELIVERY = handover
  // next), even if realtime replays events or the poll catches up.
  const seenAlerts = useRef<Set<string>>(new Set());
  useEffect(() => setMounted(true), []);

  // Seed the seen-set with orders already on the dashboard, so only genuinely
  // new transitions trigger an alert (no alert-storm on first load).
  useEffect(() => {
    document.querySelectorAll("[data-order-number]").forEach((el) => {
      const n = el.getAttribute("data-order-number");
      const s = el.getAttribute("data-order-status");
      if (n && s && ALERT_STATUSES.has(s)) seenAlerts.current.add(`${n}:${s}`);
    });
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("nc-delivery-sound") === "off") setSoundOn(false);
    } catch {
      // storage unavailable — keep default
    }
  }, []);

  const alertFor = (orderNumber: string, status: string, orderId?: string) => {
    if (!ALERT_STATUSES.has(status)) return false;
    const key = `${orderNumber}:${status}`;
    if (seenAlerts.current.has(key)) return false;
    seenAlerts.current.add(key);
    // Distinct sound/vibration at handover so the PIN reminder stands out;
    // the toast always shows (even when muted) so the reminder is never lost,
    // and the system notification surfaces it even in a minimized tab. Tapping
    // the notification jumps straight to this order's delivery page.
    if (soundOn) {
      if (status === "OUT_FOR_DELIVERY") playDeliveryPinAlert();
      else playNewOrderAlert();
      notifyRider(
        status === "OUT_FOR_DELIVERY" ? "Delivery PIN reminder" : "New delivery order",
        status === "OUT_FOR_DELIVERY"
          ? `🛵 ${orderNumber} is out for delivery — ask the customer for their delivery PIN.`
          : `🔑 New order ${orderNumber} — collect the delivery PIN at handover.`,
        key,
        orderId ? `/delivery/${orderId}` : undefined
      );
    }
    toast.push(
      status === "OUT_FOR_DELIVERY"
        ? {
            type: "info",
            message: `🛵 ${orderNumber} is out for delivery — ask the customer for their delivery PIN at handover.`,
          }
        : {
            type: "success",
            message: `🔑 New order ${orderNumber} — it has a delivery PIN; collect it at handover.`,
          }
    );
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
        const s = el.getAttribute("data-order-status");
        const id = el.getAttribute("data-order-id");
        if (n && s) alertFor(n, s, id ?? undefined);
      });
    }, 800);
  };

  // Live pushes arrive instantly over Supabase Realtime.
  const rtStatus = useOrderUpdates((event) => {
    // New orders (PLACED) and the handover moment (OUT_FOR_DELIVERY) both
    // alert with the delivery-PIN reminder; other statuses are just updates.
    if (event.status === "PLACED" || event.status === "OUT_FOR_DELIVERY") {
      alertFor(event.orderNumber, event.status, event.orderId);
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

  // Keep a ref so the one-time permission ask below can read the current
  // alerts state without re-subscribing to the effect.
  const soundOnRef = useRef(soundOn);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  // System notifications require a user gesture to request permission. Ask on
  // the first interaction with the dashboard (the rider is clearly present) so
  // alerts work even though the toggle defaults to ON.
  const askForSystemAlerts = async () => {
    try {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "default") return; // already granted/denied
      const granted = await enableRiderNotifications();
      if (granted) {
        toast.push({
          type: "success",
          message: "System alerts enabled — delivery PIN reminders appear even when the tab is minimized.",
        });
      } else {
        toast.push({
          type: "error",
          message: "System alerts blocked — allow notifications in browser settings to get PIN reminders.",
        });
      }
    } catch {
      // ignore — alerts still work via sound/vibration/toast
    }
  };

  useEffect(() => {
    const ask = () => {
      document.removeEventListener("pointerdown", ask);
      if (soundOnRef.current) askForSystemAlerts();
    };
    document.addEventListener("pointerdown", ask);
    return () => document.removeEventListener("pointerdown", ask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSound = () => {
    setSoundOn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("nc-delivery-sound", next ? "on" : "off");
      } catch {
        // storage unavailable — in-memory only
      }
      // Turning alerts back on is a user gesture — ask for system
      // notifications then, too.
      if (next) askForSystemAlerts();
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
        title={
          soundOn
            ? "New-order alerts on (sound, vibration & system notifications)"
            : "New-order alerts muted"
        }
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
