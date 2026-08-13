"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Refreshes data in place — no full page reload.
 *
 * - Default (no `onRefresh`): calls `router.refresh()`, which re-renders the
 *   current server component and refetches its data.
 * - With `onRefresh`: calls your own refetch (client-side pages that fetch
 *   into state), e.g. wishlist/addresses.
 */
export function RefreshButton({
  onRefresh,
  className = "",
  label = "Refresh",
}: {
  onRefresh?: () => void;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  const refresh = () => {
    setSpinning(true);
    if (onRefresh) onRefresh();
    else router.refresh();
    // Keep the spin visible briefly even if the refetch resolves instantly.
    window.setTimeout(() => setSpinning(false), 700);
  };

  return (
    <button
      onClick={refresh}
      aria-label={label}
      title="Refresh data"
      className={`btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs ${className}`}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}
