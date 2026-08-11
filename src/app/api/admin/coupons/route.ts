import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logActivity } from "@/lib/admin";

const schema = z.object({
  code: z.string().min(2),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().min(0),
  minOrder: z.number().min(0).default(0),
  maxDiscount: z.number().nullable().optional(),
  freeDelivery: z.boolean().default(false),
  usageLimit: z.number().int().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const data = parsed.data;
  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        type: data.type,
        value: data.value,
        minOrder: data.minOrder,
        maxDiscount: data.maxDiscount,
        freeDelivery: data.freeDelivery,
        usageLimit: data.usageLimit,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
    logActivity({ userId: admin.id, userName: admin.name ?? "Admin", action: "COUPON_CREATED", entity: "Coupon", entityId: coupon.id });
    return NextResponse.json(coupon);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create coupon" }, { status: 400 });
  }
}
