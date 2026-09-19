import { requireProfile } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <div className="min-h-screen bg-emerge-paper">
      <AppNav
        name={profile.full_name}
        homeHref="/dashboard"
        links={[
          { href: "/dashboard", label: "My partnership" },
          { href: "/dashboard/settings", label: "Settings" },
          // An admin who partners too needs a way back to the admin area.
          ...(profile.role === "admin"
            ? [{ href: "/admin", label: "Admin area" }]
            : []),
        ]}
      />
      <main className="container py-8">{children}</main>
    </div>
  );
}
