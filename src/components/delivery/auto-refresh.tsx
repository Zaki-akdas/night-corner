"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useOrderUpdates } from "@/lib/realtime-client";

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
  useEffect(() => setMounted(true), []);

  const sync = () => {
    router.refresh();
    setLastSync(new Date());
  };

  // Live pushes arrive instantly over Supabase Realtime.
  const rtStatus = useOrderUpdates(() => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") sync();
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
        onClick={sync}
        className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Refresh
      </button>
    </div>
  );
}
