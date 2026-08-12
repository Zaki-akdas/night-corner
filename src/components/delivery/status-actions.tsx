"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, CheckCircle2, Loader2 } from "lucide-react";

const PRE_DELIVERY = ["PLACED", "CONFIRMED", "PREPARING", "PACKED"];

/**
 * Delivery status buttons. Renders nothing when the order isn't actionable
 * (already delivered, cancelled, refunded, or out for delivery with no further
 * step). Used on both the dashboard cards and the order detail page.
 */
export function DeliveryStatusActions({
  orderId,
  currentStatus,
  compact = false,
}: {
  orderId: string;
  currentStatus: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const canSendOut = PRE_DELIVERY.includes(currentStatus);
  const canDeliver = currentStatus === "OUT_FOR_DELIVERY";
  if (!canSendOut && !canDeliver) return null;

  const update = async (status: "OUT_FOR_DELIVERY" | "DELIVERED") => {
    setBusy(status);
    setError("");
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Could not update status");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(null);
    }
  };

  const btn = (base: string) =>
    `${base} inline-flex items-center justify-center gap-2 ${compact ? "px-3 py-1.5 text-xs" : "w-full text-sm"}`;

  return (
    <div className="space-y-2">
      {canSendOut && (
        <button
          onClick={() => update("OUT_FOR_DELIVERY")}
          disabled={!!busy}
          className={btn("btn")}
        >
          {busy === "OUT_FOR_DELIVERY" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bike className="h-4 w-4" />}
          {busy === "OUT_FOR_DELIVERY" ? "Updating…" : "Mark Out for Delivery"}
        </button>
      )}
      {canDeliver && (
        <button
          onClick={() => update("DELIVERED")}
          disabled={!!busy}
          className={btn("bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60")}
        >
          {busy === "DELIVERED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {busy === "DELIVERED" ? "Updating…" : "Mark Delivered"}
        </button>
      )}
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
