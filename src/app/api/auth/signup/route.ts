import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  mobile: z
    .string()
    .regex(/^[0-9]{10}$/, "Enter a valid 10-digit mobile number"),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { name, email, mobile, password } = parsed.data;
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { mobile }] },
  });
  if (exists) {
    return NextResponse.json(
      { error: "An account with this email or mobile already exists." },
      { status: 409 }
    );
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      mobile,
      passwordHash,
      role: "CUSTOMER",
      status: "ACTIVE",
    },
  });
  return NextResponse.json({ id: user.id });
}
