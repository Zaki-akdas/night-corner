"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Handshake, Loader2 } from "lucide-react";

/**
 * "Accept" button for available (unassigned) orders. Claiming the order
 * assigns it to the logged-in rider — from then on only they (or an admin)
 * can act on it.
 */
export function AcceptOrderButton({
  orderId,
  orderNumber,
  compact = false,
}: {
  orderId: string;
  orderNumber: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/accept`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not accept order");
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept order");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
        <CheckCircle2 className="h-3.5 w-3.5" /> Accepted — it&apos;s yours
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        onClick={accept}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Handshake className="h-3.5 w-3.5" />}
        {compact ? "Accept" : "Accept this order"}
      </button>
      {error && <span className="text-[11px] font-medium text-rose-300">{error}</span>}
      {!compact && (
        <span className="text-[10px] text-slate-500">Claiming {orderNumber} assigns it to you</span>
      )}
    </span>
  );
}
