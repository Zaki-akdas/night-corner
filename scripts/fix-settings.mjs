import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Fix critical settings for testing:
// 1. Enable COD (was disabled)
// 2. Enable forceOpen so ordering works at all hours during testing
// 3. Set shopLat/shopLng to Mumbai so demo coords (19.07, 72.87) work within 10km radius
const rows = await p.settings.findMany();
const current = rows[0] ? JSON.parse(rows[0].value) : {};

const updated = {
  ...current,
  codEnabled: true,       // was false — blocked payment step
  forceOpen: true,        // ensure ordering works during testing
  shopLat: 19.0760,       // Mumbai (matches demo test coords)
  shopLng: 72.8777,       // Mumbai
  maxRadiusKm: 20,        // increase radius for testing flexibility
};

await p.settings.update({
  where: { key: 'app_settings' },
  data: { value: JSON.stringify(updated) },
});

console.log('✅ Settings updated:');
console.log('  codEnabled:', updated.codEnabled);
console.log('  forceOpen:', updated.forceOpen);
console.log('  shopLat:', updated.shopLat);
console.log('  shopLng:', updated.shopLng);
console.log('  maxRadiusKm:', updated.maxRadiusKm);

await p.$disconnect();
