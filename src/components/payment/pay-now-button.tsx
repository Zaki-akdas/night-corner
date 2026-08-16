"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, Smartphone } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { upiPayLink } from "@/lib/upi";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

type RazorpayOptions = {
  key: string;
  amount: number; // paise
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (payload: { razorpay_payment_id: string; razorpay_signature: string }) => void;
  prefill?: { contact?: string; email?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
};

let checkoutScriptPromise: Promise<void> | null = null;
function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined" || window.Razorpay) return Promise.resolve();
  if (!checkoutScriptPromise) {
    checkoutScriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        checkoutScriptPromise = null;
        reject(new Error("Could not load the payment SDK — try again"));
      };
      document.head.appendChild(s);
    });
  }
  return checkoutScriptPromise;
}

const GATEWAY_KEY =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_KEY : "";

/**
 * The "pay now" button for UPI / split orders:
 *  - Gateway configured → opens the Razorpay checkout for the exact amount,
 *    verifies the returned signature, and refreshes the page on success.
 *  - Otherwise → falls back to the upi:// deep link (manual UPI flow).
 */
export function PayNowButton({
  orderId,
  orderNumber,
  amount,
  balance,
  upiId,
  note,
  onVerified,
}: {
  orderId: string;
  orderNumber: string;
  amount: number;
  balance?: number;
  upiId?: string;
  note: string;
  onVerified?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  // Manual fallback: no gateway configured → open the customer's UPI app.
  if (!GATEWAY_KEY) {
    return (
      <a
        href={upiId ? upiPayLink(upiId, amount, note) : "#"}
        aria-label={`Pay ${amount} via UPI app`}
        className="btn-primary mt-3 inline-flex w-full items-center justify-center gap-2"
      >
        <Smartphone className="h-4 w-4" /> Pay now with UPI app
      </a>
    );
  }

  const pay = async () => {
    setBusy(true);
    try {
      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error("Payment SDK unavailable");

      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start payment");

      const rz = new window.Razorpay({
        key: data.key,
        amount: Math.round(data.amount * 100),
        currency: data.currency,
        name: "Night Corner",
        description: balance ? `${orderNumber} · advance ${data.amount} (balance ${balance} COD)` : `${orderNumber} · ${data.amount}`,
        order_id: data.razorpayOrderId,
        handler: async (payload) => {
          try {
            const vres = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                razorpayPaymentId: payload.razorpay_payment_id,
                razorpaySignature: payload.razorpay_signature,
              }),
            });
            const vdata = await vres.json().catch(() => ({}));
            if (!vres.ok) {
              toast.push({ type: "error", message: vdata.error || "Payment could not be verified" });
              return;
            }
            toast.push({ type: "success", message: balance ? "Advance received ✓ Balance due on delivery" : "Payment received ✓" });
            onVerified?.();
            router.refresh();
          } catch {
            toast.push({ type: "error", message: "Payment verification failed — our webhook will still confirm it" });
          }
        },
        modal: { ondismiss: () => setBusy(false) },
        theme: { color: "#7c3aed" },
      });
      rz.open();
    } catch (e) {
      toast.push({ type: "error", message: (e as Error).message });
      setBusy(false);
    }
  };

  return (
    <button
      onClick={pay}
      disabled={busy}
      className="btn-primary mt-3 inline-flex w-full items-center justify-center gap-2 disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <BadgeCheck className="h-4 w-4" />
      )}
      {busy ? "Opening payment…" : "Pay now — UPI / card"}
    </button>
  );
}
