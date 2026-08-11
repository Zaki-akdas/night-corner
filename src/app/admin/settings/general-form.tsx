"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { AppSettings } from "@/lib/settings";

export function GeneralSettingsForm({ initial }: { initial: AppSettings }) {
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setS((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: s.businessName,
        slogan: s.slogan,
        notifyEmail: s.notifyEmail,
        notifyWhatsapp: s.notifyWhatsapp,
        notifySms: s.notifySms,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.push({ type: "success", message: "Saved" });
      router.refresh();
    }
  };

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-5">
        <h2 className="font-bold text-white">Branding</h2>
        <label className="block">
          <span className="label">Business name</span>
          <input className="input" value={s.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Slogan</span>
          <input className="input" value={s.slogan} onChange={(e) => set("slogan", e.target.value)} />
        </label>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">
          Logo & favicon are served from <code className="text-neon-blue">/logo.svg</code> and <code className="text-neon-blue">/favicon.svg</code>. Replace the files in <code>/public</code> to rebrand.
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold text-white">Notifications</h2>
        <Toggle label="Email notifications" on={s.notifyEmail} onClick={() => set("notifyEmail", !s.notifyEmail)} />
        <Toggle label="WhatsApp notifications" on={s.notifyWhatsapp} onClick={() => set("notifyWhatsapp", !s.notifyWhatsapp)} />
        <Toggle label="SMS notifications" on={s.notifySms} onClick={() => set("notifySms", !s.notifySms)} />
      </section>

      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Save
      </button>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${on ? "border-neon-purple bg-neon-purple/10 text-white" : "border-white/10 text-slate-300"}`}>
      <span className={`relative h-5 w-9 rounded-full transition ${on ? "bg-neon-purple" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-4" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}
