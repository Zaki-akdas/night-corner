import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logActivity, notifyAdmin } from "@/lib/admin";

const schema = z.object({
  delta: z.number().int(),
  reason: z.string().default("ADJUSTMENT"),
  note: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const { delta, reason, note } = parsed.data;

  const product = await prisma.product.update({
    where: { id: params.id },
    data: { stock: { increment: delta } },
  });
  await prisma.inventoryTx.create({
    data: {
      productId: product.id,
      change: delta,
      reason,
      note,
      userId: admin.id,
    },
  });

  if (product.stock <= product.lowStockAt) {
    notifyAdmin(
      "STOCK",
      product.stock === 0 ? "🔴 Out of stock" : "⚠️ Low stock",
      `${product.name} has ${product.stock} left`
    ).catch(() => {});
  }

  logActivity({
    userId: admin.id,
    userName: admin.name ?? "Admin",
    action: "STOCK_CHANGED",
    entity: "Product",
    entityId: product.id,
    meta: { delta, newStock: product.stock },
  });

  return NextResponse.json({ stock: product.stock });
}
