/** Parsed delivery address captured in an order's addressSnapshot. */
export type DeliveryAddress = {
  fullName?: string;
  mobile?: string;
  house?: string;
  street?: string;
  area?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
};

/**
 * Parses the addressSnapshot JSON string stored on an order (a snapshot of the
 * Address row at order time, so it stays valid even if the address is edited).
 * Returns null when the snapshot is missing or unparseable.
 */
export function parseAddressSnapshot(snapshot: string | null): DeliveryAddress | null {
  if (!snapshot) return null;
  try {
    const parsed = JSON.parse(snapshot) as DeliveryAddress;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** One-line human-readable form of the address, or null if nothing usable. */
export function formatAddressLine(addr: DeliveryAddress | null): string | null {
  if (!addr) return null;
  const parts = [
    addr.house,
    addr.street,
    addr.area,
    addr.landmark,
    addr.city,
    addr.state,
    addr.pincode,
  ].filter((p): p is string => typeof p === "string" && p.trim() !== "");
  return parts.length > 0 ? parts.join(", ") : null;
}

/** True when the address carries usable coordinates for a map pin. */
export function hasCoordinates(addr: DeliveryAddress | null): boolean {
  return (
    !!addr &&
    typeof addr.lat === "number" &&
    typeof addr.lng === "number" &&
    Number.isFinite(addr.lat) &&
    Number.isFinite(addr.lng)
  );
}

/**
 * Google Maps embed URL (no API key required) that drops a pin at the delivery
 * location. Swap for a keyed Maps Embed/JS API later if needed.
 */
export function mapsEmbedUrl(lat: number, lng: number, zoom = 16): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=${zoom}&output=embed`;
}

/** "Open in Google Maps" link (directions to the delivery location). */
export function mapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}
