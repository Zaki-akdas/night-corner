import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { UserRoleToggle } from "./role-toggle";
import { UserSearch } from "./user-search";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const counts = {
    all: users.length,
    staff: users.filter((u) => u.role === "STAFF").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-white">Admin Users</h1>
          <p className="text-sm text-slate-400">
            {counts.all} accounts · {counts.staff} delivery staff — set any account&apos;s role to{" "}
            <span className="font-semibold text-neon-purple">Staff</span> to give it the delivery
            dashboard
          </p>
        </div>
        <UserSearch placeholder="Search by name, email or mobile…" />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email / Mobile</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                data-user-row
                data-search={`${u.name ?? ""} ${u.email ?? ""} ${u.mobile ?? ""}`.toLowerCase()}
                className="border-t border-white/5"
              >
                <td className="p-3">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    {u.name || "—"}
                    {u.role === "STAFF" && (
                      <span className="chip bg-neon-blue/20 text-neon-blue">Delivery</span>
                    )}
                    {u.role === "ADMIN" && (
                      <span className="chip bg-neon-purple/20 text-neon-purple">Admin</span>
                    )}
                  </div>
                </td>
                <td className="p-3 text-slate-300">
                  {u.email || u.mobile || "—"}
                </td>
                <td className="p-3">
                  <UserRoleToggle id={u.id} role={u.role} />
                </td>
                <td className="p-3">
                  <span
                    className={`chip ${
                      u.status === "ACTIVE"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
