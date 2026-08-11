import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json([]);
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId: session.user.id },
    include: { items: { include: { product: true } } },
  });
  return NextResponse.json(wishlist?.items.map((i) => i.product) ?? []);
}
