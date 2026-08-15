import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { getOpenStatus } from "@/lib/hours";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  const status = getOpenStatus(settings);
  return NextResponse.json({
    isOpen: status.isOpen,
    label: status.label,
    nextWindowLabel: status.nextWindowLabel,
    opensAt: status.opensAt.toISOString(),
    closesAt: status.closesAt.toISOString(),
    secondsUntilChange: status.secondsUntilChange,
    openTime: settings.openTime,
    closeTime: settings.closeTime,
    // Vercel injects the deployment's git commit SHA at build/runtime. The
    // preview e2e's URL-resolve step compares it against the PR head so a
    // stale alias/comment can never route the suite to an older build.
    sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
  });
}
