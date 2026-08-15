import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import { SalesChart } from "@/components/admin/sales-chart";
import { CategoryChart } from "./category-chart";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireAdmin();
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now);
  monthStart.setDate(monthStart.getDate() - 30);

  const [daily, weekly, monthly, aovAgg, categoriesRaw, topProducts, repeatAgg, newCustomers, cancellationAgg] =
    await Promise.all([
      prisma.order.aggregate({ where: { createdAt: { gte: dayStart }, status: { not: "CANCELLED" } }, _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: { createdAt: { gte: weekStart }, status: { not: "CANCELLED" } }, _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, status: { not: "CANCELLED" } }, _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: { status: { not: "CANCELLED" } }, _avg: { total: true } }),
      prisma.category.findMany({ include: { products: { include: { orderItems: true } } } }),
      prisma.product.findMany({ where: { active: true }, orderBy: { sold: "desc" }, take: 8 }),
      prisma.user.findMany({ where: { role: "CUSTOMER" }, include: { _count: { select: { orders: true } } } }),
      prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: monthStart } } }),
      prisma.order.aggregate({ where: { status: "CANCELLED" }, _count: true }),
    ]);

  const repeatCustomers = repeatAgg.filter((u) => u._count.orders > 1).length;

  const salesByDay: { date: string; sales: number; orders: number }[] = [];
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
    salesByDay.push({
      date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      sales: agg._sum.total ?? 0,
      orders: agg._count,
    });
  }

  const categoryData = categoriesRaw
    .map((c) => {
      const sold = c.products.reduce((n, p) => n + p.orderItems.reduce((m, oi) => m + oi.quantity, 0), 0);
      return { name: c.name, sold };
    })
    .sort((a, b) => b.sold - a.sold);

  const totalCancelled = cancellationAgg._count;
  const deliveredOrders = await prisma.order.count({ where: { status: "DELIVERED" } });
  const cancelRate = deliveredOrders + totalCancelled > 0 ? Math.round((totalCancelled / (deliveredOrders + totalCancelled)) * 100) : 0;

  const cards = [
    { label: "Today", value: formatINR(daily._sum.total ?? 0), sub: `${daily._count} orders` },
    { label: "Last 7 days", value: formatINR(weekly._sum.total ?? 0), sub: `${weekly._count} orders` },
    { label: "Last 30 days", value: formatINR(monthly._sum.total ?? 0), sub: `${monthly._count} orders` },
    { label: "Avg order value", value: formatINR(aovAgg._avg.total ?? 0), sub: "all time" },
    { label: "New customers (30d)", value: newCustomers, sub: "signups" },
    { label: "Repeat customers", value: repeatCustomers, sub: "2+ orders" },
    { label: "Cancellation rate", value: cancelRate + "%", sub: `${totalCancelled} cancelled` },
    { label: "Total customers", value: repeatAgg.length, sub: "registered" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold text-white">Analytics</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-lg font-extrabold text-white">{c.value}</div>
            <div className="text-xs text-slate-400">{c.label}</div>
            <div className="text-[11px] text-slate-500">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-bold text-white">Sales — last 14 nights</h2>
          <SalesChart data={salesByDay} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-bold text-white">Category performance</h2>
          <CategoryChart data={categoryData} />
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 font-bold text-white">Product performance</h2>
        <div className="space-y-2">
          {topProducts.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="w-6 text-right text-sm font-bold text-neon-purple">#{i + 1}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">{p.name}</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-neon-purple to-neon-blue"
                    style={{ width: `${topProducts[0] ? (p.sold / topProducts[0].sold) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-300">{p.sold} sold</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
