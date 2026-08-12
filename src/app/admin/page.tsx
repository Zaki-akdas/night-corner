import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/settings";
import Link from "next/link";
import {
  DollarSign,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Users,
  Package,
  AlertTriangle,
  Truck,
} from "lucide-react";
import { SalesChart } from "@/components/admin/sales-chart";
import { statusLabel } from "@/lib/orders";

export const dynamic = "force-dynamic";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function AdminDashboard() {
  await requireAdmin();
  const now = new Date();
  const todayStart = startOfDay(now);
  // Tonight = 6 PM today onward (window before open) through current time
  const tonightStart = new Date(now);
  tonightStart.setHours(18, 0, 0, 0);
  if (now.getHours() < 18) tonightStart.setDate(tonightStart.getDate() - 1);

  const [
    totalSalesAgg,
    todayAgg,
    tonightAgg,
    totalOrders,
    pendingOrders,
    completedOrders,
    cancelledOrders,
    activeCustomers,
    productCount,
    deliveryRevAgg,
    recentOrders,
    topProducts,
    salesByDay,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { not: "CANCELLED" } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: todayStart }, status: { not: "CANCELLED" } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: tonightStart }, status: { not: "CANCELLED" } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.count(),
    prisma.order.count({
      where: { status: { in: ["PLACED", "CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY"] } },
    }),
    prisma.order.count({ where: { status: "DELIVERED" } }),
    prisma.order.count({ where: { status: "CANCELLED" } }),
    prisma.user.count({ where: { role: "CUSTOMER", status: "ACTIVE" } }),
    prisma.product.count({ where: { active: true } }),
    prisma.order.aggregate({ _sum: { deliveryCharge: true } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: true, items: true },
    }),
    prisma.product.findMany({ where: { active: true }, orderBy: { sold: "desc" }, take: 5 }),
    last14DaysSales(),
  ]);

  // low stock filter fallback (stock <= lowStockAt)
  const low = await prisma.product.findMany({
    where: { active: true, stock: { lte: 3 } },
    orderBy: { stock: "asc" },
    take: 6,
  });

  const cards = [
    { label: "Total Sales", value: formatINR(totalSalesAgg._sum.total ?? 0), icon: DollarSign, color: "from-emerald-500 to-green-600" },
    { label: "Today's Sales", value: formatINR(todayAgg._sum.total ?? 0), sub: `${todayAgg._count} orders`, icon: DollarSign, color: "from-neon-purple to-fuchsia-600" },
    { label: "Tonight's Sales", value: formatINR(tonightAgg._sum.total ?? 0), sub: `${tonightAgg._count} orders`, icon: Clock, color: "from-indigo-500 to-neon-blue" },
    { label: "Total Orders", value: totalOrders, icon: ShoppingBag, color: "from-sky-500 to-cyan-600" },
    { label: "Pending Orders", value: pendingOrders, icon: Clock, color: "from-amber-500 to-orange-600" },
    { label: "Completed", value: completedOrders, icon: CheckCircle2, color: "from-emerald-500 to-teal-600" },
    { label: "Cancelled", value: cancelledOrders, icon: AlertTriangle, color: "from-rose-500 to-pink-600" },
    { label: "Active Customers", value: activeCustomers, icon: Users, color: "from-violet-500 to-purple-700" },
    { label: "Products", value: productCount, icon: Package, color: "from-cyan-500 to-blue-700" },
    { label: "Delivery Revenue", value: formatINR(deliveryRevAgg._sum.deliveryCharge ?? 0), icon: Truck, color: "from-yellow-500 to-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">Dashboard</h1>
        <p className="text-slate-400">Tonight at a glance — sales, orders, inventory.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${c.color} text-white`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="text-xl font-extrabold text-white">{c.value}</div>
            <div className="text-xs text-slate-400">{c.label}</div>
            {c.sub && <div className="text-[11px] text-slate-500">{c.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card min-w-0 p-5 lg:col-span-2">
          <h2 className="mb-4 font-bold text-white">Sales — last 14 nights</h2>
          <SalesChart data={salesByDay} />
        </div>
        <div className="card min-w-0 p-5">
          <h2 className="mb-4 font-bold text-white">Top Products</h2>
          <ul className="space-y-3">
            {topProducts.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-sm font-bold text-neon-purple">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.sold} sold · {formatINR(p.price)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card min-w-0 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-white">Recent Orders</h2>
            <Link href="/admin/orders" className="text-sm text-neon-blue hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-2">Order</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Total</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-t border-white/5">
                    <td className="py-2.5">
                      <Link href={`/admin/orders/${o.id}`} className="font-semibold text-white hover:text-neon-blue">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2.5 text-slate-300">{o.user.name}</td>
                    <td className="py-2.5 text-warm-yellow">{formatINR(o.total)}</td>
                    <td className="py-2.5">
                      <span className="chip bg-neon-purple/20 text-neon-purple">{statusLabel(o.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card min-w-0 p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="font-bold text-white">Low Stock</h2>
          </div>
          {low.length === 0 ? (
            <p className="text-sm text-slate-400">All products well stocked. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {low.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
                  <span className="truncate text-sm text-slate-200">{p.name}</span>
                  <span className={`chip ${p.stock === 0 ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
                    {p.stock} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

async function last14DaysSales() {
  const out: { date: string; sales: number; orders: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const agg = await prisma.order.aggregate({
      where: { createdAt: { gte: d, lt: next }, status: { not: "CANCELLED" } },
      _sum: { total: true },
      _count: true,
    });
    out.push({
      date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      sales: agg._sum.total ?? 0,
      orders: agg._count,
    });
  }
  return out;
}
