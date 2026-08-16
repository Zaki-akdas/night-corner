import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin";
import { formatINR, getSettings } from "@/lib/settings";
import { paymentMethodLabel, statusLabel } from "@/lib/orders";
import { gatewayConfigured } from "@/lib/payments";
import {
  parseAddressSnapshot,
  formatAddressLine,
  hasCoordinates,
  mapsEmbedUrl,
  mapsRouteEmbedUrl,
  mapsDirectionsUrl,
} from "@/lib/address";
import { DeliveryStatusActions } from "@/components/delivery/status-actions";
import { AcceptOrderButton } from "@/components/delivery/accept-button";
import {
  ArrowLeft,
  Bike,
  Calendar,
  KeyRound,
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
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await requireRole("STAFF", "ADMIN");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: true },
  });
  if (!order) notFound();
  if (user.role !== "ADMIN" && order.assignedTo !== user.id && order.assignedTo !== null) notFound();

  const settings = await getSettings();
  const addr = parseAddressSnapshot(order.addressSnapshot);
  const addressLine = formatAddressLine(addr);
  const showMap = hasCoordinates(addr);
  const lat = showMap ? (addr!.lat as number) : 0;
  const lng = showMap ? (addr!.lng as number) : 0;

  // Route from the shop to the delivery address (both ends pinned).
  const shopCoords = { lat: settings.shopLat, lng: settings.shopLng };
  const showRoute =
    showMap &&
    Number.isFinite(shopCoords.lat) &&
    Number.isFinite(shopCoords.lng) &&
    (shopCoords.lat !== lat || shopCoords.lng !== lng);

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

      {/* Delivery-PIN reminder — the rider must COLLECT the PIN from the
          customer at handover; the PIN value itself is never shown here. */}
      {order.deliveryPin && !["CANCELLED", "REFUNDED", "DELIVERED"].includes(order.status) && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15">
            <KeyRound className="h-5 w-5 text-amber-300" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-white">Delivery PIN required at handover</div>
            <p className="text-sm text-amber-100/80">
              The customer was sent a 4-digit delivery PIN on their phone. Ask them for it when you
              hand over the order — you&apos;ll enter it to confirm delivery.
            </p>
            {customerMobile && (
              <a
                href={`tel:${customerMobile}`}
                aria-label={`Call ${customerMobile} to ask for the delivery PIN`}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                <Phone className="h-3.5 w-3.5" />
                Call customer · {customerMobile}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Available order — rider can claim it before acting on it */}
      {user.role !== "ADMIN" && !order.assignedTo && (
        <div className="card flex flex-col items-center gap-2 border-amber-400/30 bg-amber-500/10 p-6 text-center">
          <p className="font-bold text-white">This order is available</p>
          <p className="max-w-md text-sm text-slate-400">
            Accept it to claim it — it will be assigned to you and stop showing to other riders.
          </p>
          <AcceptOrderButton orderId={order.id} orderNumber={order.orderNumber} />
        </div>
      )}

      {/* Status actions */}
      <DeliveryStatusActions
        orderId={order.id}
        currentStatus={order.status}
        customerMobile={customerMobile}
      />

      {/* Header */}
      <div className="card space-y-1 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl font-extrabold text-white">{order.orderNumber}</h1>
          <span className="text-sm text-slate-400">
            {paymentMethodLabel(order.paymentMethod)} · {statusLabel(order.paymentStatus)}
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
              <div className="space-y-3">
                {/* Distance badge — straight-line distance from the shop */}
                {showRoute && order.distanceKm > 0 && (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-neon-blue/10 px-3 py-2 text-sm ring-1 ring-neon-blue/20">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                      <Navigation className="h-4 w-4 text-neon-blue" /> Delivery distance
                    </span>
                    <span className="font-bold text-neon-blue">{order.distanceKm.toFixed(1)} km</span>
                  </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-white/10">
                  {showRoute ? (
                    /* Keyless Google Maps embed drawing the shop → delivery route */
                    <iframe
                      title="Delivery route map — shop to delivery address"
                      src={mapsRouteEmbedUrl(shopCoords, { lat, lng })}
                      className="h-64 w-full sm:h-80"
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    /* Fallback: single pin at the delivery location */
                    <iframe
                      title="Delivery location map"
                      src={mapsEmbedUrl(lat, lng)}
                      className="h-64 w-full sm:h-80"
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  )}
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

        {/* Right column: proof of delivery + billing summary */}
        <div className="space-y-5">
          {/* Proof of delivery */}

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
            {order.paymentMethod === "SPLIT" && order.advancePaid > 0 && (
              <>
                <div className="flex justify-between text-emerald-300">
                  <dt>Paid now (UPI)</dt>
                  <dd>{formatINR(order.advancePaid)}</dd>
                </div>
                <div className="flex justify-between text-warm-yellow">
                  <dt>Cash on delivery</dt>
                  <dd>{formatINR(order.balanceDue)}</dd>
                </div>
              </>
            )}
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2 text-base font-bold text-white">
              <dt>Total</dt>
              <dd className="text-warm-yellow">{formatINR(order.total)}</dd>
            </div>
          </dl>
          {order.paymentMethod === "SPLIT" && order.balanceDue > 0 && (
            <div className="rounded-xl bg-warm-yellow/10 p-3 text-sm ring-1 ring-warm-yellow/30">
              <span className="font-bold text-warm-yellow">Collect {formatINR(order.balanceDue)} cash</span>{" "}
              <span className="text-slate-300">at handover · {formatINR(order.advancePaid)} already paid via UPI.</span>
            </div>
          )}
          {gatewayConfigured() && order.paymentMethod === "UPI" && order.paymentStatus !== "PAID" && (
            <div className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200 ring-1 ring-amber-500/30">
              ⚠️ Awaiting UPI payment — this order can only be dispatched after the payment is verified.
            </div>
          )}
          {gatewayConfigured() && order.paymentMethod === "SPLIT" && !order.advanceReceivedAt && (
            <div className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200 ring-1 ring-amber-500/30">
              ⚠️ UPI advance not confirmed — confirm it before dispatching this order.
            </div>
          )}
          {order.notes && (
            <div className="rounded-xl bg-white/5 p-3 text-sm text-slate-300">
              <span className="font-semibold text-white">Notes: </span>
              {order.notes}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
