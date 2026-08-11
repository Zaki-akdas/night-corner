"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Moon } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        mobile: form.mobile.replace(/\D/g, ""),
        password: form.password,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Sign up failed");
      setLoading(false);
      return;
    }
    await signIn("credentials", {
      identifier: form.email,
      password: form.password,
      redirect: false,
    });
    router.push("/account");
    router.refresh();
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md items-center px-4 py-10">
      <div className="card w-full p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-neon-purple to-neon-blue shadow-neon">
            <Moon className="h-7 w-7 text-white" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-white">Create your account</h1>
          <p className="text-sm text-slate-400">Join Night Corner for late-night essentials</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={update("name")} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={update("email")} required />
          </div>
          <div>
            <label className="label">Mobile Number</label>
            <input className="input" value={form.mobile} onChange={update("mobile")} placeholder="10-digit" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.password} onChange={update("password")} minLength={6} required />
            </div>
            <div>
              <label className="label">Confirm</label>
              <input type="password" className="input" value={form.confirm} onChange={update("confirm")} minLength={6} required />
            </div>
          </div>
          {error && <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
          <button disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account? <Link href="/login" className="text-neon-purple hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
