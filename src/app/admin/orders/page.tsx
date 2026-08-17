import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import { paymentMethodLabel, statusLabel } from "@/lib/orders";
import Link from "next/link";
import { AdminOrderFilters } from "./filters";
import { RefreshButton } from "@/components/ui/refresh-button";

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-white">Orders</h1>
          <p className="text-slate-400">{orders.length} orders shown</p>
        </div>
        <RefreshButton label="Refresh orders" />
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
              <th className="p-3">Assigned</th>
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
<td className="p-3">
                  {o.paymentMethod === "SPLIT" ? (
                    <span
                      className={
                        o.advanceReceivedAt
                          ? "chip bg-emerald-400/20 text-emerald-400"
                          : "chip bg-amber-400/20 text-amber-300"
                      }
                    >
                      {`Split · advance ${o.advanceReceivedAt ? "✓" : "unconfirmed"}`}
                    </span>
                  ) : (
                    <span className="text-slate-300">{paymentMethodLabel(o.paymentMethod)}</span>
                  )}</td>
                <td className="p-3">
                  <span className="chip bg-neon-purple/20 text-neon-purple">{statusLabel(o.status)}</span>
                </td>
                <td className="p-3">
                  {o.assignedToName ? (
                    <span className="chip bg-neon-blue/20 text-neon-blue">{o.assignedToName}</span>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </td>
                <td className="p-3 text-xs text-slate-400">
                  {new Date(o.createdAt).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-slate-400">No orders match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
