import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "./signup-form";
import { getPublicSettings } from "@/lib/settings";
import { TIERS, type Tier } from "@/lib/constants";

export const metadata = { title: "Become a Partner — Project Emerge" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const { tier } = await searchParams;
  const settings = await getPublicSettings();
  const initialTier =
    tier && TIERS.includes(tier as Tier) ? (tier as Tier) : undefined;

  return (
    <AuthShell
      title="Become a Partner"
      subtitle="Choose your partnership, then create your dashboard."
      footer={
        <>
          Already partnering?{" "}
          <Link href="/login" className="font-semibold text-white underline">
            Log in
          </Link>
        </>
      }
    >
      <SignUpForm
        initialTier={initialTier}
        oneTimeGraceDays={settings.one_time_grace_days}
        monthlyIntervalMonths={settings.monthly_interval_months}
      />
    </AuthShell>
  );
}
