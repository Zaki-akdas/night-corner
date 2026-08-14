"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { AppSettings } from "@/lib/settings";

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setS((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setSaving(false);
    if (res.ok) {
      toast.push({ type: "success", message: "Settings saved" });
      router.refresh();
    } else toast.push({ type: "error", message: "Save failed" });
  };

  const updateSlab = (i: number, field: "upToKm" | "charge", value: number) => {
    const slabs = [...s.deliverySlabs];
    slabs[i] = { ...slabs[i], [field]: value };
    set("deliverySlabs", slabs);
  };

  return (
    <div className="space-y-5">
      {/* Business hours */}
      <section className="card space-y-4 p-5">
        <h2 className="font-bold text-white">Business Hours</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Opening time</span>
            <input type="time" className="input" value={s.openTime} onChange={(e) => set("openTime", e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Closing time</span>
            <input type="time" className="input" value={s.closeTime} onChange={(e) => set("closeTime", e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <Toggle label="Force open (override hours)" on={s.forceOpen} onClick={() => set("forceOpen", !s.forceOpen)} />
          <Toggle label="Emergency closed" on={s.emergencyClosed} onClick={() => set("emergencyClosed", !s.emergencyClosed)} />
        </div>
        <label className="block">
          <span className="label">Shop timezone (IANA)</span>
          <input
            className="input"
            value={s.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            placeholder="Asia/Kolkata"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Open/close times are evaluated in this timezone, not the server&apos;s.
          </span>
        </label>
      </section>

      {/* Shop location */}
      <section className="card space-y-4 p-5">
        <h2 className="font-bold text-white">Shop Location</h2>
        <label className="block">
          <span className="label">Shop address</span>
          <input className="input" value={s.shopAddress} onChange={(e) => set("shopAddress", e.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="label">Latitude</span>
            <input type="number" step="0.000001" className="input" value={s.shopLat} onChange={(e) => set("shopLat", Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="label">Longitude</span>
            <input type="number" step="0.000001" className="input" value={s.shopLng} onChange={(e) => set("shopLng", Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="label">Max radius (KM)</span>
            <input type="number" className="input" value={s.maxRadiusKm} onChange={(e) => set("maxRadiusKm", Number(e.target.value))} />
          </label>
        </div>
      </section>

      {/* Delivery charges */}
      <section className="card space-y-4 p-5">
        <h2 className="font-bold text-white">Delivery Charges</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="label">Min order (₹)</span>
            <input type="number" className="input" value={s.minOrderAmount} onChange={(e) => set("minOrderAmount", Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="label">Free delivery above (₹)</span>
            <input type="number" className="input" value={s.freeDeliveryAbove} onChange={(e) => set("freeDeliveryAbove", Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="label">Tax (%)</span>
            <input type="number" className="input" value={s.taxPercent} onChange={(e) => set("taxPercent", Number(e.target.value))} />
          </label>
        </div>
        <Toggle label="Enable free delivery threshold" on={s.freeDeliveryEnabled} onClick={() => set("freeDeliveryEnabled", !s.freeDeliveryEnabled)} />

        <div>
          <div className="label">Distance slabs (up to KM → ₹)</div>
          <div className="space-y-2">
            {s.deliverySlabs.map((slab, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="number" className="input max-w-[120px]" value={slab.upToKm} onChange={(e) => updateSlab(i, "upToKm", Number(e.target.value))} />
                <span className="text-slate-400">KM →</span>
                <input type="number" className="input max-w-[120px]" value={slab.charge} onChange={(e) => updateSlab(i, "charge", Number(e.target.value))} />
                <button
                  onClick={() => set("deliverySlabs", s.deliverySlabs.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              set("deliverySlabs", [...s.deliverySlabs, { upToKm: s.maxRadiusKm, charge: 50 }])
            }
            className="btn-ghost mt-2 py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add slab
          </button>
        </div>
        <label className="block">
          <span className="label">Estimated delivery time (minutes)</span>
          <input type="number" className="input max-w-[160px]" value={s.deliveryTimeMins} onChange={(e) => set("deliveryTimeMins", Number(e.target.value))} />
        </label>
      </section>

      {/* Payments */}
      <section className="card space-y-3 p-5">
        <h2 className="font-bold text-white">Payments</h2>
        <Toggle label="Cash on Delivery" on={s.codEnabled} onClick={() => set("codEnabled", !s.codEnabled)} />
        <Toggle label="UPI" on={s.upiEnabled} onClick={() => set("upiEnabled", !s.upiEnabled)} />
        <label className="block max-w-xs">
          <span className="label">UPI ID</span>
          <input className="input" value={s.upiId} onChange={(e) => set("upiId", e.target.value)} />
        </label>
        <Toggle label="Online payment gateway" on={s.onlineEnabled} onClick={() => set("onlineEnabled", !s.onlineEnabled)} />
      </section>

      {/* WhatsApp / contact */}
      <section className="card space-y-4 p-5">
        <h2 className="font-bold text-white">Contact & WhatsApp</h2>
        <label className="block max-w-sm">
          <span className="label">WhatsApp business number (with country code)</span>
          <input className="input" value={s.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Contact email</span>
            <input className="input" value={s.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Contact phone</span>
            <input className="input" value={s.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
          </label>
        </div>
      </section>

      <button onClick={save} disabled={saving} className="btn-primary px-8">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Save Settings
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
