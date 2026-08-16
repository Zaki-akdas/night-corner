"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, Undo2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { formatINR } from "@/lib/settings";

/**
 * Lightweight "Mark UPI received" control for split (UPI advance + COD)
 * orders. The store checks its UPI app and confirms the advance arrived —
 * no payment gateway required. Timestamped server-side and audited.
 */
export function AdvanceReceivedButton({
  orderId,
  orderNumber,
  advance,
  balance,
  receivedAt,
}: {
  orderId: string;
  orderNumber: string;
  advance: number;
  balance: number;
  receivedAt: Date | string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const setReceived = async (received: boolean) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/advance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ received }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.push({ type: "error", message: data.error || "Could not update" });
        return;
      }
      toast.push({
        type: "success",
        message: received
          ? `${formatINR(advance)} UPI advance confirmed for ${orderNumber}`
          : `Advance confirmation reverted for ${orderNumber}`,
      });
      router.refresh();
    } catch {
      toast.push({ type: "error", message: "Could not update — try again" });
    } finally {
      setBusy(false);
    }
  };

  if (receivedAt) {
    return (
      <div className="rounded-xl bg-emerald-500/10 p-3 text-sm ring-1 ring-emerald-500/30">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
            <BadgeCheck className="h-4 w-4" /> UPI advance received
          </span>
          <button
            onClick={() => setReceived(false)}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-rose-300 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />} Undo
          </button>
        </div>
        <p className="mt-1 text-xs text-emerald-200/70">
          {formatINR(advance)} confirmed · {new Date(receivedAt).toLocaleString("en-IN")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-warm-yellow/10 p-3 text-sm ring-1 ring-warm-yellow/30">
      <div className="text-xs text-slate-300">
        Customer paid <strong className="text-warm-yellow">{formatINR(advance)}</strong> advance via UPI to{" "}
        <strong className="text-white">your UPI ID</strong> — balance <strong className="text-white">{formatINR(balance)}</strong>{" "}
        is cash on delivery.
      </div>
      <button
        onClick={() => setReceived(true)}
        disabled={busy}
        className="btn-primary mt-2 inline-flex w-full items-center justify-center gap-1.5 py-2 text-xs"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
        Mark UPI received
      </button>
      <p className="mt-1.5 text-[11px] text-slate-500">
        Confirm in your UPI app that the advance arrived before marking it received.
      </p>
    </div>
  );
}
