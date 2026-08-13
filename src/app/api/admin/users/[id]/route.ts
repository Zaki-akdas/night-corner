import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

const schema = z.object({ role: z.enum(["CUSTOMER", "ADMIN", "STAFF"]), status: z.enum(["ACTIVE", "DISABLED"]).optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const user = await prisma.user.update({ where: { id }, data: parsed.data });
  return NextResponse.json(user);
}
