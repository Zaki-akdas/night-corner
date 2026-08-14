import { prisma } from "./prisma";

/** Central, admin-editable settings. Stored as JSON in the Settings table. */
export type AppSettings = {
  businessName: string;
  slogan: string;
  // Hours in 24h "HH:MM"; ordering window spans midnight (open -> close next day)
  openTime: string; // "22:00"
  closeTime: string; // "06:00"
  openDays: number[]; // 0=Sun .. 6=Sat ; default all
  forceOpen: boolean; // admin override
  emergencyClosed: boolean;
  holidays: string[]; // ISO date strings
  // Shop location
  shopAddress: string;
  shopLat: number;
  shopLng: number;
  // Delivery
  maxRadiusKm: number;
  minOrderAmount: number;
  freeDeliveryAbove: number;
  freeDeliveryEnabled: boolean;
  taxPercent: number;
  deliverySlabs: { upToKm: number; charge: number }[];
  deliveryTimeMins: number;
  serviceablePincodes: string[];
  // Contact / social
  whatsappNumber: string;
  contactEmail: string;
  contactPhone: string;
  socials: { instagram?: string; facebook?: string; twitter?: string };
  // Payments
  codEnabled: boolean;
  upiEnabled: boolean;
  onlineEnabled: boolean;
  upiId: string;
  // Notifications
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
  notifySms: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  businessName: "NIGHT CORNER",
  slogan: "Your Night. Your Essentials.",
  openTime: "22:00",
  closeTime: "06:00",
  openDays: [0, 1, 2, 3, 4, 5, 6],
  forceOpen: false,
  emergencyClosed: false,
  holidays: [],
  shopAddress: "Lucky Bakery, Mayur Vihar, Ashoka Garden, Bhopal, Madhya Pradesh, India",
  shopLat: 23.2635737,
  shopLng: 77.426705,
  maxRadiusKm: 10,
  minOrderAmount: 99,
  freeDeliveryAbove: 499,
  freeDeliveryEnabled: true,
  taxPercent: 5,
  deliverySlabs: [
    { upToKm: 2, charge: 20 },
    { upToKm: 5, charge: 30 },
    { upToKm: 7, charge: 40 },
    { upToKm: 10, charge: 50 },
  ],
  deliveryTimeMins: 35,
  serviceablePincodes: [],
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "918989418270",
  contactEmail: "nightcorner.shop@gmail.com",
  contactPhone: "+91 89894 18270",
  socials: { instagram: "nightcorner", facebook: "nightcorner" },
  codEnabled: true,
  upiEnabled: true,
  onlineEnabled: false,
  upiId: "nightcorner@upi",
  notifyEmail: false,
  notifyWhatsapp: true,
  notifySms: false,
};

const KEY = "app_settings";

// Settings are polled by the open-status endpoint from every open page every
// ~30s. On serverless that turns into a DB read per poll; during a traffic
// burst it visibly contributes to connection-pool pressure. Cache per
// instance for a short TTL (safe: each Vercel instance has its own memory)
// and bust on admin edits so force-open/close applies immediately.
const CACHE_TTL_MS = 10_000;
let cache: { at: number; value: AppSettings } | null = null;

export async function getSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.value;
  const row = await prisma.settings.findUnique({ where: { key: KEY } });
  let value: AppSettings;
  if (!row) {
    await prisma.settings.create({
      data: { key: KEY, value: JSON.stringify(DEFAULT_SETTINGS) },
    });
    value = DEFAULT_SETTINGS;
  } else {
    value = { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<AppSettings>) };
  }
  cache = { at: now, value };
  return value;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await prisma.settings.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(next) },
    create: { key: KEY, value: JSON.stringify(next) },
  });
  cache = { at: Date.now(), value: next };
  return next;
}

export function formatINR(n: number): string {
  // Round to paise so display never contradicts the stored amount: whole
  // rupees stay clean (₹135), fractional totals show both decimals (₹135.50)
  // instead of being silently rounded up to ₹136.
  const v = Math.round(n * 100) / 100;
  const frac = v % 1 !== 0;
  return (
    "₹" +
    v.toLocaleString("en-IN", {
      minimumFractionDigits: frac ? 2 : 0,
      maximumFractionDigits: frac ? 2 : 0,
    })
  );
}
