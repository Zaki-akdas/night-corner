import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { CouponManager } from "./coupon-manager";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requireAdmin();
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold text-white">Coupons & Discounts</h1>
      <CouponManager coupons={coupons} />
    </div>
  );
}
