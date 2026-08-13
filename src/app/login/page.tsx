"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[80vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-neon-purple" /></div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  // Land on the home page after login by default; ?callbackUrl= still works
  // for deep links (e.g. /checkout redirecting back after auth).
  const callbackUrl = params.get("callbackUrl") || "/";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email/mobile or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md items-center px-4 py-10">
      <div className="card w-full p-8">
        <div className="mb-6 text-center">
          <Image
            src="/logo.png"
            alt="Night Corner"
            width={224}
            height={59}
            loading="eager"
            className="mx-auto drop-shadow-neon"
          />
          <h1 className="mt-4 font-display text-2xl font-extrabold text-white">Welcome back</h1>
          <p className="text-sm text-slate-400">Login to continue your midnight order</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email or Mobile</label>
            <input
              className="input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com or 9999999999"
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
          <button disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          New to Night Corner?{" "}
          <Link href="/signup" className="text-neon-purple hover:underline">Create account</Link>
        </p>
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
          <div className="mb-1 font-semibold text-slate-300">Demo accounts</div>
          Admin: admin@nightcorner.in / admin123<br />
          Customer: rahul@example.com / customer123
        </div>
      </div>
    </div>
  );
}
