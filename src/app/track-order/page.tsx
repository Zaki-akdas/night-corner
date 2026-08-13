"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { OrderTimeline } from "@/components/account/order-timeline";
import { RefreshButton } from "@/components/ui/refresh-button";
import { useOrderUpdates } from "@/lib/realtime-client";
import { Loader2, MapPin, Navigation, Package, Search, Truck } from "lucide-react";
import { STATUS_FLOW } from "@/lib/types";
import { statusLabel } from "@/lib/orders";
import { formatINR } from "@/lib/settings";

type TrackData = {
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  paymentMethod: string;
  eta: string | null;
  distanceKm: number | null;
  address: { lat: number | null; lng: number | null; line: string | null } | null;
  shop: { lat: number; lng: number };
};

const FALLBACK_POLL_MS = 30_000;

export default function TrackOrderPage() {
  // useSearchParams must be inside a Suspense boundary for static generation.
  return (
    <Suspense fallback={null}>
      <TrackOrderInner />
    </Suspense>
  );
}

function TrackOrderInner() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrackData | null>(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const initialAutoSearch = useRef(true);

  const fetchOrder = useCallback(async (orderNumber: string, quiet = false) => {
    if (!orderNumber.trim()) return;
    if (!quiet) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await fetch(`/api/orders/track?orderNumber=${encodeURIComponent(orderNumber.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Order not found");
      setData(json);
      setLastUpdated(new Date());
      setQuery(orderNumber.toUpperCase());
    } catch (e) {
      if (!quiet) setError((e as Error).message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  // Auto-track from ?order=NC-2026-00001 (e.g. "Track" link on the account page).
  useEffect(() => {
    if (!initialAutoSearch.current) return;
    initialAutoSearch.current = false;
    const fromUrl = searchParams.get("order");
    if (fromUrl) fetchOrder(fromUrl);
  }, [searchParams, fetchOrder]);

  // Live updates: Supabase Realtime pushes status changes instantly; a slow
  // fallback poll only covers WebSocket gaps while the order is still active.
  useEffect(() => {
    if (!data) return;
    const active = !["DELIVERED", "CANCELLED", "REFUNDED"].includes(data.status);
    if (!active) return;
    const t = setInterval(() => fetchOrder(data.orderNumber, true), FALLBACK_POLL_MS);
    return () => clearInterval(t);
  }, [data, fetchOrder]);

  useOrderUpdates((ev) => {
    if (data && ev.orderNumber === data.orderNumber) fetchOrder(ev.orderNumber, true);
  });

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(query);
  };

  const canShowRoute =
    data &&
    data.address &&
    typeof data.address.lat === "number" &&
    typeof data.address.lng === "number" &&
    Number.isFinite(data.shop.lat) &&
    Number.isFinite(data.shop.lng);

  const mapSrc = canShowRoute
    ? `https://www.google.com/maps?saddr=${encodeURIComponent(`${data!.shop.lat},${data!.shop.lng}`)}&daddr=${encodeURIComponent(
        `${data!.address!.lat},${data!.address!.lng}`
      )}&z=14&output=embed`
    : "";

  const live = data && !["DELIVERED", "CANCELLED", "REFUNDED"].includes(data.status);

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
          {/* Order header + live indicator */}
          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <div className="text-sm text-slate-400">Order</div>
              <div className="text-lg font-bold text-white">{data.orderNumber}</div>
              <div className="mt-0.5 text-xs text-slate-500">
                {new Date(data.createdAt).toLocaleString("en-IN")} · {data.paymentMethod}
              </div>
            </div>
            <div className="text-right">
              {live && (
                <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  LIVE
                </span>
              )}
              <div className="text-sm text-slate-400">Total</div>
              <div className="text-lg font-bold text-warm-yellow">{formatINR(data.total)}</div>
            </div>
          </div>

          <OrderTimeline currentStatus={data.status} flow={STATUS_FLOW} />

          <div className="card p-5 text-sm text-slate-300">
            Current status:{" "}
            <span className="font-semibold text-white">
              {statusLabel(data.status)}
              {data.status === "DELIVERED" && " 🎉"}
            </span>
            {lastUpdated && (
              <span className="ml-2 text-xs text-slate-500">· updated {lastUpdated.toLocaleTimeString()}</span>
            )}
            {data && (
              <RefreshButton
                className="ml-2"
                label="Refresh"
                onRefresh={() => fetchOrder(data.orderNumber, true)}
              />
            )}
          </div>

          {/* Delivery route map */}
          {canShowRoute ? (
            <div className="card space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-bold text-white">
                  <Truck className="h-4 w-4 text-neon-blue" /> Delivery progress
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {data.distanceKm != null && data.distanceKm > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Navigation className="h-3.5 w-3.5 text-neon-blue" /> {data.distanceKm.toFixed(1)} km
                    </span>
                  )}
                  {data.eta && (
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" /> ETA {data.eta}
                    </span>
                  )}
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/10">
                {/* Keyless Google Maps embed — route from the shop to your delivery address */}
                <iframe
                  title="Delivery route — shop to your address"
                  src={mapSrc}
                  className="h-56 w-full sm:h-72"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              {data.address?.line && (
                <p className="flex items-start gap-1.5 text-xs text-slate-400">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-blue" /> {data.address.line}
                </p>
              )}
            </div>
          ) : (
            data.address?.line && (
              <div className="card flex items-start gap-2 p-4 text-sm text-slate-300">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neon-blue" /> {data.address.line}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
