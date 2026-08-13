import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const rows = await p.settings.findMany();
console.log(JSON.stringify(rows, null, 2));
// Also check if store is within open hours
const settings = rows[0] ? JSON.parse(rows[0].value) : null;
if (settings) {
  const now = new Date();
  console.log('\n=== Current time (UTC) ===', now.toISOString());
  console.log('openTime:', settings.openTime);
  console.log('closeTime:', settings.closeTime);
  console.log('forceOpen:', settings.forceOpen);
  console.log('emergencyClosed:', settings.emergencyClosed);
}
const products = await p.product.findMany({ where: { active: true }, take: 5 });
console.log('\n=== Active products ===');
products.forEach(pr => console.log(pr.id, pr.name, 'stock:', pr.stock, 'price:', pr.price));
await p.$disconnect();
