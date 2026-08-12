import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import { statusLabel } from "@/lib/orders";
import {
  parseAddressSnapshot,
  formatAddressLine,
  hasCoordinates,
  mapsEmbedUrl,
  mapsDirectionsUrl,
} from "@/lib/address";
import {
  ArrowLeft,
  Bike,
  Calendar,
  MapPin,
  Navigation,
  Package,
  Phone,
  Receipt,
  Ruler,
  Truck,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DeliveryOrderPage({
  params,
}: {
  params: { orderId: string };
}) {
  await requireRole("STAFF", "ADMIN");

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { items: true, user: true },
  });
  if (!order) notFound();

  const addr = parseAddressSnapshot(order.addressSnapshot);
  const addressLine = formatAddressLine(addr);
  const showMap = hasCoordinates(addr);
  const lat = showMap ? (addr!.lat as number) : 0;
  const lng = showMap ? (addr!.lng as number) : 0;

  const customerName = addr?.fullName || order.user?.name || "Customer";
  const customerMobile = addr?.mobile || order.user?.mobile || "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/delivery" className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> All deliveries
        </Link>
        <span className="chip bg-neon-purple/20 text-neon-purple">{statusLabel(order.status)}</span>
      </div>

      {/* Header */}
      <div className="card space-y-1 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl font-extrabold text-white">{order.orderNumber}</h1>
          <span className="text-sm text-slate-400">
            {order.paymentMethod} · {statusLabel(order.paymentStatus)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(order.createdAt).toLocaleString("en-IN")}
          </span>
          {order.eta && (
            <span className="inline-flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" /> ETA {order.eta}
            </span>
          )}
          {order.distanceKm > 0 && (
            <span className="inline-flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" /> {order.distanceKm.toFixed(1)} km from shop
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left column: details */}
        <div className="space-y-5">
          {/* Delivery address + map */}
          <div className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-bold text-white">
              <MapPin className="h-4 w-4 text-neon-blue" /> Delivery Address
            </h2>
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-slate-100">{customerName}</p>
              {customerMobile && (
                <a
                  href={`tel:${customerMobile}`}
                  className="inline-flex items-center gap-1.5 text-neon-blue hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" /> {customerMobile}
                </a>
              )}
              {addressLine && <p className="pt-1 text-slate-300">{addressLine}</p>}
              {!addressLine && <p className="text-slate-500">No address details on file.</p>}
            </div>

            {showMap ? (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  {/* Google Maps embed (keyless) — pin drops at the delivery location */}
                  <iframe
                    title="Delivery location map"
                    src={mapsEmbedUrl(lat, lng)}
                    className="h-64 w-full sm:h-80"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <a
                  href={mapsDirectionsUrl(lat, lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn inline-flex w-full items-center justify-center gap-2 text-sm"
                >
                  <Navigation className="h-4 w-4" /> Navigate in Google Maps
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-slate-400">
                <Bike className="h-4 w-4" />
                This order has no map location — ask the customer for directions.
              </div>
            )}
          </div>

          {/* Items */}
          <div className="card overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-white/10 p-4 font-bold text-white">
              <Package className="h-4 w-4 text-neon-purple" /> Items
            </div>
            <ul className="divide-y divide-white/5">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100">{it.name}</p>
                    <p className="text-xs text-slate-400">
                      {it.quantity} × {formatINR(it.unitPrice)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-white">{formatINR(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right column: billing summary */}
        <div className="card h-fit space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-bold text-white">
            <Receipt className="h-4 w-4 text-warm-yellow" /> Bill Summary
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-300">
              <dt>Subtotal</dt>
              <dd>{formatINR(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-300">
                <dt>Discount</dt>
                <dd>− {formatINR(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-slate-300">
              <dt>Delivery</dt>
              <dd>{formatINR(order.deliveryCharge)}</dd>
            </div>
            <div className="flex justify-between text-slate-300">
              <dt>Tax</dt>
              <dd>{formatINR(order.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2 text-base font-bold text-white">
              <dt>Total</dt>
              <dd className="text-warm-yellow">{formatINR(order.total)}</dd>
            </div>
          </dl>
          {order.notes && (
            <div className="rounded-xl bg-white/5 p-3 text-sm text-slate-300">
              <span className="font-semibold text-white">Notes: </span>
              {order.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
