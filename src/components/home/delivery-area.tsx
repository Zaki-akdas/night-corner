"use client";
import { MapPin } from "lucide-react";
import type { AppSettings } from "@/lib/settings";
import { useMemo } from "react";

/**
 * Pure-SVG delivery-area map: shop marker + a 10 KM radius circle.
 * Coordinates are projected locally (no external map API required). When a
 * Maps API key is configured this can be swapped for an interactive map.
 */
export function DeliveryArea({ settings }: { settings: AppSettings }) {
  const { shopLat, shopLng, maxRadiusKm, shopAddress } = settings;

  // Build a simple normalized projection around the shop.
  const viewKm = maxRadiusKm * 2.4;
  const project = (lat: number, lng: number) => {
    const x = ((lng - shopLng) * 111.32 * Math.cos((shopLat * Math.PI) / 180)) / viewKm;
    const y = -((lat - shopLat) * 110.57) / viewKm;
    return { x: 50 + x * 50, y: 50 + y * 50 };
  };

  const ringRadii = useMemo(() => {
    const settings2 = settings;
    return settings2.deliverySlabs.map((s) => (s.upToKm / viewKm) * 100);
  }, [settings, viewKm]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-neon-blue">
            📍 Delivery Area
          </div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white">
            We deliver within {maxRadiusKm} KM of Night Corner
          </h2>
          <p className="mt-3 text-slate-400">
            Enter your location at checkout and we&apos;ll verify road distance instantly.
            Delivery charges are calculated by distance — and free above ₹{settings.freeDeliveryAbove}.
          </p>
          <div className="mt-6 space-y-3">
            {settings.deliverySlabs.map((s, i) => {
              const prev = i === 0 ? 0 : settings.deliverySlabs[i - 1].upToKm;
              return (
                <div key={s.upToKm} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <MapPin className="h-5 w-5 text-neon-purple" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">
                      {prev}–{s.upToKm} KM
                    </div>
                    <div className="text-xs text-slate-400">{s.upToKm === maxRadiusKm ? "Edge of our service area" : "Fast night delivery"}</div>
                  </div>
                  <div className="font-bold text-warm-yellow">₹{s.charge}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-sm text-slate-400">
            📍 {shopAddress}
          </div>
        </div>

        <div className="card relative aspect-square overflow-hidden p-2">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <defs>
              <radialGradient id="areaglow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
                <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </radialGradient>
              <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="0.2" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
            {project(0, 0) && null}
            {ringRadii.map((r, i) => (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={r / 2}
                fill="none"
                stroke="#38bdf8"
                strokeOpacity="0.25"
                strokeWidth="0.25"
                strokeDasharray="1 1"
              />
            ))}
            <circle cx="50" cy="50" r={(maxRadiusKm / viewKm) * 50} fill="url(#areaglow)" />
            <circle
              cx="50"
              cy="50"
              r={(maxRadiusKm / viewKm) * 50}
              fill="none"
              stroke="#a855f7"
              strokeWidth="0.5"
            />
            {/* shop pin */}
            <g>
              <circle cx="50" cy="50" r="2" fill="#fbbf24" className="animate-pulse" />
              <circle cx="50" cy="50" r="3.5" fill="none" stroke="#fbbf24" strokeWidth="0.4" />
              <text x="50" y="45" textAnchor="middle" fontSize="3" fill="#fbbf24" fontWeight="bold">
                NIGHT CORNER
              </text>
            </g>
            {/* sample customer markers */}
            <CustomerMarker dx={-18} dy={12} label="You" />
            <CustomerMarker dx={22} dy={-8} label="Nearby" />
          </svg>
        </div>
      </div>
    </section>
  );
}

function CustomerMarker({ dx, dy, label }: { dx: number; dy: number; label: string }) {
  return (
    <g>
      <circle cx={50 + dx} cy={50 + dy} r="1.4" fill="#38bdf8" />
      <text x={50 + dx} y={50 + dy - 2.5} textAnchor="middle" fontSize="2.4" fill="#bae6fd">
        {label}
      </text>
    </g>
  );
}
