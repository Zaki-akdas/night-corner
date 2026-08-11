import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function DeliverySettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold text-white">Delivery & Business Hours</h1>
      <SettingsForm initial={settings} />
    </div>
  );
}
