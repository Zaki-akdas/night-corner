"use client";
import { useEffect, useState } from "react";
import { Trash2, Plus, MapPin, Star, Locate, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { RefreshButton } from "@/components/ui/refresh-button";

type Address = {
  id: string;
  fullName: string;
  mobile: string;
  house: string;
  street: string;
  area: string;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  lat?: number | null;
  lng?: number | null;
  isDefault?: boolean;
};

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editing, setEditing] = useState<Partial<Address> | null>(null);
  const [locating, setLocating] = useState(false);
  const toast = useToast();

  const load = async () => {
    const res = await fetch("/api/account/addresses");
    setAddresses(await res.json());
  };
  useEffect(() => {
    load();
  }, []);

  const useLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setEditing((e) => ({
          ...(e ?? {}),
          lat: +p.coords.latitude.toFixed(6),
          lng: +p.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.push({ type: "error", message: "Could not get location" });
      }
    );
  };

  const save = async () => {
    if (!editing) return;
    const res = await fetch("/api/account/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.push({ type: "error", message: d.error || "Could not save" });
      return;
    }
    toast.push({ type: "success", message: "Address saved" });
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
    load();
  };

  const makeDefault = async (id: string) => {
    await fetch(`/api/account/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    load();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-white">Saved Addresses</h1>
        <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
          <RefreshButton label="Refresh" onRefresh={load} />
          <button onClick={() => setEditing({})} className="btn-primary py-2 text-sm">
            <Plus className="h-4 w-4" /> Add Address
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {addresses.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neon-purple" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">
                  {a.fullName}
                  {a.isDefault && (
                    <span className="ml-2 chip bg-warm-yellow/20 text-warm-yellow">
                      <Star className="h-3 w-3" /> Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-300">
                  {[a.house, a.street, a.area, a.landmark].filter(Boolean).join(", ")}
                  <br />
                  {a.city} - {a.pincode}, {a.state}
                </p>
                <p className="text-xs text-slate-500">{a.mobile}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!a.isDefault && (
                <button onClick={() => makeDefault(a.id)} className="btn-ghost px-3 py-1.5 text-xs">
                  Set default
                </button>
              )}
              <button onClick={() => remove(a.id)} className="btn-ghost px-3 py-1.5 text-xs text-rose-300">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-night-950/80 p-4 backdrop-blur-sm">
          <div className="card max-h-[90vh] w-full max-w-lg overflow-auto p-4 sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-white">New Address</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Inp label="Full Name*" v={editing.fullName} k="fullName" set={setEditing} />
              <Inp label="Mobile*" v={editing.mobile} k="mobile" set={setEditing} />
              <Inp label="House/Flat*" v={editing.house} k="house" set={setEditing} />
              <Inp label="Street*" v={editing.street} k="street" set={setEditing} />
              <Inp label="Area*" v={editing.area} k="area" set={setEditing} />
              <Inp label="Landmark" v={editing.landmark ?? ""} k="landmark" set={setEditing} />
              <Inp label="City*" v={editing.city} k="city" set={setEditing} />
              <Inp label="State*" v={editing.state} k="state" set={setEditing} />
              <Inp label="PIN Code*" v={editing.pincode} k="pincode" set={setEditing} />
            </div>
            <button onClick={useLocation} disabled={locating} className="btn-ghost mt-3 py-2 text-sm">
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
              Use current location
            </button>
            {editing.lat && editing.lng && (
              <p className="mt-2 text-xs text-emerald-300">📍 {editing.lat}, {editing.lng}</p>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button onClick={save} className="btn-primary flex-1">Save</button>
              <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Inp({
  label,
  v,
  k,
  set,
}: {
  label: string;
  v: string | undefined;
  k: keyof Address;
  set: React.Dispatch<React.SetStateAction<Partial<Address> | null>>;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input"
        value={v ?? ""}
        onChange={(e) => set((p) => ({ ...(p ?? {}), [k]: e.target.value }))}
      />
    </label>
  );
}
