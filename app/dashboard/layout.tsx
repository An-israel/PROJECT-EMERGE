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
        ]}
      />
      <main className="container py-8">{children}</main>
    </div>
  );
}
