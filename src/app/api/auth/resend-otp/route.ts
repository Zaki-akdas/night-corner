import { NextResponse } from "next/server";
import { z } from "zod";
import { issueEmailOtp } from "@/lib/email-otp";

const schema = z.object({
  email: z.string().email(),
});

/** Resends the signup verification code. Cooldown is enforced inside
 * issueEmailOtp (one per minute, tracked on the stored row). */
export async function POST(req: Request) {
  const json = await req.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  const sent = await issueEmailOtp(parsed.data.email.toLowerCase());
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
  return NextResponse.json({ ok: true, devOtp: sent.devOtp });
}
