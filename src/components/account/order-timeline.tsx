"use client";
import { Check } from "lucide-react";

const LABELS: Record<string, string> = {
  PLACED: "Order Placed",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export function OrderTimeline({
  currentStatus,
  flow,
}: {
  currentStatus: string;
  flow: string[];
}) {
  if (currentStatus === "CANCELLED" || currentStatus === "REFUNDED") {
    return (
      <div className="card border-rose-500/30 p-5 text-rose-200">
        This order was {currentStatus.toLowerCase()}.
      </div>
    );
  }
  const currentIdx = flow.indexOf(currentStatus);

  return (
    <div className="card p-5">
      <h2 className="mb-5 font-bold text-white">Order Progress</h2>
      {/* Horizontally scrollable on small screens so the progress line never breaks */}
      <div className="overflow-x-auto pb-1">
        <div className="relative flex min-w-[540px] justify-between gap-3 lg:min-w-0">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-white/10" />
          <div
            className="absolute left-0 top-4 h-0.5 bg-gradient-to-r from-neon-purple to-neon-blue transition-all"
            style={{ width: `${(currentIdx / (flow.length - 1)) * 100}%` }}
          />
          {flow.map((s, i) => {
            const done = i <= currentIdx;
            return (
              <div key={s} className="relative z-10 flex shrink-0 flex-col items-center gap-2">
                <div
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 ${
                    done
                      ? "border-neon-purple bg-neon-purple text-white shadow-neon"
                      : "border-white/20 bg-night-900 text-slate-500"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={`max-w-[90px] text-center text-[11px] ${
                    done ? "font-semibold text-white" : "text-slate-500"
                  }`}
                >
                  {LABELS[s] ?? s}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
