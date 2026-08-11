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
  shopAddress:
    "Night Corner, Vijay Nagar, Indore, Madhya Pradesh 452010, India",
  shopLat: 22.7533,
  shopLng: 75.8937,
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
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919999999999",
  contactEmail: "hello@nightcorner.in",
  contactPhone: "+91 99999 99999",
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

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.settings.findUnique({ where: { key: KEY } });
  if (!row) {
    await prisma.settings.create({
      data: { key: KEY, value: JSON.stringify(DEFAULT_SETTINGS) },
    });
    return DEFAULT_SETTINGS;
  }
  return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<AppSettings>) };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await prisma.settings.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(next) },
    create: { key: KEY, value: JSON.stringify(next) },
  });
  return next;
}

export function formatINR(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
