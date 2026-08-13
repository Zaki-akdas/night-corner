import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import { statusLabel } from "@/lib/orders";
import Link from "next/link";
import { AdminOrderFilters } from "./filters";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; payment?: string; q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const where: any = {};
  if (sp.status) where.status = sp.status;
  if (sp.payment) where.paymentMethod = sp.payment;
  if (sp.q) where.orderNumber = { contains: sp.q };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { user: true, items: true },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-white">Orders</h1>
        <p className="text-slate-400">{orders.length} orders shown</p>
      </div>

      <AdminOrderFilters />

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Items</th>
              <th className="p-3">Total</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="p-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold text-neon-blue hover:underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="p-3 text-slate-200">{o.user.name}</td>
                <td className="p-3 text-slate-400">{o.items.length}</td>
                <td className="p-3 font-semibold text-warm-yellow">{formatINR(o.total)}</td>
                <td className="p-3 text-slate-300">{o.paymentMethod}</td>
                <td className="p-3">
                  <span className="chip bg-neon-purple/20 text-neon-purple">{statusLabel(o.status)}</span>
                </td>
                <td className="p-3 text-xs text-slate-400">
                  {new Date(o.createdAt).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-slate-400">No orders match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
