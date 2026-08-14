"use client";
import { Search } from "lucide-react";

/** Filters the admin users table in place by name / email / mobile. */
export function UserSearch({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        className="input pl-9"
        placeholder={placeholder}
        onChange={(e) => {
          const q = e.target.value.trim().toLowerCase();
          document.querySelectorAll<HTMLTableRowElement>("[data-user-row]").forEach((row) => {
            const hay = row.getAttribute("data-search") ?? "";
            row.style.display = !q || hay.includes(q) ? "" : "none";
          });
        }}
      />
    </div>
  );
}
