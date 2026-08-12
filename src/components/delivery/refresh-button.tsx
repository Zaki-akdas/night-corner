"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.refresh()}
      className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
    >
      <RefreshCw className="h-3.5 w-3.5" /> Refresh
    </button>
  );
}
