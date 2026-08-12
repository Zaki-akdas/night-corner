/**
 * SMS sender. Uses Fast2SMS (simple Indian provider, REST + API key) when
 * FAST2SMS_API_KEY is set. Without credentials it returns ok:true so flows
 * still work in demo mode — mirroring the WhatsApp lib's behavior.
 * Server-side only: never call this from the client.
 */
export async function sendSmsMessage(
  phone: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    // Demo mode: no provider configured — pretend success.
    return { ok: true };
  }
  try {
    const res = await fetch(
      "https://www.fast2sms.com/dev/bulkV2?" +
        new URLSearchParams({
          authorization: apiKey,
          message,
          language: "english",
          route: "qtp",
          numbers: phone.replace(/[^\d]/g, ""),
        })
    );
    const data = (await res.json().catch(() => ({}))) as { return?: boolean; message?: string };
    if (!res.ok || data.return === false) {
      return { ok: false, error: data.message || `SMS failed (HTTP ${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
