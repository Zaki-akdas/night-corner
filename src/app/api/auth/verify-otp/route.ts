import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyEmailOtp } from "@/lib/email-otp";

const schema = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(8),
  name: z.string().min(2),
  mobile: z.string().regex(/^[0-9]{10}$/, "Enter a valid 10-digit mobile number"),
  password: z.string().min(6),
});

/** Step 2 of signup: proves ownership of the email via the emailed OTP, then
 * creates the account with emailVerified set. The OTP is single-use. */
export async function POST(req: Request) {
  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { email, otp, name, mobile, password } = parsed.data;
  const normalized = email.toLowerCase();

  const check = await verifyEmailOtp(normalized, otp);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  // Re-check uniqueness — the email could have been taken between the OTP
  // request and now (or the OTP row pre-dates a manual account creation).
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: normalized }, { mobile }] },
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
      email: normalized,
      mobile,
      passwordHash,
      role: "CUSTOMER",
      status: "ACTIVE",
      emailVerified: new Date(),
    },
  });
  return NextResponse.json({ id: user.id });
}
