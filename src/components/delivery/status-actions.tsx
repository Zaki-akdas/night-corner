"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, CheckCircle2, ChevronDown, ImagePlus, KeyRound, Loader2, Phone, X } from "lucide-react";

const PRE_DELIVERY = ["PLACED", "CONFIRMED", "PREPARING", "PACKED"];

/**
 * Delivery status buttons. Renders nothing when the order isn't actionable.
 * Marking an order Delivered requires proof of delivery: a photo upload and the
 * delivery PIN the customer gives at handover. The compact variant (dashboard
 * cards) keeps the proof-of-delivery form collapsed behind a toggle.
 */
export function DeliveryStatusActions({
  orderId,
  currentStatus,
  compact = false,
  customerMobile,
}: {
  orderId: string;
  currentStatus: string;
  compact?: boolean;
  customerMobile?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showPod, setShowPod] = useState(!compact);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [pin, setPin] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const canSendOut = PRE_DELIVERY.includes(currentStatus);
  const canDeliver = currentStatus === "OUT_FOR_DELIVERY";
  if (!canSendOut && !canDeliver) return null;

  const update = async (status: "OUT_FOR_DELIVERY" | "DELIVERED") => {
    setBusy(status);
    setError("");
    try {
      // Proof of delivery: upload the photo first, then deliver with the URL + PIN.
      let photoUrl = "";
      if (status === "DELIVERED") {
        if (!photo) {
          setError("Please attach a delivery photo");
          return;
        }
        if (!/^\d{4,6}$/.test(pin.trim())) {
          setError("Enter the delivery PIN from the customer");
          return;
        }
        const form = new FormData();
        form.append("file", photo);
        const upRes = await fetch(`/api/delivery/orders/${orderId}/photo`, {
          method: "POST",
          body: form,
        });
        if (!upRes.ok) {
          const j = await upRes.json().catch(() => ({}));
          setError(j.error || "Photo upload failed");
          return;
        }
        const upJson = await upRes.json();
        photoUrl = upJson.url;
      }

      const res = await fetch(`/api/delivery/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          status === "DELIVERED"
            ? { status, deliveryPhotoUrl: photoUrl, deliveryPin: pin.trim() }
            : { status }
        ),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Could not update status");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(null);
    }
  };

  const onPickPhoto = (f: File | null) => {
    setPhoto(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(String(reader.result));
      reader.readAsDataURL(f);
    } else {
      setPhotoPreview("");
    }
  };

  const btn = (base: string) =>
    `${base} inline-flex items-center justify-center gap-2 ${compact ? "px-3 py-1.5 text-xs" : "w-full text-sm"}`;

  return (
    <div className="space-y-2">
      {canSendOut && (
        <button
          onClick={() => update("OUT_FOR_DELIVERY")}
          disabled={!!busy}
          className={btn("btn")}
        >
          {busy === "OUT_FOR_DELIVERY" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bike className="h-4 w-4" />}
          {busy === "OUT_FOR_DELIVERY" ? "Updating…" : "Mark Out for Delivery"}
        </button>
      )}          {canDeliver && (
        <div className="space-y-2">
          <button
            onClick={() => setShowPod((s) => !s)}
            className={`${btn("btn")} ${showPod ? "ring-2 ring-emerald-500/50" : ""}`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark Delivered
            <ChevronDown className={`h-4 w-4 transition-transform ${showPod ? "rotate-180" : ""}`} />
          </button>

          {/* Telegraph the requirements even before the form expands. */}
          {!showPod && (
            <p className="text-xs text-slate-400">
              Requires a delivery photo + the customer&apos;s delivery PIN
            </p>
          )}

          {showPod && (
            <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-xs text-slate-300">
                Collect proof before confirming: a <span className="font-semibold text-white">delivery photo</span> and
                the customer&apos;s <span className="font-semibold text-white">delivery PIN</span>.
              </p>

              {/* Photo */}
              {photoPreview ? (
                <div className="relative overflow-hidden rounded-lg border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Delivery photo preview" className="max-h-40 w-full object-cover" />
                  <button
                    onClick={() => {
                      onPickPhoto(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="absolute right-2 top-2 rounded-full bg-night-950/80 p-1 text-white hover:bg-night-950"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-white/20 bg-night-950/40 px-3 py-4 text-xs text-slate-300 hover:border-emerald-400/40 hover:text-white"
                >
                  <ImagePlus className="h-5 w-5" />
                  Tap to attach a photo of the delivery
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="hidden"
                onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
              />

              {/* Unmissable PIN reminder — sits right above the PIN field so
                  delivery can't be confirmed without collecting it. */}
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/50 bg-amber-500/15 p-3 ring-2 ring-amber-400/30">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/20">
                  <KeyRound className="h-4 w-4 text-amber-300" />
                </span>
                <div className="text-xs">
                  <div className="font-bold uppercase tracking-wide text-amber-200">
                    Delivery PIN required to confirm
                  </div>
                  <p className="mt-0.5 text-amber-100/90">
                    Ask the customer for the 4-digit PIN sent to their phone. You must enter it here
                    to complete the delivery.
                  </p>
                  {customerMobile && (
                    <a
                      href={`tel:${customerMobile}`}
                      aria-label={`Call ${customerMobile} to ask for the delivery PIN`}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/90 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-500"
                    >
                      <Phone className="h-3 w-3" /> Call customer for PIN
                    </a>
                  )}
                </div>
              </div>

              {/* PIN */}
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  pattern="[0-9]{4,6}"
                  maxLength={6}
                  placeholder="Customer delivery PIN"
                  className="input py-2 pl-8 text-sm tracking-[0.3em]"
                />
              </div>

              <button
                onClick={() => update("DELIVERED")}
                disabled={!!busy}
                className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {busy === "DELIVERED" ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading & confirming…
                  </span>
                ) : (
                  "Confirm Delivery"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
