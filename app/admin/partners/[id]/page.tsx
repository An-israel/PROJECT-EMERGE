import { notFound } from "next/navigation";
import Link from "next/link";
import { getPartnerDetail } from "@/lib/admin-data";
import { getFullSettings } from "@/lib/settings";
import { installmentRowStates } from "@/lib/progress";
import { todayInCampaignTZ } from "@/lib/time";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusChip, ReceiptStatusChip } from "@/components/status-chip";
import { ScheduleTable } from "@/components/schedule-table";
import { ReceiptReviewActions } from "@/components/receipt-review-actions";
import { ViewReceiptButton } from "@/components/view-receipt-button";
import { ContactPanel } from "./contact-panel";
import { formatNaira, formatDate } from "@/lib/format";
import { PLAN_LABELS, TIER_LABELS } from "@/lib/constants";
import { ArrowLeft } from "lucide-react";

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPartnerDetail(id);
  if (!detail) notFound();

  const settings = await getFullSettings();
  const { profile, partnership, installments, receipts, progress, contactLogs } =
    detail;

  const rowStates = partnership
    ? installmentRowStates(
        installments.map((i) => ({
          sequence: i.sequence,
          dueDate: i.due_date,
          amount: Number(i.amount),
        })),
        progress?.verifiedTotal ?? 0,
        todayInCampaignTZ(),
        settings.behind_grace_days,
      )
    : [];

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/partners">
          <ArrowLeft className="h-4 w-4" /> All partners
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display-title text-3xl text-emerge-ink">
            {profile.full_name}
          </h1>
          <p className="text-muted-foreground">
            {profile.phone} · {profile.email}
          </p>
        </div>
        {progress && <StatusChip status={progress.status} />}
      </div>

      {partnership && progress ? (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Pledged" value={formatNaira(Number(partnership.amount))} />
            <Stat
              label="Verified"
              value={formatNaira(progress.verifiedTotal)}
              accent
            />
            <Stat label="Remaining" value={formatNaira(progress.remaining)} />
            <Stat label="Progress" value={`${Math.round(progress.progressPct)}%`} />
          </div>
          <p className="text-sm text-muted-foreground">
            {TIER_LABELS[partnership.tier]} · {PLAN_LABELS[partnership.plan]} ·
            started {formatDate(partnership.start_date)}
            {progress.surplus > 0
              ? ` · overpaid by ${formatNaira(progress.surplus)}`
              : ""}
          </p>

          {/* Contact panel */}
          <Card>
            <CardHeader>
              <CardTitle>Contact partner</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactPanel
                partnerId={profile.id}
                name={profile.full_name}
                email={profile.email}
                phone={profile.phone}
                behindBy={progress.behindBy}
                bankAccountName={settings.bank_account_name}
                bankAccountNumber={settings.bank_account_number}
                bankName={settings.bank_name}
                canRemind={progress.status === "behind"}
              />
            </CardContent>
          </Card>

          {/* Contact history */}
          <Card>
            <CardHeader>
              <CardTitle>Contact history</CardTitle>
            </CardHeader>
            <CardContent>
              {contactLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No contact logged yet. When you reach out, log it here to keep
                  a record.
                </p>
              ) : (
                <ul className="divide-y divide-emerge-line">
                  {contactLogs.map((l) => (
                    <li key={l.id} className="py-2 text-sm">
                      <span className="font-medium capitalize">{l.method}</span>{" "}
                      · {formatDate(l.created_at.slice(0, 10))}
                      {l.admin_name ? ` · by ${l.admin_name}` : ""}
                      {l.note ? (
                        <span className="text-muted-foreground"> — {l.note}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <ScheduleTable installments={installments} rowStates={rowStates} />
            </CardContent>
          </Card>

          {/* Receipts */}
          <Card>
            <CardHeader>
              <CardTitle>Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              {receipts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This partner has not uploaded any receipts yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {receipts.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerge-line p-3"
                    >
                      <div>
                        <div className="font-mono font-semibold">
                          {formatNaira(Number(r.amount))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(r.transfer_date)}
                          {r.reference ? ` · Ref ${r.reference}` : ""}
                        </div>
                        {r.status === "rejected" && r.reject_reason && (
                          <div className="text-xs text-emerge-red">
                            {r.reject_reason}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <ReceiptStatusChip status={r.status} />
                        <ViewReceiptButton receiptId={r.id} />
                        {r.status === "pending" && (
                          <ReceiptReviewActions receiptId={r.id} />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            This user has no partnership.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-1 font-mono text-xl font-bold ${accent ? "text-emerge-green" : "text-emerge-ink"}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
