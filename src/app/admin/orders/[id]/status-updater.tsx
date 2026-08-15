"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ORDER_STATUSES } from "@/lib/types";
import { Loader2 } from "lucide-react";

export function OrderStatusUpdater({ orderId, current }: { orderId: string; current: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [photoUrl, setPhotoUrl] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const delivering = status === "DELIVERED";

  const update = async (newStatus: string) => {
    setError(null);
    if (newStatus === "DELIVERED" && (!photoUrl.trim() || !pin.trim())) {
      setError("A delivery photo URL and the customer's 4-digit PIN are required to mark DELIVERED.");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: newStatus,
        ...(newStatus === "DELIVERED" ? { deliveryPhotoUrl: photoUrl.trim(), deliveryPin: pin.trim() } : {}),
      }),
    });
    setLoading(false);
    if (res.ok) {
      setStatus(newStatus);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not update status");
    }
  };

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-bold text-white">Update Status</h2>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="input mb-3 text-sm"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>

      {delivering && (
        <div className="mb-3 space-y-2 rounded border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs text-amber-200">
            Marking DELIVERED requires proof of delivery: a photo and the customer&apos;s 4-digit delivery PIN
            (same rule as the delivery app).
          </p>
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="Delivery photo URL"
            className="input text-sm"
          />
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Customer's delivery PIN"
            inputMode="numeric"
            className="input text-sm"
          />
        </div>
      )}

      {error && <p className="mb-3 text-xs text-rose-300">{error}</p>}

      <button
        onClick={() => update(status)}
        disabled={loading || status === current}
        className="btn-primary w-full py-2 text-sm"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Status"}
      </button>

      {status === "CANCELLED" && current !== "CANCELLED" && (
        <button
          onClick={() => update("CANCELLED")}
          disabled={loading}
          className="btn-ghost mt-2 w-full py-2 text-sm text-rose-300"
        >
          Cancel & refund stock
        </button>
      )}
    </div>
  );
}
