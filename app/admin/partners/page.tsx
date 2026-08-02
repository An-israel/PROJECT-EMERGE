import { getAdminOverview } from "@/lib/admin-data";
import { PartnersTable, type PartnerTableRow } from "./partners-table";

export const metadata = { title: "Partners — Project Emerge" };

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const { partners } = await getAdminOverview();

  const rows: PartnerTableRow[] = partners.map((p) => ({
    id: p.profile.id,
    name: p.profile.full_name,
    phone: p.profile.phone,
    tier: p.partnership.tier,
    plan: p.partnership.plan,
    pledged: Number(p.partnership.amount),
    verified: p.verifiedTotal,
    progressPct: p.progressPct,
    status: p.status,
  }));

  return (
    <div className="space-y-6">
      <h1 className="display-title text-3xl text-emerge-ink">Partners</h1>
      <PartnersTable rows={rows} initialStatus={status} />
    </div>
  );
}
