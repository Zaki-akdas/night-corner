// Sweep the delivery-proofs bucket for orphaned test photos.
//
// Every delivery photo lives under `<orderId>/<timestamp>-<rand>.<ext>` and
// product images under `products/`. A top-level folder whose order no longer
// exists in the database is orphaned litter — most often uploaded by an e2e
// run that cleaned up its throwaway order but couldn't delete the photo (the
// anon key can't delete, and old runs predate the service-role cleanup).
//
// Runs daily from .github/workflows/sweep-delivery-proofs.yml. Safe by
// construction: folders matching a LIVE order are always kept (even when the
// order's deliveryPhotoUrl wasn't recorded), and products/ is never touched.
//
// Object paths come from storage.objects (SELECT is allowed; Supabase blocks
// direct DELETE on storage tables, so deletion goes through the Storage API).
//
// Usage:
//   E2E_TEST_DB_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/sweep-delivery-proofs.mjs [--dry-run]
// Exit code 0 = sweep completed (deleted count reported in logs).

import { PrismaClient } from "@prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");
const URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.E2E_TEST_DB_URL || process.env.DATABASE_URL;

if (!URL) throw new Error("SUPABASE_URL is required");
if (!KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required (anon can't delete)");
if (!DB_URL) throw new Error("E2E_TEST_DB_URL (or DATABASE_URL) is required to read live order IDs");

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

try {
  const [orders, objects] = await Promise.all([
    prisma.order.findMany({ select: { id: true } }),
    prisma.$queryRawUnsafe(
      `SELECT name FROM storage.objects WHERE bucket_id = 'delivery-proofs' ORDER BY name`
    ),
  ]);
  const orderIds = new Set(orders.map((o) => o.id));

  const orphans = [];
  for (const row of objects) {
    const top = String(row.name).split("/")[0];
    if (top === "products" || orderIds.has(top)) continue; // keep: admin images + live orders
    orphans.push(String(row.name));
  }

  console.log(
    `delivery-proofs: ${objects.length} objects, ${objects.length - orphans.length} kept ` +
      `(products + ${orderIds.size} live orders), ${orphans.length} orphaned${DRY_RUN ? " (dry-run)" : ""}`
  );

  if (orphans.length === 0) {
    console.log("bucket is clean — nothing to do");
    process.exit(0);
  }

  if (DRY_RUN) {
    for (const o of orphans) console.log("  would delete:", o);
    process.exit(0);
  }

  let deleted = 0;
  const failed = [];
  for (const name of orphans) {
    const res = await fetch(`${URL}/storage/v1/object/delivery-proofs/${name}`, {
      method: "DELETE",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok || res.status === 404) {
      deleted++;
      console.log("  deleted:", name);
    } else {
      failed.push(`${res.status} ${name}`);
    }
  }
  console.log(`sweep complete: deleted ${deleted} of ${orphans.length} orphans`);
  if (failed.length > 0) {
    throw new Error(`failed to delete ${failed.length} objects (first: ${failed.slice(0, 3).join(" | ")})`);
  }
} finally {
  await prisma.$disconnect().catch(() => {});
}
