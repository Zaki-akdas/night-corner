"use client";
import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

/** Uploads an image to the admin product-photo endpoint and hands back the URL. */
export function ImageUpload({
  label,
  onUpload,
  className = "",
}: {
  label: string;
  onUpload: (url: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.push({ type: "error", message: "Photo must be under 8 MB" });
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/products/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.push({ type: "error", message: data.error || "Upload failed" });
        return;
      }
      onUpload(data.url as string);
      toast.push({ type: "success", message: "Photo uploaded" });
    } catch {
      toast.push({ type: "error", message: "Upload failed — try again" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={pick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="btn-ghost flex items-center gap-2 border-white/15 py-2 text-xs"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? "Uploading…" : label}
      </button>
    </div>
  );
}
