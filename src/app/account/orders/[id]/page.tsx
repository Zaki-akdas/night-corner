import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import { STATUS_FLOW } from "@/lib/types";
import { statusLabel } from "@/lib/orders";
import { OrderTimeline } from "@/components/account/order-timeline";
import { DeliveryRating } from "@/components/account/delivery-rating";
import { KeyRound, MapPin, Printer, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const order = await prisma.order.findFirst({
    where: { id, userId: user.id },
    include: { items: true, address: true },
  });
  if (!order) notFound();

  const addr = order.addressSnapshot ? JSON.parse(order.addressSnapshot) : order.address;
  const addressText = addr
    ? [
        addr.fullName,
        addr.mobile,
        [addr.house, addr.street].filter(Boolean).join(", "),
        [addr.area, addr.landmark].filter(Boolean).join(", "),
        `${addr.city} - ${addr.pincode}`,
        addr.state,
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/account/orders" className="text-sm text-slate-400 hover:text-white">← Back to orders</Link>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-white">{order.orderNumber}</h1>
          <p className="text-sm text-slate-400">{new Date(order.createdAt).toLocaleString("en-IN")}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/track-order?order=${order.orderNumber}`} className="btn">
            <MapPin className="h-4 w-4" /> Track Live
          </Link>
          <a href={`/api/orders/${order.id}/invoice`} target="_blank" className="btn-primary">
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </a>
        </div>
      </div>

      <OrderTimeline currentStatus={order.status} flow={STATUS_FLOW} />

      {/* Proof-of-delivery PIN — the delivery person asks for this at handover */}
      {order.deliveryPin && ["OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status) && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              {order.status === "DELIVERED" ? (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              ) : (
                <KeyRound className="h-5 w-5 text-emerald-400" />
              )}
            </span>
            <div>
              <div className="font-semibold text-white">
                {order.status === "DELIVERED" ? "Delivery verified ✓" : "Your delivery PIN"}
              </div>
              <p className="text-xs text-slate-400">
                {order.status === "DELIVERED"
                  ? "This order was confirmed with this PIN."
                  : "Share this PIN with your delivery person to confirm handover."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 ring-1 ring-emerald-500/30">
            <span className="font-display text-2xl font-extrabold tracking-[0.3em] text-emerald-300">
              {order.deliveryPin}
            </span>
          </div>
        </div>
      )}

      {order.status === "DELIVERED" && (
        <DeliveryRating orderId={order.id} orderNumber={order.orderNumber} current={order.deliveryRating} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-white">
            <MapPin className="h-4 w-4 text-neon-blue" /> Delivery Address
          </h2>
          {addressText.map((l: string, i: number) => (
            <p key={i} className="text-sm text-slate-300">{l}</p>
          ))}
          {order.distanceKm > 0 && (
            <p className="mt-2 text-xs text-slate-400">Distance: {order.distanceKm.toFixed(1)} KM · ETA: {order.eta}</p>
          )}
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-bold text-white">Payment</h2>
          <Row label="Method" value={order.paymentMethod} />
          <Row label="Status" value={order.paymentStatus} />
          <Row label="Subtotal" value={formatINR(order.subtotal)} />
          {order.discount > 0 && <Row label="Discount" value={"- " + formatINR(order.discount)} />}
          <Row label="Delivery" value={order.deliveryCharge === 0 ? "FREE" : formatINR(order.deliveryCharge)} />
          <Row label="Tax" value={formatINR(order.tax)} />
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-bold">
            <span>Total</span>
            <span className="text-warm-yellow">{formatINR(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-bold text-white">Items</h2>
        <div className="space-y-3">
          {order.items.map((i) => (
            <div key={i.id} className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-night-900/60">
                <Image src={i.image} alt={i.name} fill className="object-contain p-1" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">{i.name}</div>
                <div className="text-xs text-slate-400">SKU {i.sku} · Qty {i.quantity}</div>
              </div>
              <div className="font-semibold text-white">{formatINR(i.lineTotal)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-white/5 py-1.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100">{value}</span>
    </div>
  );
}
