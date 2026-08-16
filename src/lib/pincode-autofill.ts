export type PincodeLookup = {
  pincode: string;
  city: string;
  district: string;
  state: string;
  areas: string[];
};

/**
 * Look up an Indian pincode through /api/pincode/[code]. Returns null when the
 * code isn't a valid 6-digit pincode, the lookup fails, or the API has no data.
 * Used by the checkout and address forms to autofill city/state/area.
 */
export async function lookupPincode(code: string): Promise<PincodeLookup | null> {
  if (!/^\d{6}$/.test(code)) return null;
  try {
    const res = await fetch(`/api/pincode/${code}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.city || !data?.state) return null;
    return data as PincodeLookup;
  } catch {
    return null;
  }
}
