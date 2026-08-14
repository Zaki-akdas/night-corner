"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Bike, Loader2, ShieldCheck } from "lucide-react";

export default function StaffLoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") router.replace("/delivery");
  }, [status, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      identifier,
      password,
      staffOnly: "true",
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("This account is not an approved delivery staff account, or the details are incorrect.");
      return;
    }
    router.replace("/delivery");
    router.refresh();
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md items-center px-4 py-10">
      <div className="card w-full p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-blue to-neon-purple shadow-neon">
            <Bike className="h-7 w-7 text-white" />
          </span>
          <h1 className="font-display text-2xl font-extrabold text-white">Delivery staff portal</h1>
          <p className="mt-1 text-sm text-slate-400">Approved staff can pick up unassigned orders and manage their assigned deliveries.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email or mobile</label>
            <input className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
          <button disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ShieldCheck className="h-5 w-5" /> Verify and continue</>}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-500">Not approved yet? Ask an administrator to make your account active delivery staff.</p>
        <p className="mt-3 text-center text-sm text-slate-400"><Link href="/login" className="text-neon-purple hover:underline">Customer login</Link></p>
      </div>
    </div>
  );
}
