import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const schema = z.object({
  fullName: z.string().min(2),
  mobile: z.string().regex(/^[0-9]{10}$/),
  house: z.string().min(1),
  street: z.string().min(1),
  area: z.string().min(1),
  landmark: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().regex(/^\d{6}$/),
  lat: z.number().optional(),
  lng: z.number().optional(),
  instructions: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: { isDefault: "desc" },
  });
  return NextResponse.json(addresses);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const count = await prisma.address.count({ where: { userId: session.user.id } });
  const address = await prisma.address.create({
    data: { ...parsed.data, userId: session.user.id, isDefault: count === 0 },
  });
  return NextResponse.json(address);
}
