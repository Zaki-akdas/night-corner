import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { formatINR } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requireAdmin();
  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: true } }, orders: { select: { total: true, status: true } } },
  });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold text-white">Customers</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3">Customer</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Orders</th>
              <th className="p-3">Spending</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const spending = c.orders
                .filter((o) => o.status !== "CANCELLED")
                .reduce((n, o) => n + o.total, 0);
              return (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="p-3">
                    <div className="font-semibold text-white">{c.name}</div>
                  </td>
                  <td className="p-3 text-slate-300">
                    <div>{c.email}</div>
                    <div className="text-xs text-slate-500">{c.mobile}</div>
                  </td>
                  <td className="p-3 text-slate-300">{c._count.orders}</td>
                  <td className="p-3 font-semibold text-warm-yellow">{formatINR(spending)}</td>
                  <td className="p-3 text-xs text-slate-400">{c.createdAt.toLocaleDateString("en-IN")}</td>
                  <td className="p-3">
                    <span className={`chip ${c.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
