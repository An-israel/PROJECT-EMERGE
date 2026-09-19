import { requireProfile } from "@/lib/auth";
import { getPublicSettings } from "@/lib/settings";
import { getPartnerDashboard } from "@/lib/partner-data";
import { BankCard } from "@/components/bank-card";
import { RisingColumn } from "@/components/rising-column";
import { StatusChip } from "@/components/status-chip";
import { ScheduleTable } from "@/components/schedule-table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UploadReceiptDialog } from "./upload-receipt-dialog";
import { PledgeForm } from "./pledge-form";
import { ReceiptHistory } from "./receipt-history";
import { formatNaira, formatDate } from "@/lib/format";

export const metadata = { title: "My partnership — Project Emerge" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const settings = await getPublicSettings();
  const { partnership, installments, receipts, progress, rowStates } =
    await getPartnerDashboard(profile.id, settings.behind_grace_days);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display-title text-3xl text-emerge-ink">
          Welcome, {profile.full_name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">
          Track your part of the house as it rises.
        </p>
      </div>

      {/* Bank details pinned at the top, always visible */}
      <BankCard
        accountName={settings.bank_account_name}
        accountNumber={settings.bank_account_number}
        bankName={settings.bank_name}
        withInstruction
      />

      {!partnership || !progress ? (
        <Card>
          <CardHeader>
            <CardTitle>Set up your partnership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              There is no partnership on your account yet. Choose your amount
              and plan to start — you can then upload your receipts here like
              every other partner.
            </p>
            <PledgeForm
              oneTimeGraceDays={settings.one_time_grace_days}
              monthlyIntervalMonths={settings.monthly_interval_months}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Signature rising progress + status */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Your progress</CardTitle>
              <StatusChip status={progress.status} />
            </CardHeader>
            <CardContent className="space-y-4">
              <RisingColumn
                progressPct={progress.progressPct}
                verifiedTotal={progress.verifiedTotal}
                remaining={progress.remaining}
                amount={Number(partnership.amount)}
              />
              {progress.status === "behind" && (
                <p className="rounded-md bg-emerge-red/5 px-3 py-2 text-sm text-emerge-red">
                  You are {formatNaira(progress.behindBy)} behind your plan.
                  {progress.nextDue
                    ? ` Your next payment of ${formatNaira(progress.nextDue.amount)} is due ${formatDate(progress.nextDue.dueDate)}.`
                    : ""}{" "}
                  Give at your pace — every bit moves the building forward.
                </p>
              )}
              {progress.status === "on_track" && progress.nextDue && (
                <p className="text-sm text-muted-foreground">
                  Next payment: {formatNaira(progress.nextDue.amount)} due{" "}
                  {formatDate(progress.nextDue.dueDate)}.
                </p>
              )}
              {progress.pendingTotal > 0 && (
                <p className="text-sm text-amber-600">
                  {formatNaira(progress.pendingTotal)} is awaiting admin review.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Payment schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <ScheduleTable
                installments={installments}
                rowStates={rowStates}
              />
            </CardContent>
          </Card>

          {/* Receipts */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Your receipts</CardTitle>
              <UploadReceiptDialog />
            </CardHeader>
            <CardContent>
              <ReceiptHistory receipts={receipts} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
