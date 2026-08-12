import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import { statusLabel } from "@/lib/orders";
import { parseAddressSnapshot, formatAddressLine } from "@/lib/address";
import { RefreshButton } from "@/components/delivery/refresh-button";
import { Bike, MapPin, Package } from "lucide-react";

export const dynamic = "force-dynamic";

// Statuses a delivery person still has to act on.
const ACTIVE_STATUSES = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "PACKED",
  "OUT_FOR_DELIVERY",
];

export default async function DeliveryDashboardPage() {
  await requireRole("STAFF", "ADMIN");

  const orders = await prisma.order.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-white">Active Deliveries</h1>
          <p className="text-sm text-slate-400">
            {orders.length} order{orders.length === 1 ? "" : "s"} waiting for delivery
          </p>
        </div>
        <RefreshButton />
      </div>

      {orders.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
            <Bike className="h-7 w-7 text-emerald-400" />
          </span>
          <p className="font-semibold text-white">All caught up!</p>
          <p className="max-w-sm text-sm text-slate-400">
            No orders need delivery right now. Pull the Refresh button when you&apos;re back.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {orders.map((o) => {
            const addr = parseAddressSnapshot(o.addressSnapshot);
            const line = formatAddressLine(addr);
            return (
              <Link
                key={o.id}
                href={`/delivery/${o.id}`}
                className="card group relative block space-y-3 p-5 transition hover:border-neon-blue/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-lg font-extrabold text-white">{o.orderNumber}</div>
                    <div className="text-xs text-slate-400">
                      {o.items.length} item{o.items.length === 1 ? "" : "s"} · {formatINR(o.total)} ·{" "}
                      {o.paymentMethod}
                    </div>
                  </div>
                  <span
                    className={`chip ${
                      o.status === "OUT_FOR_DELIVERY"
                        ? "bg-neon-blue/20 text-neon-blue"
                        : "bg-neon-purple/20 text-neon-purple"
                    }`}
                  >
                    {statusLabel(o.status)}
                  </span>
                </div>

                <div className="flex items-start gap-2 text-sm text-slate-300">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neon-blue" />
                  <span className="line-clamp-2">{line ?? "No address on file"}</span>
                </div>

                {o.eta && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Package className="h-3.5 w-3.5" /> ETA {o.eta}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
