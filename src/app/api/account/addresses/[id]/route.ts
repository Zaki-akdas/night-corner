import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// Only these fields may be updated by the owner — never id/userId/orders.
const schema = z
  .object({
    fullName: z.string().min(2).optional(),
    mobile: z.string().regex(/^[0-9]{10}$/).optional(),
    house: z.string().min(1).optional(),
    street: z.string().min(1).optional(),
    area: z.string().min(1).optional(),
    landmark: z.string().optional(),
    city: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    pincode: z.string().regex(/^\d{6}$/).optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    instructions: z.string().optional(),
    isDefault: z.boolean().optional(),
  })
  .strict(); // reject unknown keys (e.g. userId) outright

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.address.deleteMany({
    where: { id, userId: session.user.id },
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid address update" }, { status: 400 });
  }
  const data = parsed.data;
  // Verify ownership first
  const existing = await prisma.address.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Address not found" }, { status: 404 });
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { userId: session.user.id, isDefault: true },
      data: { isDefault: false },
    });
  }
  const address = await prisma.address.update({
    where: { id },
    data,
  });
  return NextResponse.json(address);
}
