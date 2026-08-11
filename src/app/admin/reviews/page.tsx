import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { Star } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  await requireAdmin();
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    include: { product: true, user: true },
  });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold text-white">Reviews</h1>
      {reviews.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">No reviews yet.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {reviews.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white">{r.user.name}</div>
                <div className="flex gap-0.5">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-warm-yellow text-warm-yellow" />
                  ))}
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-300">{r.comment}</p>
              <p className="mt-2 text-xs text-slate-500">on {r.product.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
