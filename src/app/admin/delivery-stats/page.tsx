import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { statusLabel } from "@/lib/orders";
import Link from "next/link";
import { Bike, PackageCheck, Timer, Star, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["PLACED", "CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY"];

function minutesBetween(a: Date | null | undefined, b: Date | null | undefined, fallbackFrom: Date, fallbackTo: Date): number | null {
  const from = a ?? fallbackFrom;
  const to = b ?? fallbackTo;
  return Math.max(0, (to.getTime() - from.getTime()) / 60000);
}

export default async function AdminDeliveryStatsPage() {
  await requireAdmin();

  const staff = await prisma.user.findMany({
    where: { role: "STAFF", status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const staffIds = staff.map((s) => s.id);

  const [orders, recent] = await Promise.all([
    prisma.order.findMany({
      where: staffIds.length ? { assignedTo: { in: staffIds } } : { assignedTo: null },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        outForDeliveryAt: true,
        deliveredAt: true,
        deliveryRating: true,
        assignedTo: true,
      },
    }),
    prisma.order.findMany({
      where: { status: "DELIVERED" },
      select: {
        id: true,
        orderNumber: true,
        assignedTo: true,
        assignedToName: true,
        createdAt: true,
        updatedAt: true,
        outForDeliveryAt: true,
        deliveredAt: true,
        deliveryRating: true,
      },
      orderBy: { deliveredAt: "desc" },
      take: 10,
    }),
  ]);

  const rows = staff.map((s) => {
    const mine = orders.filter((o) => o.assignedTo === s.id);
    const delivered = mine.filter((o) => o.status === "DELIVERED");
    const times = delivered
      .map((o) => minutesBetween(o.outForDeliveryAt, o.deliveredAt, o.createdAt, o.updatedAt))
      .filter((m): m is number => m !== null);
    const ratings = delivered.filter((o) => o.deliveryRating != null).map((o) => o.deliveryRating as number);
    const avgMin = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    return {
      id: s.id,
      name: s.name || "Delivery Staff",
      assigned: mine.length,
      active: mine.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
      delivered: delivered.length,
      avgMin,
      avgRating,
      ratings: ratings.length,
    };
  });

  const allDelivered = orders.filter((o) => o.status === "DELIVERED");
  const allTimes = allDelivered
    .map((o) => minutesBetween(o.outForDeliveryAt, o.deliveredAt, o.createdAt, o.updatedAt))
    .filter((m): m is number => m !== null);
  const allRatings = allDelivered.filter((o) => o.deliveryRating != null).map((o) => o.deliveryRating as number);
  const overallAvgMin = allTimes.length ? allTimes.reduce((a, b) => a + b, 0) / allTimes.length : null;
  const overallAvgRating = allRatings.length ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : null;

  const fmtMin = (m: number | null) => (m == null ? "—" : m < 1 ? `${Math.round(m * 60)} sec` : `${Math.round(m)} min`);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-white">Delivery Staff</h1>
        <p className="text-sm text-slate-400">
          {staff.length} delivery person{staff.length === 1 ? "" : "s"} · delivered {allDelivered.length} order
          {allDelivered.length === 1 ? "" : "s"} · avg{" "}
          {fmtMin(overallAvgMin)} per delivery
          {allRatings.length > 0 && <> · avg rating {overallAvgRating!.toFixed(1)}/5</>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Bike className="h-4 w-4" />} label="Staff" value={String(staff.length)} tone="bg-neon-purple/10 text-neon-purple" />
        <Stat icon={<PackageCheck className="h-4 w-4" />} label="Orders delivered" value={String(allDelivered.length)} tone="bg-emerald-500/10 text-emerald-300" />
        <Stat icon={<Timer className="h-4 w-4" />} label="Avg delivery time" value={fmtMin(overallAvgMin)} tone="bg-neon-blue/10 text-neon-blue" />
        <Stat icon={<Star className="h-4 w-4" />} label="Avg rating" value={overallAvgRating == null ? "—" : `${overallAvgRating.toFixed(1)}/5`} tone="bg-warm-yellow/10 text-warm-yellow" />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3">Delivery person</th>
              <th className="p-3">Assigned</th>
              <th className="p-3">Active now</th>
              <th className="p-3">Delivered</th>
              <th className="p-3">Avg delivery time</th>
              <th className="p-3">Avg rating</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="p-3 font-semibold text-white">{r.name}</td>
                <td className="p-3 text-slate-300">{r.assigned}</td>
                <td className="p-3">
                  {r.active > 0 ? (
                    <span className="chip bg-neon-blue/20 text-neon-blue">{r.active} on the road</span>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </td>
                <td className="p-3 font-semibold text-emerald-300">{r.delivered}</td>
                <td className="p-3 text-slate-300">{fmtMin(r.avgMin)}</td>
                <td className="p-3">
                  {r.avgRating == null ? (
                    <span className="text-xs text-slate-500">No ratings yet</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-warm-yellow">
                      <Star className="h-3.5 w-3.5 fill-warm-yellow" /> {r.avgRating.toFixed(1)}
                      <span className="text-xs text-slate-500">({r.ratings})</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-400">
                  No active delivery staff yet — promote an account to Staff in{" "}
                  <Link href="/admin/users" className="text-neon-blue hover:underline">Admin Users</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="flex items-center gap-2 border-b border-white/10 p-4">
          <TrendingUp className="h-4 w-4 text-neon-blue" />
          <h2 className="font-bold text-white">Recent deliveries</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Delivery person</th>
              <th className="p-3">Time taken</th>
              <th className="p-3">Rating</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((o) => (
              <tr key={o.id} className="border-t border-white/5">
                <td className="p-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold text-neon-blue hover:underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="p-3 text-slate-300">{o.assignedToName || "Unassigned"}</td>
                <td className="p-3 text-slate-300">
                  {fmtMin(minutesBetween(o.outForDeliveryAt, o.deliveredAt, o.createdAt, o.updatedAt))}
                </td>
                <td className="p-3">
                  {o.deliveryRating == null ? (
                    <span className="text-xs text-slate-500">Not rated</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-warm-yellow">
                      <Star className="h-3.5 w-3.5 fill-warm-yellow" /> {o.deliveryRating}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td colSpan={4} className="p-10 text-center text-slate-400">No deliveries yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="truncate font-display text-lg font-extrabold text-white">{value}</div>
      </div>
    </div>
  );
}
