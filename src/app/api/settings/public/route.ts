import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({
    codEnabled: s.codEnabled,
    upiEnabled: s.upiEnabled,
    onlineEnabled: s.onlineEnabled,
    upiId: s.upiId,
    businessName: s.businessName,
    slogan: s.slogan,
    whatsappNumber: s.whatsappNumber,
    maxRadiusKm: s.maxRadiusKm,
    freeDeliveryAbove: s.freeDeliveryAbove,
    taxPercent: s.taxPercent,
  });
}
