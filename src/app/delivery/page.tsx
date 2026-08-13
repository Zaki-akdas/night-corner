import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import { statusLabel } from "@/lib/orders";
import { parseAddressSnapshot, formatAddressLine } from "@/lib/address";
import { AutoRefresh } from "@/components/delivery/auto-refresh";
import { FilterBar } from "@/components/delivery/filter-bar";
import { DeliveryStatusActions } from "@/components/delivery/status-actions";
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

const TIME_FILTERS: Record<string, number> = {
  "1h": 3600_000,
  "4h": 4 * 3600_000,
  "8h": 8 * 3600_000,
};

const VALID_STATUSES = new Set(ACTIVE_STATUSES);
const VALID_PAYMENTS = new Set(["COD", "UPI", "ONLINE"]);
const VALID_SORTS = new Set(["oldest", "newest", "amount-desc", "amount-asc"]);

export default async function DeliveryDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; payment?: string; time?: string; sort?: string }>;
}) {
  await requireRole("STAFF", "ADMIN");

  const sp = await searchParams;
  const status = VALID_STATUSES.has(sp?.status ?? "") ? sp!.status! : "";
  const payment = VALID_PAYMENTS.has(sp?.payment ?? "") ? sp!.payment! : "";
  const time = sp?.time ?? "";
  const sort = VALID_SORTS.has(sp?.sort ?? "") ? sp!.sort! : "oldest";

  const where: Prisma.OrderWhereInput = { status: { in: ACTIVE_STATUSES } };
  if (status) where.status = status;
  if (payment) where.paymentMethod = payment;
  const timeMs = TIME_FILTERS[time];
  if (timeMs) where.createdAt = { gte: new Date(Date.now() - timeMs) };

  const orderBy: Prisma.OrderOrderByWithRelationInput =
    sort === "newest"
      ? { createdAt: "desc" }
      : sort === "amount-desc"
        ? { total: "desc" }
        : sort === "amount-asc"
          ? { total: "asc" }
          : { createdAt: "asc" };

  const [orders, totalActive, statusGroups, paymentGroups] = await Promise.all([
    prisma.order.findMany({ where, orderBy, include: { items: true } }),
    prisma.order.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    prisma.order.groupBy({
      by: ["status"],
      where: { status: { in: ACTIVE_STATUSES } },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: { status: { in: ACTIVE_STATUSES } },
      _count: { _all: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const g of statusGroups) statusCounts[g.status] = g._count._all;
  const paymentCounts: Record<string, number> = {};
  for (const g of paymentGroups) paymentCounts[g.paymentMethod] = g._count._all;

  const filtered = orders.length;
  const hasActiveFilters = Boolean(status || payment || time);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-white">Active Deliveries</h1>
          <p className="text-sm text-slate-400">
            {filtered} of {totalActive} order{totalActive === 1 ? "" : "s"} waiting for delivery
          </p>
        </div>
        <AutoRefresh />
      </div>

      <FilterBar statusCounts={statusCounts} paymentCounts={paymentCounts} />

      {orders.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
            <Bike className="h-7 w-7 text-emerald-400" />
          </span>
          <p className="font-semibold text-white">{hasActiveFilters ? "No orders match these filters" : "All caught up!"}</p>
          <p className="max-w-sm text-sm text-slate-400">
            {hasActiveFilters
              ? "Try widening the filters above — or clear them to see everything."
              : "New orders will appear here automatically — no need to refresh."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {orders.map((o) => {
            const addr = parseAddressSnapshot(o.addressSnapshot);
            const line = formatAddressLine(addr);
            return (
              <div
                key={o.id}
                data-order-number={o.orderNumber}
                className="card space-y-3 p-5 transition hover:border-neon-blue/50"
              >
                <Link href={`/delivery/${o.id}`} className="group block space-y-3">
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
                <DeliveryStatusActions orderId={o.id} currentStatus={o.status} compact />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
