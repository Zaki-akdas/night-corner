"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SectionHeading } from "./section-heading";

const FAQS = [
  {
    q: "What are Night Corner's delivery hours?",
    a: "We accept orders every night from 10:00 PM to 6:00 AM. Browsing is always available, but checkout opens exactly at 10 PM and closes at 6 AM.",
  },
  {
    q: "Where do you deliver?",
    a: "We deliver within a 10 KM road distance from our Night Corner shop. You'll see an instant distance check at checkout — if you're outside the radius, ordering is disabled with a clear message.",
  },
  {
    q: "How much does delivery cost?",
    a: "Delivery is distance-based: ₹20 for 0–2 KM, ₹30 for 2–5 KM, ₹40 for 5–7 KM and ₹50 for 7–10 KM. Orders above ₹499 get free delivery.",
  },
  {
    q: "How long does delivery take?",
    a: "Most orders arrive within 30–40 minutes. The exact estimate is shown at checkout based on your distance.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Cash on Delivery, UPI and online payments (where enabled). You can choose your preferred method at checkout.",
  },
  {
    q: "Can I track my order?",
    a: "Yes — every order has a live timeline: Placed → Confirmed → Preparing → Packed → Out for Delivery → Delivered. You'll get WhatsApp updates too.",
  },
  {
    q: "Do you serve fresh bakery items?",
    a: "Yes! Our bakery section is baked fresh every night with limited stock. Each item shows a freshness note and stock count.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <SectionHeading eyebrow="❓ FAQ" title="Frequently Asked Questions" />
      <div className="space-y-3">
        {FAQS.map((f, i) => (
          <div key={i} className="card overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
            >
              <span className="font-semibold text-white">{f.q}</span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-neon-purple transition-transform ${
                  open === i ? "rotate-180" : ""
                }`}
              />
            </button>
            {open === i && (
              <div className="px-5 pb-5 text-sm leading-relaxed text-slate-300">{f.a}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
