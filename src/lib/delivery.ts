import type { AppSettings } from "./settings";

export type DistanceResult = {
  distanceKm: number;
  withinRange: boolean;
  deliveryCharge: number;
  freeDelivery: boolean;
  reason?: string;
};

/**
 * Great-circle distance (Haversine) between two lat/lng points, in km.
 * Road distance is typically longer; we apply a 1.3x "winding" factor
 * to approximate road routing (free, no external API required). When a
 * maps API key is configured, this can be swapped server-side for the
 * provider's distance-matrix call.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateRoadDistance(km: number): number {
  return +(km * 1.3).toFixed(2);
}

export function computeDelivery(
  settings: AppSettings,
  customerLat: number,
  customerLng: number,
  subtotal: number
): DistanceResult {
  const straight = haversineKm(
    settings.shopLat,
    settings.shopLng,
    customerLat,
    customerLng
  );
  const distanceKm = estimateRoadDistance(straight);

  if (distanceKm > settings.maxRadiusKm) {
    return {
      distanceKm,
      withinRange: false,
      deliveryCharge: 0,
      freeDelivery: false,
      reason: `Sorry! We currently deliver only within ${settings.maxRadiusKm} KM of Night Corner.`,
    };
  }

  const slab = settings.deliverySlabs
    .slice()
    .sort((a, b) => a.upToKm - b.upToKm)
    .find((s) => distanceKm <= s.upToKm);
  const deliveryCharge = slab?.charge ?? 0;

  const freeDelivery =
    settings.freeDeliveryEnabled && subtotal >= settings.freeDeliveryAbove;

  return {
    distanceKm,
    withinRange: true,
    deliveryCharge: freeDelivery ? 0 : deliveryCharge,
    freeDelivery,
  };
}

export function deliveryChargeForDistance(
  settings: AppSettings,
  distanceKm: number
): number {
  const slab = settings.deliverySlabs
    .slice()
    .sort((a, b) => a.upToKm - b.upToKm)
    .find((s) => distanceKm <= s.upToKm);
  return slab?.charge ?? 0;
}
