import { requireAdmin } from "@/lib/auth";
import { getFullSettings } from "@/lib/settings";
import { getAllUsers } from "@/lib/admin-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AdminSettingsForm } from "./settings-form";
import { UsersManager } from "./users-manager";

export const metadata = { title: "Settings — Project Emerge" };

export default async function AdminSettingsPage() {
  const me = await requireAdmin();
  const settings = await getFullSettings();
  const users = await getAllUsers();

  return (
    <div className="space-y-6">
      <h1 className="display-title text-3xl text-emerge-ink">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Campaign & bank details</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminSettingsForm settings={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Promote a trusted user to admin, or set an admin back to partner.
            The last remaining admin cannot be demoted.
          </p>
          <UsersManager users={users} currentUserId={me.id} />
        </CardContent>
      </Card>
    </div>
  );
}
