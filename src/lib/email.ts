import nodemailer from "nodemailer";

/**
 * Email sender. Uses SMTP when SMTP_HOST is set (nodemailer transport with
 * optional auth). Without credentials it returns ok:true so flows still work
 * in demo mode — mirroring the WhatsApp/SMS libs' behavior.
 *
 * Env vars (server-side only):
 *   SMTP_HOST     — e.g. smtp.gmail.com or smtp.zoho.com (required to send)
 *   SMTP_PORT     — default 587
 *   SMTP_SECURE   — "true" for SSL/465, otherwise STARTTLS on the port
 *   SMTP_USER     — auth username (optional for open relays)
 *   SMTP_PASS     — auth password / app password
 *   EMAIL_FROM    — "Name <address>" shown as the sender (defaults to SMTP_USER)
 */
export async function sendEmailMessage(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    // Demo mode: no provider configured — pretend success.
    return { ok: true };
  }
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
    });
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || "no-reply@nightcorner.in",
      to,
      subject,
      html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
