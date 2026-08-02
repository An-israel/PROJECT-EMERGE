import Link from "next/link";
import { getReceiptsForReview } from "@/lib/admin-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReceiptReviewActions } from "@/components/receipt-review-actions";
import { ViewReceiptButton } from "@/components/view-receipt-button";
import { ReceiptStatusChip } from "@/components/status-chip";
import { formatNaira, formatDate } from "@/lib/format";

export const metadata = { title: "Receipts — Project Emerge" };

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

export default async function AdminReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = FILTERS.some((f) => f.key === status) ? status! : "pending";
  const receipts = await getReceiptsForReview(
    active === "all" ? undefined : (active as "pending" | "approved" | "rejected"),
  );

  return (
    <div className="space-y-6">
      <h1 className="display-title text-3xl text-emerge-ink">Receipts</h1>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            asChild
            variant={active === f.key ? "default" : "outline"}
            size="sm"
          >
            <Link href={`/admin/receipts?status=${f.key}`}>{f.label}</Link>
          </Button>
        ))}
      </div>

      {receipts.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <p className="font-medium text-emerge-ink">No receipts here</p>
            <p className="mt-1 text-sm">
              {active === "pending"
                ? "When partners upload receipts, they will appear here for review."
                : `No ${active} receipts yet.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {receipts.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/partners/${r.partner.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.partner.full_name}
                    </Link>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-mono">
                        {formatNaira(Number(r.amount))}
                      </span>{" "}
                      · Transferred {formatDate(r.transfer_date)}
                      {r.reference ? ` · Ref ${r.reference}` : ""}
                    </div>
                    {r.note && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        Note: {r.note}
                      </div>
                    )}
                    {r.status === "rejected" && r.reject_reason && (
                      <div className="mt-1 text-sm text-emerge-red">
                        Rejected: {r.reject_reason}
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
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
