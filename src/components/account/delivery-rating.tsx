"use client";
import { useState } from "react";
import { Star, Truck } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export function DeliveryRating({
  orderId,
  orderNumber,
  current,
}: {
  orderId: string;
  orderNumber: string;
  current: number | null;
}) {
  const toast = useToast();
  const [rating, setRating] = useState(current);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (r: number) => {
    if (current) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/rating`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: r }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.push({ type: "error", message: data.error || "Could not save rating" });
        return;
      }
      setRating(r);
      toast.push({ type: "success", message: "Thanks for rating your delivery!" });
    } catch {
      toast.push({ type: "error", message: "Could not save rating — try again" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neon-blue/10">
          <Truck className="h-5 w-5 text-neon-blue" />
        </span>
        <div>
          <div className="font-semibold text-white">
            {rating ? `You rated this delivery ${rating}/5` : "How was your delivery?"}
          </div>
          <p className="text-xs text-slate-400">
            {rating
              ? `Thanks for rating ${orderNumber} — it helps your delivery person.`
              : `Rate the delivery for ${orderNumber} — it helps your delivery person.`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((r) => (
          <button
            key={r}
            type="button"
            disabled={busy || !!rating}
            onMouseEnter={() => !rating && setHover(r)}
            onMouseLeave={() => setHover(0)}
            onClick={() => submit(r)}
            className="transition disabled:opacity-90"
            aria-label={`Rate ${r} star${r === 1 ? "" : "s"}`}
          >
            <Star
              className={`h-7 w-7 ${
                (hover || rating || 0) >= r ? "fill-warm-yellow text-warm-yellow" : "text-slate-600"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
