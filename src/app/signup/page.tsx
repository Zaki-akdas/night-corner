"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Loader2, MailCheck, Moon } from "lucide-react";

type Step = "form" | "otp";

export default function SignupPage() {
  const router = useRouter();
  const { status } = useSession();
  // Already signed in? Go straight to the home page — no point showing the form.
  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startCooldown = (secs: number) => {
    setCooldown(secs);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const requestOtp = async () => {
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return false;
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
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Sign up failed");
      return false;
    }
    // Demo mode (no SMTP): the code is echoed back so the flow is testable.
    if (data.devOtp) setDevOtp(data.devOtp);
    startCooldown(60);
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await requestOtp();
    if (ok) setStep("otp");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        otp,
        name: form.name,
        mobile: form.mobile.replace(/\D/g, ""),
        password: form.password,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Verification failed");
      return;
    }
    await signIn("credentials", {
      identifier: form.email,
      password: form.password,
      redirect: false,
    });
    // Land on the home page after signup, matching the login flow.
    router.push("/");
    router.refresh();
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not resend the code");
      if (res.status === 429) startCooldown(60);
      return;
    }
    if (data.devOtp) setDevOtp(data.devOtp);
    startCooldown(60);
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md items-center px-4 py-10">
      <div className="card w-full p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-neon-purple to-neon-blue shadow-neon">
            {step === "form" ? <Moon className="h-7 w-7 text-white" /> : <MailCheck className="h-7 w-7 text-white" />}
          </div>
          {step === "form" ? (
            <>
              <h1 className="font-display text-2xl font-extrabold text-white">Create your account</h1>
              <p className="text-sm text-slate-400">Join Night Corner for late-night essentials</p>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-extrabold text-white">Verify your email</h1>
              <p className="text-sm text-slate-400">
                We sent a 6-digit code to <span className="font-semibold text-slate-200">{form.email}</span>
              </p>
            </>
          )}
        </div>

        {step === "form" ? (
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
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <div>
              <label className="label">Verification Code</label>
              <input
                className="input text-center text-2xl font-bold tracking-[0.5em]"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                inputMode="numeric"
                autoFocus
                required
              />
            </div>
            {devOtp && (
              <p className="rounded-lg bg-amber-400/10 p-3 text-center text-sm text-amber-300">
                Demo mode (no email service configured): your code is <b className="tracking-widest">{devOtp}</b>
              </p>
            )}
            {error && <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
            <button disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & Create Account"}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => { setStep("form"); setOtp(""); setError(""); }}
                className="text-slate-400 hover:text-slate-200"
              >
                ← Change email
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={loading || cooldown > 0}
                className="text-neon-purple hover:underline disabled:text-slate-500"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account? <Link href="/login" className="text-neon-purple hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
