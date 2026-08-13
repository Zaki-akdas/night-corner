"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type Status = {
  isOpen: boolean;
  label: string;
};

/**
 * One-click Force Open / Force Close for the whole storefront, always visible
 * in the admin topbar. Also clears an emergency close when forcing open (the
 * two overrides can't both be on), and logs to the admin activity feed via the
 * settings API.
 */
export function ForceOpenToggle() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const refresh = () =>
    fetch("/api/open-status")
      .then((r) => r.json())
      .then((d) => setStatus({ isOpen: d.isOpen, label: d.label }))
      .catch(() => {});

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  const toggle = async () => {
    if (!status || busy) return;
    setBusy(true);
    // Force open → also clear emergency close so the override actually applies.
    const patch = status.isOpen
      ? { forceOpen: false }
      : { forceOpen: true, emergencyClosed: false };
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        await refresh();
        toast.push({
          type: "success",
          message: status.isOpen ? "Storefront forced closed" : "Storefront forced open",
        });
        router.refresh();
      } else {
        toast.push({ type: "error", message: "Could not update shop status" });
      }
    } catch {
      toast.push({ type: "error", message: "Network error — try again" });
    } finally {
      setBusy(false);
    }
  };

  const forcedOpen = status?.label === "Open (Override)";

  return (
    <button
      onClick={toggle}
      disabled={!status || busy}
      title={
        forcedOpen
          ? "The shop is forced open — click to close it now"
          : status?.isOpen
            ? "The shop is open on schedule — click to force-close it"
            : "The shop is closed — click to force-open it"
      }
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
        forcedOpen
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
          : status?.isOpen
            ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            : "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
      }`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : forcedOpen ? (
        <Power className="h-4 w-4" />
      ) : (
        <ShieldAlert className="h-4 w-4" />
      )}
      <span className="hidden md:inline">
        {busy ? "Updating…" : forcedOpen ? "Force Close" : "Force Open"}
      </span>
    </button>
  );
}
