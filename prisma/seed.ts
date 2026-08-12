import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORIES, PRODUCTS } from "./products";
import { DEFAULT_SETTINGS } from "../src/lib/settings";

const prisma = new PrismaClient();

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/—.*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function main() {
  console.log("🌙 Seeding Night Corner database...");

  // Settings
  await prisma.settings.upsert({
    where: { key: "app_settings" },
    update: { value: JSON.stringify(DEFAULT_SETTINGS) },
    create: { key: "app_settings", value: JSON.stringify(DEFAULT_SETTINGS) },
  });

  // Admin user
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@nightcorner.in").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", passwordHash, status: "ACTIVE" },
    create: {
      email: adminEmail,
      name: process.env.SEED_ADMIN_NAME || "Night Corner Admin",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: new Date(),
    },
  });

  // Demo delivery person (STAFF)
  await prisma.user.upsert({
    where: { email: "delivery@nightcorner.in" },
    update: {},
    create: {
      email: "delivery@nightcorner.in",
      name: "Delivery Staff",
      mobile: "9999922222",
      passwordHash: await bcrypt.hash("delivery123", 10),
      role: "STAFF",
      status: "ACTIVE",
      emailVerified: new Date(),
    },
  });

  // Demo customer
  const customerEmail = "rahul@example.com";
  await prisma.user.upsert({
    where: { email: customerEmail },
    update: {},
    create: {
      email: customerEmail,
      name: "Rahul Sharma",
      mobile: "9999911111",
      passwordHash: await bcrypt.hash("customer123", 10),
      role: "CUSTOMER",
      status: "ACTIVE",
      emailVerified: new Date(),
    },
  });

  // Categories
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        description: c.description,
        image: `/images/categories/${c.slug}.svg`,
        order: i,
        active: true,
      },
      create: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: `/images/categories/${c.slug}.svg`,
        order: i,
        active: true,
      },
    });
  }

  // Products
  let index = 0;
  for (const p of PRODUCTS) {
    index++;
    const cat = await prisma.category.findUnique({ where: { slug: p.categorySlug } });
    if (!cat) continue;
    const s = slug(p.name);
    const sku = `NC-${p.categorySlug.slice(0, 3).toUpperCase()}-${index
      .toString()
      .padStart(3, "0")}`;
    const data = {
      name: p.name,
      slug: s,
      description: p.description,
      shortDesc: p.shortDesc,
      categoryId: cat.id,
      price: p.price,
      mrp: p.mrp,
      stock: p.stock,
      startingStock: p.stock,
      sku,
      unit: p.unit,
      isVeg: p.isVeg,
      featured: p.featured ?? false,
      bestSeller: p.bestSeller ?? false,
      active: true,
      freshnessNote: p.freshnessNote,
      keywords: p.keywords,
      image: `/images/products/${s}/1.jpg`,
      thumbnail: `/images/products/${s}/1.jpg`,
      gallery: JSON.stringify([`/images/products/${s}/1.jpg`]),
    };
    await prisma.product.upsert({
      where: { slug: s },
      update: data,
      create: data,
    });
  }

  // Demo coupon
  await prisma.coupon.upsert({
    where: { code: "NIGHT10" },
    update: {},
    create: {
      code: "NIGHT10",
      type: "PERCENT",
      value: 10,
      minOrder: 199,
      maxDiscount: 100,
      active: true,
      perCustomerLimit: 5,
    },
  });
  await prisma.coupon.upsert({
    where: { code: "FREESHIP" },
    update: {},
    create: {
      code: "FREESHIP",
      type: "FIXED",
      value: 0,
      minOrder: 0,
      freeDelivery: true,
      active: true,
    },
  });

  console.log("✅ Seed complete.");
  console.log(`   Admin login: ${adminEmail} / ${adminPassword}`);
  console.log("   Customer:    rahul@example.com / customer123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
