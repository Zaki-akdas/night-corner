import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin";
import { messengerDeepLink } from "@/lib/messenger";

/**
 * Returns the logged-in customer's Messenger deep link (m.me/<page>?ref=<userId>).
 * Opening it starts a chat with the Page; the messenger webhook reads the ref
 * and links the resulting PSID to this account, after which delivery
 * notifications can be sent over Messenger.
 */
export async function GET() {
  const user = await requireUser();
  return NextResponse.json({ url: messengerDeepLink(user.id) });
}
