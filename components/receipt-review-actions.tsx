"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  approveReceiptAction,
  rejectReceiptAction,
} from "@/app/admin/actions";
import { Check, X } from "lucide-react";

export function ReceiptReviewActions({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  async function onApprove() {
    setBusy(true);
    const res = await approveReceiptAction(receiptId);
    setBusy(false);
    if (res.success) {
      toast({ variant: "success", title: "Receipt approved" });
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "Failed", description: res.error });
    }
  }

  async function onReject() {
    if (reason.trim().length < 3) {
      toast({
        variant: "destructive",
        title: "Reason required",
        description: "Give the partner a short reason.",
      });
      return;
    }
    setBusy(true);
    const res = await rejectReceiptAction(receiptId, reason.trim());
    setBusy(false);
    if (res.success) {
      toast({ variant: "success", title: "Receipt rejected" });
      setRejectOpen(false);
      setReason("");
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "Failed", description: res.error });
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="success"
        size="sm"
        onClick={onApprove}
        disabled={busy}
      >
        <Check className="h-4 w-4" /> Approve
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setRejectOpen(true)}
        disabled={busy}
      >
        <X className="h-4 w-4" /> Reject
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this receipt</DialogTitle>
            <DialogDescription>
              The partner will see this reason and can re-upload.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. The amount on the receipt does not match what you entered."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onReject}
              disabled={busy}
            >
              Reject receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
