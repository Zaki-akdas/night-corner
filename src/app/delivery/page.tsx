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
import { Bike, Clock, MapPin, Package, UserCheck, UserX } from "lucide-react";

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
  searchParams: Promise<{ status?: string; payment?: string; time?: string; sort?: string; assignee?: string }>;
}) {
  const user = await requireRole("STAFF", "ADMIN");

  const sp = await searchParams;
  const status = VALID_STATUSES.has(sp?.status ?? "") ? sp!.status! : "";
  const payment = VALID_PAYMENTS.has(sp?.payment ?? "") ? sp!.payment! : "";
  const time = sp?.time ?? "";
  const sort = VALID_SORTS.has(sp?.sort ?? "") ? sp!.sort! : "oldest";
  const assignee = sp?.assignee ?? "";

  const where: Prisma.OrderWhereInput = { status: { in: ACTIVE_STATUSES } };
  if (status) where.status = status;
  if (payment) where.paymentMethod = payment;
  const timeMs = TIME_FILTERS[time];
  if (timeMs) where.createdAt = { gte: new Date(Date.now() - timeMs) };
  if (user.role === "ADMIN") {
    if (assignee === "me") where.assignedTo = user.id;
    else if (assignee === "unassigned") where.assignedTo = null;
    else if (assignee) where.assignedTo = assignee;
  } else {
    // Staff see the unassigned pool plus their own assigned orders, so
    // fresh PLACED orders always appear on the dashboard. A rider still
    // can't browse another rider's assigned work.
    if (assignee === "me") where.assignedTo = user.id;
    else if (assignee === "unassigned") where.assignedTo = null;
    else where.OR = [{ assignedTo: user.id }, { assignedTo: null }];
  }

  const orderBy: Prisma.OrderOrderByWithRelationInput =
    sort === "newest"
      ? { createdAt: "desc" }
      : sort === "amount-desc"
        ? { total: "desc" }
        : sort === "amount-asc"
          ? { total: "asc" }
          : { createdAt: "asc" };

  const [orders, totalActive, statusGroups, paymentGroups, staffList, delivered] = await Promise.all([
    prisma.order.findMany({ where, orderBy, include: { items: true } }),
    prisma.order.count({ where: { status: { in: ACTIVE_STATUSES }, ...(user.role === "ADMIN" ? {} : { OR: [{ assignedTo: user.id }, { assignedTo: null }] }) } }),
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
    prisma.user.findMany({
      where: { role: "STAFF", status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.order.findMany({
      where: { status: "DELIVERED" },
      select: { createdAt: true, updatedAt: true, outForDeliveryAt: true, deliveredAt: true },
      orderBy: { deliveredAt: "desc" },
      take: 200,
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const g of statusGroups) statusCounts[g.status] = g._count._all;
  const paymentCounts: Record<string, number> = {};
  for (const g of paymentGroups) paymentCounts[g.paymentMethod] = g._count._all;

  const filtered = orders.length;
  const hasActiveFilters = Boolean(status || payment || time);

  // Shop-average delivery time (minutes) from recent delivered orders. Used to
  // flag OUT_FOR_DELIVERY orders that have exceeded it.
  const deliveryTimes = delivered
    .map((d) => {
      const from = d.outForDeliveryAt ?? d.createdAt;
      const to = d.deliveredAt ?? d.updatedAt;
      return (to.getTime() - from.getTime()) / 60000;
    })
    .filter((m) => m > 0 && Number.isFinite(m));
  const avgDeliveryMin = deliveryTimes.length
    ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
    : null;

  const lateCount = orders.filter((o) => {
    if (o.status !== "OUT_FOR_DELIVERY" || avgDeliveryMin == null) return false;
    const start = o.outForDeliveryAt ?? o.createdAt;
    return (Date.now() - start.getTime()) / 60000 > avgDeliveryMin;
  }).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-white">Active Deliveries</h1>
          <p className="text-sm text-slate-400">
            {filtered} of {totalActive} order{totalActive === 1 ? "" : "s"} waiting for delivery
            {lateCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 font-semibold text-amber-300">
                <Clock className="h-3.5 w-3.5" /> {lateCount} running late
              </span>
            )}
          </p>
        </div>
        <AutoRefresh />
      </div>

      <FilterBar
        statusCounts={statusCounts}
        paymentCounts={paymentCounts}
        currentUserId={user.id}
        staffList={staffList}
        isAdmin={user.role === "ADMIN"}
      />

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

                  {o.assignedToName ? (
                    <div className="flex items-center gap-1.5 text-xs text-neon-blue">
                      <UserCheck className="h-3.5 w-3.5" />
                      <span className="font-semibold">{o.assignedToName}</span>
                      <span className="text-slate-500">· assigned</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <UserX className="h-3.5 w-3.5" /> Unassigned
                    </div>
                  )}

                  {o.eta && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Package className="h-3.5 w-3.5" /> ETA {o.eta}
                    </div>
                  )}

                  {o.status === "OUT_FOR_DELIVERY" &&
                    (() => {
                      if (avgDeliveryMin == null) return null;
                      const start = o.outForDeliveryAt ?? o.createdAt;
                      const elapsedMin = (Date.now() - start.getTime()) / 60000;
                      if (elapsedMin <= avgDeliveryMin) return null;
                      return (
                        <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
                          <Clock className="h-3.5 w-3.5" />
                          Running late · {Math.round(elapsedMin)} min out (avg {Math.round(avgDeliveryMin)} min)
                        </div>
                      );
                    })()}
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
