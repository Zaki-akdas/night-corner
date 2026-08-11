import { Star } from "lucide-react";
import { SectionHeading } from "./section-heading";

const REVIEWS = [
  {
    name: "Ananya Verma",
    role: "Student · Vijay Nagar",
    rating: 5,
    text: "Maggi at 2 AM delivered in 25 minutes. Absolute lifesaver during exams. The app feels super premium too!",
  },
  {
    name: "Rohan Mehta",
    role: "Software Engineer · Palasia",
    rating: 5,
    text: "Ordered brownies and cold drinks for a late-night coding session. Everything arrived fresh and cold. Night Corner is now my go-to.",
  },
  {
    name: "Sneha Patil",
    role: "Designer · Saket Nagar",
    rating: 4,
    text: "Loved the neon dark theme! Easy checkout, accurate delivery time, and the 10 KM radius check worked perfectly.",
  },
];

export function Reviews() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <SectionHeading
        eyebrow="⭐ Customer Reviews"
        title="What Night Owls Are Saying"
      />
      <div className="grid gap-5 md:grid-cols-3">
        {REVIEWS.map((r) => (
          <div key={r.name} className="card p-6">
            <div className="mb-3 flex gap-0.5">
              {Array.from({ length: r.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-warm-yellow text-warm-yellow" />
              ))}
            </div>
            <p className="text-slate-200">&ldquo;{r.text}&rdquo;</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-neon-purple to-neon-blue font-bold text-white">
                {r.name[0]}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{r.name}</div>
                <div className="text-xs text-slate-400">{r.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
