import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { getSettings } from "@/lib/settings";
import { getOpenStatus } from "@/lib/hours";
import { computeOrderPricing } from "@/lib/pricing";
import { authOptions } from "@/lib/auth";

const schema = z.object({
  items: z
    .array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(50) }))
    .min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
  couponCode: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const settings = await getSettings();
  const status = getOpenStatus(settings);
  if (!status.isOpen) {
    return NextResponse.json(
      { error: "Ordering is currently closed. We open at 10 PM." },
      { status: 403 }
    );
  }

  try {
    const pricing = await computeOrderPricing(settings, parsed.data.items, {
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      couponCode: parsed.data.couponCode,
    });
    return NextResponse.json({
      ...pricing,
      minOrderMet: pricing.subtotal >= settings.minOrderAmount,
      minOrderAmount: settings.minOrderAmount,
      freeDeliveryAbove: settings.freeDeliveryAbove,
      taxPercent: settings.taxPercent,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
