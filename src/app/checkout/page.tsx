"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import {
  MapPin,
  Truck,
  CreditCard,
  CheckCircle2,
  Locate,
  ShieldAlert,
  Tag,
  Loader2,
  Moon,
} from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { formatINR } from "@/lib/settings";
import { useToast } from "@/components/ui/toast";
import { useOpenStatus } from "@/hooks/use-open-status";

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
  instructions?: string | null;
  isDefault?: boolean;
};

type Quote = {
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  tax: number;
  total: number;
  freeDelivery: boolean;
  distanceKm: number;
  lines: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  minOrderMet: boolean;
  minOrderAmount: number;
  freeDeliveryAbove: number;
  taxPercent: number;
  couponCode?: string;
};

const STEPS = ["Cart", "Address", "Delivery", "Payment", "Confirmation"];

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const open = useOpenStatus();
  const { items, clear } = useCart();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [editingAddr, setEditingAddr] = useState<Partial<Address> | null>(null);
  const [locating, setLocating] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);
  const [patchingLocation, setPatchingLocation] = useState<string | null>(null); // address id being updated
  const [locationDraft, setLocationDraft] = useState<{ lat: string; lng: string }>({ lat: "", lng: "" });
  const [payment, setPayment] = useState<"COD" | "UPI" | "ONLINE">("COD");
  const [coupon, setCoupon] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<{
    cod: boolean;
    upi: boolean;
    online: boolean;
    upiId: string;
  }>({ cod: true, upi: true, online: false, upiId: "" });

  // Redirect unauthenticated users.
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/checkout");
  }, [status, router]);

  // Load payment settings.
  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) =>
        setPaymentConfig({
          cod: d.codEnabled,
          upi: d.upiEnabled,
          online: d.onlineEnabled,
          upiId: d.upiId,
        })
      )
      .catch(() => {});
  }, []);

  // Load addresses.
  useEffect(() => {
    if (session) {
      fetch("/api/account/addresses")
        .then((r) => r.json())
        .then((d: Address[]) => {
          setAddresses(d);
          const def = d.find((a) => a.isDefault) ?? d[0];
          if (def) setSelectedAddress(def.id);
        })
        .catch(() => {});
    }
  }, [session]);

  const currentAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddress) ?? null,
    [addresses, selectedAddress]
  );

  // Recompute quote when address or coupon changes.
  // Debounced + race-guarded: coupon typing fires one request per pause,
  // and a stale response can never clobber a newer one.
  useEffect(() => {
    if (step < 2 || items.length === 0) return;
    const addr = addresses.find((a) => a.id === selectedAddress);
    if (!addr?.lat || !addr?.lng) return;
    let cancelled = false;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            lat: addr.lat,
            lng: addr.lng,
            couponCode: coupon || undefined,
          }),
        });
        if (cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Could not calculate order");
        setQuote(data);
      } catch (e) {
        if (!cancelled) toast.push({ type: "error", message: (e as Error).message });
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [step, selectedAddress, addresses, coupon, items, toast]);

  if (status === "loading" || !session) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  if (items.length === 0 && !orderId) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 text-center">
        <div>
          <div className="text-6xl">🛒🌙</div>
          <p className="mt-3 text-slate-300">Your cart is waiting for some midnight essentials.</p>
        </div>
      </div>
    );
  }

  const useGeolocation = () => {
    if (!navigator.geolocation) {
      toast.push({ type: "error", message: "Geolocation is not supported by your browser" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditingAddr((a) => ({
          ...(a ?? {}),
          lat: +pos.coords.latitude.toFixed(6),
          lng: +pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
        toast.push({ type: "success", message: "Location captured" });
      },
      () => {
        setLocating(false);
        toast.push({ type: "error", message: "Could not get your location. Enter it manually." });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Returns the browser position or null when unavailable / denied / timed out.
  // Never throws, so address saving can always proceed even without a location.
  const captureBrowserLocation = (): Promise<GeolocationPosition | null> =>
    new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        resolve(null);
        return;
      }
      let done = false;
      const finish = (p: GeolocationPosition | null) => {
        if (!done) { done = true; resolve(p); }
      };
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => finish(pos),
          () => finish(null),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      } catch {
        finish(null);
      }
      // Safety net — never hold up the save longer than ~9 seconds.
      setTimeout(() => finish(null), 9000);
    });

  const saveAddress = async () => {
    if (!editingAddr) return;
    const required = ["fullName", "mobile", "house", "street", "area", "city", "state", "pincode"] as const;
    for (const k of required) {
      if (!editingAddr[k]?.toString().trim()) {
        toast.push({ type: "error", message: `Please fill in: ${k}` });
        return;
      }
    }
    if (!/^\d{10}$/.test(editingAddr.mobile!)) {
      toast.push({ type: "error", message: "Enter a valid 10-digit mobile number" });
      return;
    }
    if (!/^\d{6}$/.test(editingAddr.pincode!)) {
      toast.push({ type: "error", message: "Enter a valid 6-digit PIN code" });
      return;
    }
    // lat/lng are optional at save time — they are required only when proceeding
    // to delivery. If the user hasn't set coordinates, auto-capture the browser
    // location so the address saves delivery-ready and checkout never gets stuck.
    setSavingAddr(true);
    try {
      let lat = editingAddr.lat;
      let lng = editingAddr.lng;
      if (!lat || !lng) {
        const pos = await captureBrowserLocation();
        if (pos) {
          lat = +pos.coords.latitude.toFixed(6);
          lng = +pos.coords.longitude.toFixed(6);
          setEditingAddr((a) => ({ ...(a ?? {}), lat, lng }));
        }
      }
      const payload = {
        fullName: editingAddr.fullName,
        mobile: editingAddr.mobile,
        house: editingAddr.house,
        street: editingAddr.street,
        area: editingAddr.area,
        landmark: editingAddr.landmark || undefined,
        city: editingAddr.city,
        state: editingAddr.state,
        pincode: editingAddr.pincode,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        instructions: editingAddr.instructions || undefined,
      };
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.push({ type: "error", message: errData?.error ?? "Could not save address" });
        return;
      }
      const saved: Address = await res.json();
      setAddresses((prev) => [...prev, saved]);
      setSelectedAddress(saved.id);
      setEditingAddr(null);
      toast.push({
        type: "success",
        message: lat && lng
          ? "Address saved with your delivery location! ✅"
          : "Address saved! Add a delivery location to continue.",
      });
    } catch {
      toast.push({ type: "error", message: "Network error — could not save address" });
    } finally {
      setSavingAddr(false);
    }
  };

  const patchLocation = async (addressId: string) => {
    const lat = parseFloat(locationDraft.lat);
    const lng = parseFloat(locationDraft.lng);
    if (isNaN(lat) || isNaN(lng)) {
      toast.push({ type: "error", message: "Enter valid latitude and longitude" });
      return;
    }
    const res = await fetch(`/api/account/addresses/${addressId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    });
    if (!res.ok) {
      toast.push({ type: "error", message: "Could not update location" });
      return;
    }
    setAddresses((prev) =>
      prev.map((a) => (a.id === addressId ? { ...a, lat, lng } : a))
    );
    setPatchingLocation(null);
    setLocationDraft({ lat: "", lng: "" });
    toast.push({ type: "success", message: "Location saved! ✅" });
  };

  const captureLocationForPatch = (addressId: string) => {
    if (!navigator.geolocation) {
      toast.push({ type: "error", message: "Geolocation not supported. Enter coordinates manually." });
      setPatchingLocation(addressId);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = +pos.coords.latitude.toFixed(6);
        const lng = +pos.coords.longitude.toFixed(6);
        setLocationDraft({ lat: String(lat), lng: String(lng) });
        setPatchingLocation(addressId);
        toast.push({ type: "success", message: "Location captured — click Save Location" });
      },
      () => {
        setLocating(false);
        setPatchingLocation(addressId);
        toast.push({ type: "error", message: "Could not get location. Enter manually below." });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const placeOrder = async () => {
    if (!quote || !currentAddress) return;
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          addressId: currentAddress.id,
          paymentMethod: payment,
          couponCode: coupon || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not place order");
      setOrderId(data.orderId);
      setOrderNumber(data.orderNumber);
      clear();
      setStep(4);
    } catch (e) {
      toast.push({ type: "error", message: (e as Error).message });
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 text-center sm:text-left">
        <Image
          src="/logo.png"
          alt="Night Corner"
          width={240}
          height={63}
          loading="eager"
          className="mx-auto drop-shadow-neon sm:mx-0"
        />
        <h1 className="mt-3 font-display text-3xl font-extrabold text-white">Checkout</h1>
      </div>

      {open?.isOpen === false && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-warm-yellow/30 bg-warm-yellow/10 p-4 text-warm-yellow">
          <Moon className="h-5 w-5" />
          <div>
            <div className="font-bold">🌙 Night ordering is currently closed</div>
            <div className="text-sm">{open.nextWindowLabel}</div>
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                i === step
                  ? "bg-neon-purple text-white shadow-neon"
                  : i < step
                  ? "bg-emerald-500 text-white"
                  : "bg-white/5 text-slate-400"
              }`}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`hidden text-sm sm:inline ${i === step ? "text-white" : "text-slate-400"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="mx-1 h-px w-6 bg-white/10 sm:w-10" />}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {step === 0 && (
            <div className="space-y-3">
              {items.map((i) => (
                <div key={i.productId} className="card flex items-center gap-3 p-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-night-900/60">
                    <Image src={i.image} alt={i.name} fill className="object-contain p-1" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{i.name}</div>
                    <div className="text-xs text-slate-400">Qty {i.quantity} · {i.unit}</div>
                  </div>
                  <div className="font-bold text-white">{formatINR(i.unitPrice * i.quantity)}</div>
                </div>
              ))}
              <button onClick={() => setStep(1)} className="btn-primary w-full">
                Continue to Address
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-white">Delivery Address</h2>
                <button onClick={() => setEditingAddr({})} className="btn-ghost py-2 text-sm">
                  + Add new address
                </button>
              </div>
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className={`card block cursor-pointer p-4 transition ${
                    selectedAddress === a.id ? "ring-2 ring-neon-purple" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      checked={selectedAddress === a.id}
                      onChange={() => setSelectedAddress(a.id)}
                      className="mt-1 accent-purple-500"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white">
                        {a.fullName} <span className="text-sm font-normal text-slate-400">· {a.mobile}</span>
                      </div>
                      <p className="text-sm text-slate-300">
                        {[a.house, a.street, a.area, a.landmark].filter(Boolean).join(", ")}
                        <br />
                        {a.city} - {a.pincode}, {a.state}
                      </p>
                      {a.lat && a.lng ? (
                        <a
                          href={`https://www.google.com/maps?q=${a.lat},${a.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-neon-blue hover:underline"
                        >
                          <MapPin className="h-3 w-3" /> ✅ Location set
                        </a>
                      ) : (
                        <div className="mt-2">
                          <span className="text-xs text-amber-400">⚠️ No location — required for delivery</span>
                          {patchingLocation === a.id ? (
                            <div className="mt-2 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="label text-xs">Latitude</label>
                                  <input
                                    className="input text-sm"
                                    placeholder="e.g. 19.0760"
                                    value={locationDraft.lat}
                                    onChange={(e) => setLocationDraft((d) => ({ ...d, lat: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="label text-xs">Longitude</label>
                                  <input
                                    className="input text-sm"
                                    placeholder="e.g. 72.8777"
                                    value={locationDraft.lng}
                                    onChange={(e) => setLocationDraft((d) => ({ ...d, lng: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => patchLocation(a.id)}
                                  className="btn-primary py-1.5 text-xs flex-1"
                                >
                                  Save Location
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setPatchingLocation(null); setLocationDraft({ lat: "", lng: "" }); }}
                                  className="btn-ghost py-1.5 text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); captureLocationForPatch(a.id); }}
                              disabled={locating}
                              className="mt-1 flex items-center gap-1 text-xs text-neon-purple hover:underline disabled:opacity-50"
                            >
                              {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Locate className="h-3 w-3" />}
                              Add delivery location
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              ))}
              {editingAddr && (
                <div className="card p-5">
                  <h3 className="mb-3 font-bold text-white">New Address</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Full Name*"><input className="input" value={editingAddr.fullName ?? ""} onChange={(e) => setEditingAddr({ ...editingAddr, fullName: e.target.value })} /></Field>
                    <Field label="Mobile*"><input className="input" value={editingAddr.mobile ?? ""} onChange={(e) => setEditingAddr({ ...editingAddr, mobile: e.target.value })} placeholder="10-digit" /></Field>
                    <Field label="House / Flat No*"><input className="input" value={editingAddr.house ?? ""} onChange={(e) => setEditingAddr({ ...editingAddr, house: e.target.value })} /></Field>
                    <Field label="Street*"><input className="input" value={editingAddr.street ?? ""} onChange={(e) => setEditingAddr({ ...editingAddr, street: e.target.value })} /></Field>
                    <Field label="Area*"><input className="input" value={editingAddr.area ?? ""} onChange={(e) => setEditingAddr({ ...editingAddr, area: e.target.value })} /></Field>
                    <Field label="Landmark"><input className="input" value={editingAddr.landmark ?? ""} onChange={(e) => setEditingAddr({ ...editingAddr, landmark: e.target.value })} /></Field>
                    <Field label="City*"><input className="input" value={editingAddr.city ?? ""} onChange={(e) => setEditingAddr({ ...editingAddr, city: e.target.value })} /></Field>
                    <Field label="State*"><input className="input" value={editingAddr.state ?? ""} onChange={(e) => setEditingAddr({ ...editingAddr, state: e.target.value })} /></Field>
                    <Field label="PIN Code*"><input className="input" value={editingAddr.pincode ?? ""} onChange={(e) => setEditingAddr({ ...editingAddr, pincode: e.target.value })} /></Field>
                    <Field label="Delivery instructions"><input className="input" value={editingAddr.instructions ?? ""} onChange={(e) => setEditingAddr({ ...editingAddr, instructions: e.target.value })} /></Field>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={useGeolocation} className="btn-ghost py-2 text-sm" disabled={locating}>
                        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />} Use current location
                      </button>
                      {editingAddr.lat && editingAddr.lng ? (
                        <span className="text-xs text-emerald-300">
                          ✅ 📍 {editingAddr.lat}, {editingAddr.lng}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400">📍 Location not yet set (required for delivery)</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label text-xs">Latitude (manual)</label>
                        <input
                          className="input text-sm"
                          placeholder="e.g. 19.0760"
                          value={editingAddr.lat ?? ""}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            setEditingAddr({ ...editingAddr, lat: isNaN(v) ? undefined : v });
                          }}
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Longitude (manual)</label>
                        <input
                          className="input text-sm"
                          placeholder="e.g. 72.8777"
                          value={editingAddr.lng ?? ""}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            setEditingAddr({ ...editingAddr, lng: isNaN(v) ? undefined : v });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={saveAddress} disabled={savingAddr} className="btn-primary flex-1 flex items-center justify-center gap-2">
                      {savingAddr ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save Address"}
                    </button>
                    <button onClick={() => setEditingAddr(null)} className="btn-ghost">Cancel</button>
                  </div>
                </div>
              )}
              {selectedAddress && !addresses.find((x) => x.id === selectedAddress)?.lat && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                  ⚠️ Your selected address has no delivery location. Click <strong>"Add delivery location"</strong> on the address above before continuing.
                </p>
              )}
              <button
                onClick={() => {
                  if (!selectedAddress) {
                    toast.push({ type: "error", message: "Select a delivery address" });
                    return;
                  }
                  const a = addresses.find((x) => x.id === selectedAddress);
                  if (!a?.lat || !a?.lng) {
                    toast.push({ type: "error", message: "⚠️ Add a delivery location to this address first" });
                    return;
                  }
                  setStep(2);
                }}
                className="btn-primary w-full"
              >
                Continue to Delivery
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-white">Delivery Details</h2>
              <div className="card p-5">
                <div className="flex items-start gap-3">
                  <Truck className="mt-0.5 h-5 w-5 text-neon-blue" />
                  <div className="flex-1">
                    {quoting ? (
                      <div className="flex items-center gap-2 text-slate-300">
                        <Loader2 className="h-4 w-4 animate-spin" /> Calculating distance & delivery charge...
                      </div>
                    ) : quote ? (
                      <>
                        <div className="font-semibold text-white">
                          Distance: {quote.distanceKm.toFixed(1)} KM
                        </div>
                        <p className="text-sm text-slate-400">
                          Estimated delivery in about 30–40 minutes.
                        </p>
                        {!quote.minOrderMet && (
                          <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                            <ShieldAlert className="h-4 w-4" />
                            Minimum order is {formatINR(quote.minOrderAmount)}. Add {formatINR(quote.minOrderAmount - quote.subtotal)} more.
                          </div>
                        )}
                        {quote.freeDelivery && (
                          <div className="mt-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                            🎉 You unlocked FREE delivery!
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">Calculating...</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="card p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-neon-purple" />
                  <span className="font-semibold text-white">Coupon code</span>
                </div>
                <div className="flex gap-2">
                  <input
                    className="input uppercase"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                    placeholder="Try NIGHT10 or FREESHIP"
                  />
                  <button onClick={() => setStep(2)} className="btn-ghost">Apply</button>
                </div>
                {quote?.couponCode && (
                  <p className="mt-2 text-sm text-emerald-300">Coupon {quote.couponCode} applied.</p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-ghost">Back</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!quote || !quote.minOrderMet}
                  className="btn-primary flex-1"
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {step === 3 && quote && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-white">Payment Method</h2>
              <PayOption
                active={payment === "COD"}
                onClick={() => setPayment("COD")}
                disabled={!paymentConfig.cod}
                title="Cash on Delivery"
                desc="Pay in cash when your order arrives."
              />
              <PayOption
                active={payment === "UPI"}
                onClick={() => setPayment("UPI")}
                disabled={!paymentConfig.upi}
                title="UPI"
                desc={paymentConfig.upiId ? `Pay to ${paymentConfig.upiId}` : "Pay via any UPI app"}
              />
              <PayOption
                active={payment === "ONLINE"}
                onClick={() => setPayment("ONLINE")}
                disabled={!paymentConfig.online}
                title="Online Payment (Card / Netbanking / Wallet)"
                desc="Secure payment via our payment gateway."
              />
              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="btn-ghost">Back</button>
                <button onClick={placeOrder} disabled={placing || open?.isOpen === false} className="btn-primary flex-1">
                  {placing ? <Loader2 className="h-5 w-5 animate-spin" /> : `Place Order · ${formatINR(quote.total)}`}
                </button>
              </div>
              <p className="text-center text-xs text-slate-500">
                By placing this order you agree to our terms. Prices, stock and delivery charge are verified securely on our server.
              </p>
            </div>
          )}

          {step === 4 && orderId && (
            <div className="card p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12 }}
                className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-emerald-500/20 text-4xl"
              >
                🎉
              </motion.div>
              <h2 className="font-display text-3xl font-extrabold text-white">ORDER CONFIRMED!</h2>
              <p className="mt-2 text-slate-300">
                Your order number is{" "}
                <span className="font-bold text-neon-blue">{orderNumber}</span>
              </p>
              <p className="mt-1 text-sm text-slate-400">
                We&apos;ve sent the details to WhatsApp and your dashboard. Track its progress live.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <a href={`/account/orders/${orderId}`} className="btn-primary">Track Order</a>
                <a href={`/api/orders/${orderId}/invoice`} target="_blank" className="btn-ghost">Download Invoice</a>
              </div>
            </div>
          )}
        </div>

        {/* Summary column */}
        <aside className="card h-fit p-5 lg:sticky lg:top-28">
          <h2 className="mb-4 font-display text-lg font-bold text-white">Order Summary</h2>
          {quote ? (
            <>
              {quote.lines.map((l) => (
                <div key={l.name} className="flex justify-between border-b border-white/5 py-2 text-sm">
                  <span className="text-slate-300">{l.quantity} × {l.name}</span>
                  <span className="text-slate-200">{formatINR(l.lineTotal)}</span>
                </div>
              ))}
              <Row label="Subtotal" value={formatINR(quote.subtotal)} />
              <Row label="Discount" value={quote.discount ? "- " + formatINR(quote.discount) : formatINR(0)} green={quote.discount > 0} />
              <Row label="Delivery" value={quote.deliveryCharge === 0 ? "FREE" : formatINR(quote.deliveryCharge)} />
              <Row label={`Tax (${quote.taxPercent}%)`} value={formatINR(quote.tax)} />
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="font-bold text-white">Grand Total</span>
                <span className="text-xl font-extrabold text-warm-yellow">{formatINR(quote.total)}</span>
              </div>
            </>
          ) : (
            <>
              {items.map((i) => (
                <div key={i.productId} className="flex justify-between border-b border-white/5 py-2 text-sm">
                  <span className="text-slate-300">{i.quantity} × {i.name}</span>
                  <span className="text-slate-200">{formatINR(i.unitPrice * i.quantity)}</span>
                </div>
              ))}
              <Row label="Subtotal" value={formatINR(items.reduce((n, i) => n + i.unitPrice * i.quantity, 0))} />
              <p className="mt-2 text-xs text-slate-400">Delivery & tax after address selection.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-slate-300">{label}</span>
      <span className={`font-semibold ${green ? "text-emerald-400" : "text-white"}`}>{value}</span>
    </div>
  );
}

function PayOption({
  active,
  onClick,
  disabled,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition disabled:opacity-40 ${
        active ? "border-neon-purple bg-neon-purple/10" : "border-white/10 bg-white/[0.03] hover:bg-white/5"
      }`}
    >
      <CreditCard className={`h-5 w-5 ${active ? "text-neon-purple" : "text-slate-400"}`} />
      <div>
        <div className="font-semibold text-white">{title}</div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
    </button>
  );
}

// local motion import to keep the file self-contained
import { motion } from "framer-motion";
