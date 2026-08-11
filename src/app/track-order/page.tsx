"use client";
import { useState } from "react";
import Link from "next/link";
import { OrderTimeline } from "@/components/account/order-timeline";
import { Loader2, Search } from "lucide-react";
import { STATUS_FLOW } from "@/lib/types";
import { statusLabel } from "@/lib/orders";
import { formatINR } from "@/lib/settings";

export default function TrackOrderPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState("");

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(`/api/orders/track?orderNumber=${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Not found");
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold text-white">Track Your Order</h1>
      <p className="mt-1 text-slate-400">
        Enter your order number (e.g. NC-2026-00001). Logged in? See all orders in{" "}
        <Link href="/account/orders" className="text-neon-purple hover:underline">your account</Link>.
      </p>

      <form onSubmit={search} className="mt-6 flex gap-2">
        <input
          className="input uppercase"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          placeholder="NC-2026-00001"
        />
        <button className="btn-primary">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          Track
        </button>
      </form>

      {error && <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}

      {data && (
        <div className="mt-6 space-y-4">
          <div className="card p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <div className="text-sm text-slate-400">Order</div>
                <div className="text-lg font-bold text-white">{data.orderNumber}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-400">Total</div>
                <div className="text-lg font-bold text-warm-yellow">{formatINR(data.total)}</div>
              </div>
            </div>
          </div>
          <OrderTimeline currentStatus={data.status} flow={STATUS_FLOW} />
          <div className="card p-5 text-sm text-slate-300">
            Current status: <span className="font-semibold text-white">{statusLabel(data.status)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
