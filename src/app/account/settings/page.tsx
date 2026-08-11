"use client";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export default function AccountSettingsPage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");
  const [email] = useState(session?.user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (res.ok) {
      update();
      toast.push({ type: "success", message: "Profile updated" });
    } else toast.push({ type: "error", message: "Could not update" });
  };

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-extrabold text-white">Account Settings</h1>
      <form onSubmit={save} className="card max-w-lg space-y-4 p-5">
        <div>
          <label className="label">Full Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input opacity-60" value={email} disabled />
        </div>
        <button className="btn-primary" disabled={saving}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
