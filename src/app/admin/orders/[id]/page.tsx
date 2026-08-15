import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import { OrderStatusUpdater } from "./status-updater";
import { AssigneeSelect } from "./assignee-select";
import { Download, MapPin, Phone } from "lucide-react";
import { waMeLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const [order, staff] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: { items: true, user: true, address: true },
    }),
    prisma.user.findMany({
      where: { role: "STAFF", status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
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
      ].join("\n")
    : "";
  const waLink = waMeLink(addr?.mobile || "", `Hi ${addr?.fullName}, regarding your Night Corner order ${order.orderNumber}.`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-white">{order.orderNumber}</h1>
          <p className="text-sm text-slate-400">{new Date(order.createdAt).toLocaleString("en-IN")}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/orders/${order.id}/invoice`} target="_blank" className="btn-ghost py-2 text-sm">
            <Download className="h-4 w-4" /> Invoice
          </a>
          <a href={waLink} target="_blank" rel="noreferrer" className="btn-whatsapp py-2 text-sm">
            <Phone className="h-4 w-4" /> Contact
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-bold text-white">Items</h2>
          <div className="space-y-3">
            {order.items.map((i) => (
              <div key={i.id} className="flex items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-night-900/60">
                  <Image src={i.image} alt={i.name} fill className="object-contain p-1" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white">{i.name}</div>
                  <div className="text-xs text-slate-400">{i.sku} · ₹{i.unitPrice} × {i.quantity}</div>
                </div>
                <div className="font-semibold text-white">{formatINR(i.lineTotal)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
            <Sum label="Subtotal" value={formatINR(order.subtotal)} />
            {order.discount > 0 && <Sum label="Discount" value={"- " + formatINR(order.discount)} />}
            <Sum label="Delivery" value={order.deliveryCharge === 0 ? "FREE" : formatINR(order.deliveryCharge)} />
            <Sum label="Tax" value={formatINR(order.tax)} />
            <div className="flex justify-between pt-2 font-bold">
              <span>Total</span>
              <span className="text-warm-yellow">{formatINR(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-white">
              <MapPin className="h-4 w-4 text-neon-blue" /> Delivery
            </h2>
            {addressText.split("\n").map((l: string, i: number) => (
              <p key={i} className="text-sm text-slate-300">{l}</p>
            ))}
            <p className="mt-2 text-xs text-slate-500">
              Distance: {order.distanceKm.toFixed(1)} KM · ETA: {order.eta}
            </p>
            {addr?.lat && (
              <a
                href={`https://www.google.com/maps?q=${addr.lat},${addr.lng}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-neon-blue hover:underline"
              >
                Open in Google Maps →
              </a>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-bold text-white">Payment</h2>
            <p className="text-sm text-slate-300">{order.paymentMethod} · {order.paymentStatus}</p>
          </div>

          <AssigneeSelect
            orderId={order.id}
            orderNumber={order.orderNumber}
            current={order.assignedTo}
            staff={staff}
          />

          <OrderStatusUpdater orderId={order.id} current={order.status} />
        </div>
      </div>
    </div>
  );
}

function Sum({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-300">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
