"use client";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/**
 * "Resend PIN" — re-delivers the order's proof-of-delivery PIN to the
 * customer's phone (WhatsApp/SMS per the store toggles) via
 * POST /api/orders/[id]/resend-pin. The route rate-limits resends, so a 429
 * surfaces the server's message instead of silently failing.
 */
export function ResendPinButton({ orderId }: { orderId: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/resend-pin`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.push({ type: "error", message: data.error || "Could not resend the PIN" });
        return;
      }
      toast.push({ type: "success", message: "Delivery PIN sent to your phone 📲" });
    } catch {
      toast.push({ type: "error", message: "Network error — try again" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={resend}
      disabled={busy}
      className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
      {busy ? "Sending…" : "Resend PIN"}
    </button>
  );
}
