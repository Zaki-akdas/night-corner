"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UserRoleToggle({ id, role }: { id: string; role: string }) {
  const router = useRouter();
  const [r, setR] = useState(role);
  const update = async (newRole: string) => {
    setR(newRole);
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    router.refresh();
  };
  return (
    <select value={r} onChange={(e) => update(e.target.value)} className="input max-w-[140px] py-1.5 text-xs">
      <option value="ADMIN">Admin</option>
      <option value="STAFF">Staff</option>
      <option value="CUSTOMER">Customer</option>
    </select>
  );
}
