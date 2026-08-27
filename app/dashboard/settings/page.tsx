import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  PartnerSettingsForm,
  ChangePasswordForm,
} from "./settings-form";
import { PLAN_LABELS, TIER_LABELS } from "@/lib/constants";
import { formatNaira } from "@/lib/format";
import type { Partnership } from "@/lib/supabase/types";

export const metadata = { title: "Settings — Project Emerge" };

export default async function PartnerSettingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("partnerships")
    .select("*")
    .eq("partner_id", profile.id)
    .maybeSingle();
  const partnership = data as Partnership | null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="display-title text-3xl text-emerge-ink">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <PartnerSettingsForm
            fullName={profile.full_name}
            phone={profile.phone}
            showOnHonorRoll={profile.show_on_honor_roll}
            honorRollName={profile.honor_roll_name}
            emailOptOut={profile.email_opt_out ?? false}
            smsOptOut={profile.sms_opt_out ?? false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your partnership</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Email" value={profile.email} />
          {partnership && (
            <>
              <Row
                label="Amount"
                value={formatNaira(Number(partnership.amount))}
                mono
              />
              <Row label="Tier" value={TIER_LABELS[partnership.tier]} />
              <Row label="Plan" value={PLAN_LABELS[partnership.plan]} />
            </>
          )}
          <p className="pt-2 text-xs text-muted-foreground">
            Your email and partnership amount and plan cannot be changed here.
            To change your partnership, please contact the church.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-emerge-line py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono font-semibold" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}
