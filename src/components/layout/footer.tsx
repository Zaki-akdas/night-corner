import Link from "next/link";
import Image from "next/image";
import { Instagram, Facebook, Twitter, MessageCircle, MapPin, Phone, Mail, Clock } from "lucide-react";
import type { AppSettings } from "@/lib/settings";
import { waMeLink } from "@/lib/whatsapp";
import { fmtTime } from "@/lib/hours";

export function Footer({ settings }: { settings: AppSettings }) {
  const wa = waMeLink(
    settings.whatsappNumber,
    "Hi Night Corner! I have a question."
  );
  return (
    <footer className="mt-20 border-t border-white/10 bg-night-950/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-4">
        <div>
          <div>
            <Image
              src="/logo.svg"
              alt="Night Corner"
              width={172}
              height={45}
              loading="eager"
              className="h-14 w-auto"
            />
          </div>
          <p className="mt-4 text-sm text-slate-400">{settings.slogan}</p>
          <div className="mt-4 flex gap-2">
            {settings.socials.instagram && (
              <Social href={settings.socials.instagram} icon={<Instagram className="h-4 w-4" />} />
            )}
            {settings.socials.facebook && (
              <Social href={settings.socials.facebook} icon={<Facebook className="h-4 w-4" />} />
            )}
            {settings.socials.twitter && (
              <Social href={settings.socials.twitter} icon={<Twitter className="h-4 w-4" />} />
            )}
            <Social href={wa} icon={<MessageCircle className="h-4 w-4" />} />
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-300">Quick Links</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/" className="hover:text-white">Home</Link></li>
            <li><Link href="/shop" className="hover:text-white">Shop</Link></li>
            <li><Link href="/categories" className="hover:text-white">Categories</Link></li>
            <li><Link href="/track-order" className="hover:text-white">Track Order</Link></li>
            <li><Link href="/account" className="hover:text-white">My Account</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-300">Customer Support</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>
              <a href={wa} target="_blank" rel="noreferrer" className="hover:text-emerald-400">
                WhatsApp Us
              </a>
            </li>
            <li><a href={`mailto:${settings.contactEmail}`} className="hover:text-white">{settings.contactEmail}</a></li>
            <li><Link href="/faq" className="hover:text-white">FAQs</Link></li>
            <li><Link href="/track-order" className="hover:text-white">Order Help</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-300">Store Info</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 text-neon-purple" />
              <span>Business Hours: {fmtTime(settings.openTime)} – {fmtTime(settings.closeTime)}</span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-neon-blue" />
              <span>Delivery within {settings.maxRadiusKm} KM<br />{settings.shopAddress}</span>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-warm-yellow" />
              <a href={`tel:${settings.contactPhone}`} className="hover:text-white">{settings.contactPhone}</a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-neon-pink" />
              <a href={`mailto:${settings.contactEmail}`} className="hover:text-white">{settings.contactEmail}</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} NIGHT CORNER · Your Night. Your Essentials. · Open 24×7 · All rights reserved.
        <span className="mt-1 block">Made by Zaki ✨</span>
      </div>
    </footer>
  );
}

function Social({ href, icon }: { href: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:border-neon-purple hover:text-white"
    >
      {icon}
    </a>
  );
}
