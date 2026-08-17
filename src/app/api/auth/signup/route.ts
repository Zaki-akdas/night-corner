import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueEmailOtp } from "@/lib/email-otp";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  mobile: z
    .string()
    .regex(/^[0-9]{10}$/, "Enter a valid 10-digit mobile number"),
  password: z.string().min(6),
});

/** Step 1 of signup: validate + check duplicates, then email a 6-digit OTP.
 * The account is NOT created yet — it's created by /api/auth/verify-otp
 * once the customer proves they own the email address. */
export async function POST(req: Request) {
  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { email } = parsed.data;
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { mobile: parsed.data.mobile }] },
  });
  if (exists) {
    return NextResponse.json(
      { error: "An account with this email or mobile already exists." },
      { status: 409 }
    );
  }

  const sent = await issueEmailOtp(email.toLowerCase());
  if (sent.cooldown) {
    return NextResponse.json(
      { error: "A verification code was just sent — wait a minute and try again." },
      { status: 429 }
    );
  }
  if (!sent.ok) {
    return NextResponse.json(
      { error: "Could not send the verification email — try again in a moment." },
      { status: 502 }
    );
  }

  // devOtp is present only in demo mode (no SMTP configured) so local/e2e
  // flows can complete without a real mailbox. Never returned when SMTP is on.
  return NextResponse.json({ pending: true, devOtp: sent.devOtp });
}
