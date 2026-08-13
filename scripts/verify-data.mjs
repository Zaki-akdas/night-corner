import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Check if demo customer exists
const customer = await p.user.findFirst({ where: { email: 'rahul@example.com' } });
console.log('Demo customer:', customer ? `✅ Found: ${customer.name} (${customer.email}) role: ${customer.role}` : '❌ NOT FOUND');

const admin = await p.user.findFirst({ where: { email: 'admin@nightcorner.in' } });
console.log('Admin user:', admin ? `✅ Found: ${admin.name} (${admin.email}) role: ${admin.role}` : '❌ NOT FOUND');

// Check all products
const products = await p.product.findMany({ where: { active: true } });
console.log(`\n✅ ${products.length} active products available`);

// Check recent orders
const orders = await p.order.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
console.log(`\n📦 Recent orders (${orders.length}):`);
orders.forEach(o => console.log(`  ${o.orderNumber} - ${o.status} - ₹${o.total}`));

await p.$disconnect();
