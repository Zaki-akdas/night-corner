import { ShoppingBag, ClipboardCheck, Truck } from "lucide-react";
import { SectionHeading } from "./section-heading";

const STEPS = [
  {
    n: "01",
    icon: <ShoppingBag className="h-7 w-7 text-neon-purple" />,
    title: "Choose Your Essentials",
    desc: "Browse our midnight collection — bakery, snacks, chocolates, noodles and drinks.",
  },
  {
    n: "02",
    icon: <ClipboardCheck className="h-7 w-7 text-neon-blue" />,
    title: "Place Your Order",
    desc: "Add to cart, confirm your address and pay via COD, UPI or online payment.",
  },
  {
    n: "03",
    icon: <Truck className="h-7 w-7 text-warm-yellow" />,
    title: "Get It Delivered",
    desc: "We deliver within 10 KM in about 35 minutes — straight to your door tonight.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <SectionHeading eyebrow="🚀 How It Works" title="Midnight Essentials in 3 Steps" />
      <div className="grid gap-5 md:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="card relative overflow-hidden p-6">
            <div className="absolute -right-4 -top-6 font-display text-7xl font-extrabold text-white/5">
              {s.n}
            </div>
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
              {s.icon}
            </div>
            <h3 className="text-lg font-bold text-white">{s.title}</h3>
            <p className="mt-1 text-sm text-slate-400">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
