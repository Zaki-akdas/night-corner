import { prisma } from "./prisma";
import { sendEmailMessage, emailConfigured } from "./email";

/** 6-digit numeric OTP. */
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const OTP_TTL_MS = 10 * 60_000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000; // 1 minute

/** Inline-styled OTP email body. */
function otpEmailHtml(email: string, otp: string): string {
  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">`,
    `  <div style="background:#0f172a;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">`,
    `    <h1 style="margin:0;font-size:20px">Verify your email</h1>`,
    `  </div>`,
    `  <div style="border:1px solid #e2e8f0;border-top:0;padding:22px;border-radius:0 0 10px 10px">`,
    `    <p style="margin:0 0 14px">Hi there,</p>`,
    `    <p style="margin:0 0 14px">Use the code below to verify <b>${email}</b> and finish creating your Night Corner account:</p>`,
    `    <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:18px;text-align:center;margin:0 0 14px">`,
    `      <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#0f172a">${otp}</span>`,
    `    </div>`,
    `    <p style="margin:0 0 14px;color:#64748b;font-size:13px">The code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>`,
    `    <p style="margin:0;color:#94a3b8;font-size:12px">— Night Corner 🌙</p>`,
    `  </div>`,
    `</div>`,
  ].join("\n");
}

/**
 * Stores a fresh OTP for the email (expires in 10 min) and sends it.
 * Returns { ok, devOtp?, error? } — devOtp is returned ONLY in demo mode
 * (no SMTP configured) so local/e2e flows can complete without a real
 * mailbox; with SMTP configured the code goes out by email and devOtp is
 * omitted. Never throws.
 */
export async function issueEmailOtp(
  email: string
): Promise<{ ok: boolean; devOtp?: string; error?: string; cooldown?: boolean }> {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Cooldown: reuse the stored row's updatedAt as the last-send timestamp.
  const existing = await prisma.emailOtp.findUnique({ where: { email } }).catch(() => null);
  if (existing && Date.now() - existing.updatedAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, cooldown: true };
  }

  await prisma.emailOtp.upsert({
    where: { email },
    update: { otp, expiresAt, attempts: 0 },
    create: { email, otp, expiresAt },
  }).catch(() => null);

  const demo = !emailConfigured();
  const html = otpEmailHtml(email, otp);
  const sent = await sendEmailMessage(email, "Your Night Corner verification code", html);
  return { ok: sent.ok, devOtp: demo ? otp : undefined, error: sent.error };
}

/**
 * Verifies the OTP for the email. Returns { ok, error? } — on success the
 * OTP row is deleted (single-use). Bounded attempts per code.
 */
export async function verifyEmailOtp(
  email: string,
  otp: string
): Promise<{ ok: boolean; error?: string }> {
  const row = await prisma.emailOtp.findUnique({ where: { email } }).catch(() => null);
  if (!row) return { ok: false, error: "No verification code found for this email — request a new one." };
  if (Date.now() > row.expiresAt.getTime()) {
    await prisma.emailOtp.delete({ where: { email } }).catch(() => {});
    return { ok: false, error: "This code has expired — request a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await prisma.emailOtp.delete({ where: { email } }).catch(() => {});
    return { ok: false, error: "Too many incorrect attempts — request a new code." };
  }
  if (row.otp !== otp.trim()) {
    await prisma.emailOtp
      .update({ where: { email }, data: { attempts: { increment: 1 } } })
      .catch(() => {});
    return { ok: false, error: "Incorrect code — please check and try again." };
  }

  // Correct code: single-use — remove it so it can't be replayed.
  await prisma.emailOtp.delete({ where: { email } }).catch(() => {});
  return { ok: true };
}
