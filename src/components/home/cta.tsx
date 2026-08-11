import Link from "next/link";
import { MessageCircle, ShoppingBag } from "lucide-react";
import { waMeLink } from "@/lib/whatsapp";

export function CTA({ whatsappNumber }: { whatsappNumber: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <div className="card relative overflow-hidden p-10 text-center">
        <div className="absolute inset-0 bg-night-radial opacity-60" />
        <div className="relative">
          <div className="text-5xl">🌙</div>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-white sm:text-4xl">
            Craving something tonight?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-300">
            Browse 53+ midnight essentials and get them delivered within 10 KM.
            Ordering opens at 10 PM — set your alarm, night owl.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/shop" className="btn-primary">
              <ShoppingBag className="h-5 w-5" /> Start Shopping
            </Link>
            <a
              href={waMeLink(whatsappNumber, "Hi Night Corner! I have a question.")}
              target="_blank"
              rel="noreferrer"
              className="btn-whatsapp"
            >
              <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
