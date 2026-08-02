"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { uploadReceiptAction, type ReceiptActionState } from "./actions";
import {
  MAX_FILE_BYTES,
  ALLOWED_MIME,
  validateFile,
} from "@/lib/validation";
import { Upload } from "lucide-react";

const initial: ReceiptActionState = {};

export function UploadReceiptDialog({
  triggerLabel = "Upload receipt",
}: {
  triggerLabel?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [clientFileError, setClientFileError] = React.useState<string | null>(
    null,
  );
  const [state, formAction, pending] = useActionState(
    uploadReceiptAction,
    initial,
  );
  const prevSuccess = React.useRef(false);

  React.useEffect(() => {
    if (state.success && !prevSuccess.current) {
      prevSuccess.current = true;
      toast({
        variant: "success",
        title: "Receipt submitted",
        description: "An admin will review it shortly.",
      });
      setOpen(false);
    }
    if (!state.success) prevSuccess.current = false;
  }, [state, toast]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setClientFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile({ type: file.type, size: file.size });
    if (err) setClientFileError(err);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload your receipt</DialogTitle>
          <DialogDescription>
            After you transfer to the church account, add your receipt here for
            review.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <p role="alert" className="text-sm text-emerge-red">
              {state.error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (₦)</Label>
              <Input
                id="amount"
                name="amount"
                inputMode="numeric"
                required
                placeholder="50000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transferDate">Transfer date</Label>
              <Input
                id="transferDate"
                name="transferDate"
                type="date"
                max={today}
                defaultValue={today}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reference">Reference (optional)</Label>
            <Input id="reference" name="reference" placeholder="Bank transfer ref" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" name="note" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file">Receipt file</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept={ALLOWED_MIME.join(",")}
              onChange={onFileChange}
              required
            />
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, WEBP, or PDF. Max {MAX_FILE_BYTES / (1024 * 1024)}MB.
            </p>
            {clientFileError && (
              <p className="text-xs text-emerge-red">{clientFileError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || !!clientFileError}
              className="w-full sm:w-auto"
            >
              {pending ? "Submitting…" : "Submit receipt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
