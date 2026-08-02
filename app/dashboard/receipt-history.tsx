"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReceiptStatusChip } from "@/components/status-chip";
import { ViewReceiptButton } from "@/components/view-receipt-button";
import { UploadReceiptDialog } from "./upload-receipt-dialog";
import { deletePendingReceiptAction } from "./actions";
import { useToast } from "@/components/ui/use-toast";
import { formatNaira, formatDate } from "@/lib/format";
import type { Receipt } from "@/lib/supabase/types";
import { Trash2 } from "lucide-react";

export function ReceiptHistory({ receipts }: { receipts: Receipt[] }) {
  const { toast } = useToast();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onDelete(id: string) {
    setPendingId(id);
    const res = await deletePendingReceiptAction(id);
    setPendingId(null);
    if (res.success) {
      toast({ variant: "success", title: "Receipt removed" });
    } else {
      toast({
        variant: "destructive",
        title: "Could not remove",
        description: res.error,
      });
    }
  }

  if (receipts.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <p className="font-medium text-emerge-ink">No receipts yet</p>
        <p className="mt-1 text-sm">
          Transfer to the church account above, then upload your receipt. It
          will appear here as you go.
        </p>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {receipts.map((r) => (
        <li key={r.id}>
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-lg font-semibold">
                  {formatNaira(Number(r.amount))}
                </div>
                <div className="text-xs text-muted-foreground">
                  Transferred {formatDate(r.transfer_date)}
                  {r.reference ? ` · Ref ${r.reference}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ReceiptStatusChip status={r.status} />
                <ViewReceiptButton receiptId={r.id} />
                {r.status === "pending" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(r.id)}
                    disabled={pendingId === r.id}
                    aria-label="Remove pending receipt"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {r.status === "rejected" && (
              <div className="mt-3 rounded-md bg-emerge-red/5 p-3 text-sm">
                <p className="text-emerge-red">
                  <span className="font-semibold">Reason:</span>{" "}
                  {r.reject_reason}
                </p>
                <div className="mt-2">
                  <UploadReceiptDialog triggerLabel="Re-upload receipt" />
                </div>
              </div>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
