import { NextResponse } from "next/server";
import pincodeData from "@/lib/pincode-data.json";

export const dynamic = "force-dynamic";

type Entry = { s: string; d: string; a: string[] };
const DATA = pincodeData as Record<string, Entry>;

// "MADHYA PRADESH" -> "Madhya Pradesh", "R.S.MARKET" -> "R.S.Market"
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s.])([a-z])/g, (_m, pre: string, c: string) => pre + c.toUpperCase());
}

/**
 * GET /api/pincode/462016
 * Looks up an Indian pincode in the bundled dataset and returns the city
 * (district), state and the post-office areas it covers, so the address
 * forms can autofill city/state/area from just the pincode.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Invalid pincode" }, { status: 400 });
  }

  const entry = DATA[code];
  if (!entry || !entry.s || !entry.d) {
    return NextResponse.json({ error: "Pincode not found" }, { status: 404 });
  }

  return NextResponse.json({
    pincode: code,
    city: titleCase(entry.d),
    district: titleCase(entry.d),
    state: titleCase(entry.s),
    areas: entry.a.map(titleCase).sort(),
  });
}
