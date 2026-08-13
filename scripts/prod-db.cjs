// One-shot production DB helper: run a query with a fresh Prisma client each
// time (the Supabase pooler rejects repeated prepared statements on one conn).
const { PrismaClient } = require("@prisma/client");
const DB = process.env.DB_URL;

async function once(fn) {
  const p = new PrismaClient({ datasources: { db: { url: DB } } });
  try {
    return await fn(p);
  } finally {
    await p.$disconnect().catch(() => {});
  }
}

module.exports = { once, DB };
