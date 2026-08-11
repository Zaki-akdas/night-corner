"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ORDER_STATUSES } from "@/lib/types";
import { Loader2 } from "lucide-react";

export function OrderStatusUpdater({ orderId, current }: { orderId: string; current: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [loading, setLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const update = async (newStatus: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(false);
    if (res.ok) {
      setStatus(newStatus);
      router.refresh();
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
      <button
        onClick={() => update(status)}
        disabled={loading || status === current}
        className="btn-primary w-full py-2 text-sm"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Status"}
      </button>

      {status === "CANCELLED" && current !== "CANCELLED" && (
        <button onClick={() => setShowCancel(true)} className="btn-ghost mt-2 w-full py-2 text-sm text-rose-300">
          Cancel & refund stock
        </button>
      )}
    </div>
  );
}
