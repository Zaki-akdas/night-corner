import { MessageSquare, MessageCircle } from "lucide-react";

/**
 * Server-only status for the external notification channels. Shows whether the
 * WhatsApp / SMS providers have real credentials configured (LIVE) or are in
 * demo mode (no credentials → flows succeed but no real messages go out).
 * Reads env vars server-side; never exposes the values themselves.
 */
export function NotifyChannelStatus() {
  const waLive = Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_BUSINESS_NUMBER_ID);
  const smsLive = Boolean(process.env.FAST2SMS_API_KEY);

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold text-white">Notification channels</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <ChannelBadge
          icon={<MessageCircle className="h-4 w-4 text-emerald-400" />}
          name="WhatsApp"
          live={waLive}
          hint="WHATSAPP_API_TOKEN + WHATSAPP_BUSINESS_NUMBER_ID"
        />
        <ChannelBadge
          icon={<MessageSquare className="h-4 w-4 text-neon-blue" />}
          name="SMS (Fast2SMS)"
          live={smsLive}
          hint="FAST2SMS_API_KEY"
        />
      </div>
      <p className="text-xs text-slate-400">
        {waLive && smsLive
          ? "All channels are live — real messages are being sent."
          : "Missing channels are in demo mode: every flow still works, but no real messages go out until the credentials above are set on Vercel (Project → Settings → Environment Variables) and redeployed."}
      </p>
    </section>
  );
}

function ChannelBadge({
  icon,
  name,
  live,
  hint,
}: {
  icon: React.ReactNode;
  name: string;
  live: boolean;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{name}</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              live ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-400" : "bg-amber-400"}`} aria-hidden />
            {live ? "Live" : "Demo"}
          </span>
        </div>
        <p className="mt-1 break-all text-[11px] text-slate-500">{hint}</p>
      </div>
    </div>
  );
}
