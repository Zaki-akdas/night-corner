import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { UserRoleToggle } from "./role-toggle";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold text-white">Admin Users</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <td className="p-3 font-semibold text-white">{u.name}</td>
                <td className="p-3 text-slate-300">{u.email}</td>
                <td className="p-3"><UserRoleToggle id={u.id} role={u.role} /></td>
                <td className="p-3">
                  <span className={`chip ${u.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
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
