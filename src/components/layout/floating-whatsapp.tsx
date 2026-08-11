"use client";
import { MessageCircle } from "lucide-react";
import { waMeLink } from "@/lib/whatsapp";

export function FloatingWhatsApp({ whatsappNumber }: { whatsappNumber: string }) {
  const href = waMeLink(
    whatsappNumber,
    "Hi Night Corner! I need help with my midnight order."
  );
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 left-5 z-[90] flex items-center gap-2 rounded-full bg-[#25d366] px-4 py-3 font-semibold text-white shadow-2xl shadow-emerald-500/40 transition hover:scale-105"
    >
      <MessageCircle className="h-6 w-6" />
      <span className="hidden text-sm sm:inline">Chat with us</span>
      <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
      </span>
    </a>
  );
}
