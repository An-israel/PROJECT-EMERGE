import { requireAdmin } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();

  return (
    <div className="min-h-screen bg-emerge-paper">
      <AppNav
        name={profile.full_name}
        homeHref="/admin"
        links={[
          { href: "/admin", label: "Control room" },
          { href: "/admin/receipts", label: "Receipts" },
          { href: "/admin/partners", label: "Partners" },
          { href: "/admin/honor-roll", label: "Honor roll" },
          { href: "/admin/settings", label: "Settings" },
        ]}
      />
      <main className="container py-8">{children}</main>
    </div>
  );
}
