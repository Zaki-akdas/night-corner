import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { GeneralSettingsForm } from "./general-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold text-white">General Settings</h1>
      <GeneralSettingsForm initial={settings} />
    </div>
  );
}
