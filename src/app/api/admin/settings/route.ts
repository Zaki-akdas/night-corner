import { NextResponse } from "next/server";
import { requireAdmin, logActivity } from "@/lib/admin";
import { updateSettings, type AppSettings } from "@/lib/settings";

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  const body = (await req.json()) as Partial<AppSettings>;
  const next = await updateSettings(body);
  logActivity({
    userId: admin.id,
    userName: admin.name ?? "Admin",
    action: "SETTINGS_UPDATED",
    entity: "Settings",
    meta: { keys: Object.keys(body) },
  });
  return NextResponse.json(next);
}
