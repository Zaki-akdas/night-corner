import type { ReactNode } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import { statusLabel } from "@/lib/orders";
import {
  ArrowLeft,
  Bike,
  Clock,
  IndianRupee,
  PackageCheck,
  Star,
  Timer,
  TrendingUp,
  Wallet,
  Smartphone,
} from "lucide-react";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["PLACED", "CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY"];

function minutesBetween(a: Date | null | undefined, b: Date | null | undefined, fallbackFrom: Date, fallbackTo: Date): number | null {
  const from = a ?? fallbackFrom;
  const to = b ?? fallbackTo;
  return Math.max(0, (to.getTime() - from.getTime()) / 60000);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function RiderStatsPage() {
  const user = await requireRole("STAFF", "ADMIN");

  const [orders] = await Promise.all([
    prisma.order.findMany({
      where: { assignedTo: user.id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentMethod: true,
        advancePaid: true,
        balanceDue: true,
        total: true,
        createdAt: true,
        updatedAt: true,
        outForDeliveryAt: true,
        deliveredAt: true,
        deliveryRating: true,
      },
      orderBy: { deliveredAt: "desc" },
    }),
  ]);

  const delivered = orders.filter((o) => o.status === "DELIVERED");
  const deliveredCount = delivered.length;
  const totalSales = delivered.reduce((a, o) => a + o.total, 0);
  const cashCollected = delivered
    .filter((o) => o.paymentMethod === "COD" || o.paymentMethod === "SPLIT")
    .reduce((a, o) => a + (o.paymentMethod === "SPLIT" ? o.balanceDue : o.total), 0);
  const upiCollected = delivered
    .filter((o) => o.paymentMethod === "UPI" || o.paymentMethod === "SPLIT")
    .reduce((a, o) => a + (o.paymentMethod === "SPLIT" ? o.advancePaid : o.total), 0);
  const activeCount = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;

  const times = delivered
    .map((o) => minutesBetween(o.outForDeliveryAt, o.deliveredAt, o.createdAt, o.updatedAt))
    .filter((m): m is number => m !== null);
  const avgMin = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;

  const ratings = delivered.filter((o) => o.deliveryRating != null).map((o) => o.deliveryRating as number);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()));
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

  const inRange = (o: { deliveredAt: Date | null }, from: Date) =>
    o.deliveredAt != null && o.deliveredAt >= from;
  const salesIn = (list: typeof delivered, from: Date) => {
    const rows = list.filter((o) => inRange(o, from));
    return { count: rows.length, sales: rows.reduce((a, o) => a + o.total, 0) };
  };
  const today = salesIn(delivered, todayStart);
  const week = salesIn(delivered, weekStart);
  const month = salesIn(delivered, monthStart);

  const fmtMin = (m: number | null) => (m == null ? "—" : m < 1 ? `${Math.round(m * 60)} sec` : `${Math.round(m)} min`);

  const Stat = ({
    icon,
    label,
    value,
    sub,
    tone = "text-neon-purple",
  }: {
    icon: ReactNode;
    label: string;
    value: string;
    sub?: string;
    tone?: string;
  }) => (
    <div className="card flex items-start gap-3 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="font-display text-xl font-extrabold text-white">{value}</div>
        {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-white">My Delivery Stats</h1>
          <p className="text-sm text-slate-400">
            {user.name ?? "Delivery Staff"} · your deliveries and sales
          </p>
        </div>
        <Link href="/delivery" className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Active deliveries
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<PackageCheck className="h-5 w-5" />} label="Orders delivered" value={String(deliveredCount)} sub={`${activeCount} active now`} tone="text-emerald-400" />
        <Stat icon={<IndianRupee className="h-5 w-5" />} label="Total sales" value={formatINR(totalSales)} sub="value of delivered orders" tone="text-neon-blue" />
        <Stat icon={<Wallet className="h-5 w-5" />} label="Cash collected" value={formatINR(cashCollected)} sub="COD + split balances at delivery" tone="text-warm-yellow" />
        <Stat icon={<Star className="h-5 w-5" />} label="Avg rating" value={avgRating == null ? "—" : `${avgRating.toFixed(1)} ★`} sub={ratings.length ? `${ratings.length} rated` : "no ratings yet"} tone="text-amber-300" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat icon={<Timer className="h-5 w-5" />} label="Avg delivery time" value={fmtMin(avgMin)} sub="out-for-delivery → delivered" tone="text-neon-purple" />
        <Stat icon={<Smartphone className="h-5 w-5" />} label="Collected via UPI" value={formatINR(upiCollected)} sub="UPI + split advances on delivered orders" tone="text-neon-blue" />
        <Stat icon={<TrendingUp className="h-5 w-5" />} label="This month" value={`${month.count} orders · ${formatINR(month.sales)}`} sub={`This week: ${week.count} orders · ${formatINR(week.sales)} · Today: ${today.count} orders · ${formatINR(today.sales)}`} tone="text-neon-blue" />
      </div>

      <div className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-white">
          <Clock className="h-4 w-4 text-neon-purple" /> Recent deliveries
        </h2>
        {delivered.length === 0 ? (
          <p className="text-sm text-slate-500">No delivered orders yet — they&apos;ll appear here once you complete your first delivery.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Delivered</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Payment</th>
                  <th className="py-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {delivered.slice(0, 10).map((o) => (
                  <tr key={o.id} className="border-b border-white/5 text-slate-300">
                    <td className="py-2 pr-3 font-semibold text-white">{o.orderNumber}</td>
                    <td className="py-2 pr-3 text-slate-400">{o.deliveredAt ? new Date(o.deliveredAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                    <td className="py-2 pr-3">{formatINR(o.total)}</td>
                    <td className="py-2 pr-3">{o.paymentMethod}</td>
                    <td className="py-2">{o.deliveryRating != null ? `${o.deliveryRating} ★` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-neon-blue/10 px-3 py-2 text-sm text-neon-blue ring-1 ring-neon-blue/20">
          <Bike className="h-4 w-4" /> You have {activeCount} active order{activeCount === 1 ? "" : "s"} in progress — keep going!
        </div>
      )}
    </div>
  );
}
