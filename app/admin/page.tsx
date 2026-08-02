import Link from "next/link";
import { getAdminOverview, getReceiptsForReview } from "@/lib/admin-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Thermometer } from "@/components/thermometer";
import { StatusChip } from "@/components/status-chip";
import { ReceiptReviewActions } from "@/components/receipt-review-actions";
import { ViewReceiptButton } from "@/components/view-receipt-button";
import { Button } from "@/components/ui/button";
import { formatNaira, formatDate } from "@/lib/format";

export const metadata = { title: "Control room — Project Emerge" };

export default async function AdminHome() {
  const { aggregate, goal, partners } = await getAdminOverview();
  const pending = await getReceiptsForReview("pending");
  const behind = partners
    .filter((p) => p.status === "behind")
    .sort((a, b) => b.behindBy - a.behindBy);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display-title text-3xl text-emerge-ink">Control room</h1>
        <p className="text-muted-foreground">
          The full picture — visible to admins only.
        </p>
      </div>

      {/* Thermometer */}
      <Card>
        <CardHeader>
          <CardTitle>Toward the Phase One goal</CardTitle>
        </CardHeader>
        <CardContent>
          <Thermometer
            verified={aggregate.totalVerified}
            goal={goal}
            goalPct={aggregate.goalPct}
          />
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="Total verified" value={formatNaira(aggregate.totalVerified)} accent />
        <Kpi label="Total pledged" value={formatNaira(aggregate.totalPledged)} />
        <Kpi label="Pending review" value={formatNaira(aggregate.totalPending)} />
        <Kpi label="Partners" value={String(aggregate.partnerCount)} />
        <Kpi label="Behind" value={String(aggregate.behindCount)} />
        <Kpi label="Completed" value={String(aggregate.completedCount)} />
      </div>

      {/* Receipts awaiting review */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Receipts awaiting review ({pending.length})</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/receipts">Open queue</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <EmptyState
              title="Nothing to review"
              body="New receipts uploaded by partners will appear here for approval."
            />
          ) : (
            <ul className="divide-y divide-emerge-line">
              {pending.slice(0, 6).map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <div className="font-medium">{r.partner.full_name}</div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-mono">
                        {formatNaira(Number(r.amount))}
                      </span>{" "}
                      · {formatDate(r.transfer_date)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ViewReceiptButton receiptId={r.id} />
                    <ReceiptReviewActions receiptId={r.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Partners falling behind */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Partners falling behind ({behind.length})</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/partners?status=behind">See all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {behind.length === 0 ? (
            <EmptyState
              title="Everyone is on track"
              body="Partners who fall behind their plan will be listed here so you can reach out."
            />
          ) : (
            <ul className="divide-y divide-emerge-line">
              {behind.slice(0, 6).map((p) => (
                <li
                  key={p.partnership.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <div className="font-medium">{p.profile.full_name}</div>
                    <div className="text-sm text-emerge-red">
                      {formatNaira(p.behindBy)} behind
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip status={p.status} />
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/partners/${p.profile.id}`}>
                        Open
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
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
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-1 font-mono text-2xl font-bold ${accent ? "text-emerge-green" : "text-emerge-ink"}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-emerge-line p-6 text-center">
      <p className="font-medium text-emerge-ink">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
