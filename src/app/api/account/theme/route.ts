import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const VALID = new Set(["midnight", "gold", "emerald", "rose", "ocean"]);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ theme: null });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { theme: true },
  });
  return NextResponse.json({ theme: user?.theme ?? null });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const theme = body?.theme;
  if (typeof theme !== "string" || !VALID.has(theme)) {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme },
  });
  return NextResponse.json({ ok: true });
}
