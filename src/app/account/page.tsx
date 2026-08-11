import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import { Package, Clock, CheckCircle2, XCircle, Wallet } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AccountDashboard() {
  const user = await requireUser();
  const [orders, activeCount, completedCount, cancelledCount, totalAgg] =
    await Promise.all([
      prisma.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: true },
      }),
      prisma.order.count({
        where: {
          userId: user.id,
          status: { in: ["PLACED", "CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY"] },
        },
      }),
      prisma.order.count({ where: { userId: user.id, status: "DELIVERED" } }),
      prisma.order.count({ where: { userId: user.id, status: "CANCELLED" } }),
      prisma.order.aggregate({
        where: { userId: user.id, status: { not: "CANCELLED" } },
        _sum: { total: true },
        _count: true,
      }),
    ]);

  const cards = [
    { label: "Total Orders", value: totalAgg._count, icon: <Package className="h-5 w-5" />, color: "from-neon-purple to-neon-blue" },
    { label: "Active Orders", value: activeCount, icon: <Clock className="h-5 w-5" />, color: "from-sky-500 to-cyan-500" },
    { label: "Completed", value: completedCount, icon: <CheckCircle2 className="h-5 w-5" />, color: "from-emerald-500 to-green-500" },
    { label: "Cancelled", value: cancelledCount, icon: <XCircle className="h-5 w-5" />, color: "from-rose-500 to-pink-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-white">Hello, {user.name} 👋</h1>
        <p className="text-slate-400">Here&apos;s a summary of your late-night orders.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${c.color} text-white`}>
              {c.icon}
            </div>
            <div className="text-2xl font-extrabold text-white">{c.value}</div>
            <div className="text-xs text-slate-400">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 text-warm-yellow">
          <Wallet className="h-5 w-5" />
          <span className="font-semibold">Total Spending</span>
          <span className="ml-auto text-2xl font-extrabold">
            {formatINR(totalAgg._sum.total ?? 0)}
          </span>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-white">Recent Orders</h2>
          <Link href="/account/orders" className="text-sm text-neon-blue hover:underline">
            View all
          </Link>
        </div>
        {orders.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            No orders yet. <Link href="/shop" className="text-neon-purple">Start shopping</Link>.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/account/orders/${o.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/5"
              >
                <div>
                  <div className="font-semibold text-white">{o.orderNumber}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(o.createdAt).toLocaleString("en-IN")} · {o.items.length} items
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-white">{formatINR(o.total)}</div>
                  <div className="text-xs text-neon-purple">{o.status.replace(/_/g, " ")}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
