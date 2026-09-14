"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import {
  createReceiptUploadTicketAction,
  uploadReceiptAction,
} from "./actions";
import { MAX_FILE_BYTES, ALLOWED_MIME, validateFile } from "@/lib/validation";
import { createClient } from "@/lib/supabase/client";
import { RECEIPT_BUCKET, inferMimeType } from "@/lib/upload";
import { compressImageFile } from "@/lib/image";
import { Upload } from "lucide-react";

/** Vercel rejects a request body over 4.5MB, so relay only below that. */
const ROUTE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export function UploadReceiptDialog({
  triggerLabel = "Upload receipt",
}: {
  triggerLabel?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [clientFileError, setClientFileError] = React.useState<string | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setClientFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile({
      type: file.type,
      size: file.size,
      name: file.name,
    });
    if (err) setClientFileError(err);
  }

  /**
   * Getting the file to Storage, most reliable route first.
   *
   * 1. Shrink a photo in the browser — a 4MB camera shot becomes a few
   *    hundred KB with no loss of legibility.
   * 2. Send it to our own domain, which is reachable whenever the app itself
   *    loads. The server writes it to Storage with the service role.
   * 3. Only if that fails (or the file is too big to relay) upload straight
   *    to Storage with a signed URL. Some mobile networks cannot reach
   *    Supabase directly, which is why this is the fallback and not the
   *    first choice.
   */
  async function putFileInStorage(
    file: File,
  ): Promise<{ path?: string; error?: string; detail?: string }> {
    const relayable = file.size <= ROUTE_UPLOAD_MAX_BYTES;
    let relayDetail: string | undefined;

    if (relayable) {
      try {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/receipts/upload", {
          method: "POST",
          body,
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.path) return { path: payload.path };

        console.error("[receipt:relay]", response.status, payload);
        // A rejection we understand is the answer — say so rather than
        // retrying a route that will fail the same way.
        if ([400, 401, 413, 429].includes(response.status)) {
          return { error: payload.error, detail: payload.detail };
        }
        relayDetail = payload.detail ?? payload.error;
      } catch (err) {
        console.error("[receipt:relay]", err);
        relayDetail = err instanceof Error ? err.message : String(err);
      }
    }

    const ticket = await createReceiptUploadTicketAction(file.name, file.type);
    if (ticket.error || !ticket.path || !ticket.token) {
      return {
        error: ticket.error ?? "We could not start the upload.",
        detail: ticket.detail,
      };
    }

    const supabase = createClient();
    const { error: uploadErr } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.token, file, {
        contentType: inferMimeType(file.name, file.type) || undefined,
      });
    if (uploadErr) {
      console.error("[receipt:direct]", uploadErr);
      return {
        error: relayable
          ? "We could not send your file to storage."
          : "That file is too large to send on this connection. Please upload a smaller photo or a PDF.",
        // Both routes failed: report what each said, so the cause is visible.
        detail: relayDetail
          ? `direct: ${uploadErr.message} / via site: ${relayDetail}`
          : uploadErr.message,
      };
    }
    return { path: ticket.path };
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDetail(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const chosen = formData.get("file");

    if (!(chosen instanceof File) || chosen.size === 0) {
      setError("Please attach your receipt file.");
      return;
    }
    const fileError = validateFile({
      type: chosen.type,
      size: chosen.size,
      name: chosen.name,
    });
    if (fileError) {
      setError(fileError);
      return;
    }

    setPending(true);
    try {
      const file = await compressImageFile(chosen);
      const stored = await putFileInStorage(file);

      if (stored.error || !stored.path) {
        setError(stored.error ?? "We could not upload your file.");
        setDetail(stored.detail ?? null);
        return;
      }

      formData.delete("file");
      formData.set("filePath", stored.path);
      const result = await uploadReceiptAction({}, formData);

      if (result.error) {
        setError(result.error);
        setDetail(result.detail ?? null);
        return;
      }

      form.reset();
      setOpen(false);
      toast({
        variant: "success",
        title: "Receipt submitted",
        description: "An admin will review it shortly.",
      });
      router.refresh();
    } catch (err) {
      console.error("[receipt:upload]", err);
      setError("Something went wrong while uploading.");
      setDetail(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
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
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="space-y-1">
              <p className="text-sm text-emerge-red">{error}</p>
              {detail && (
                <p className="break-words text-xs text-muted-foreground">
                  Technical detail (send this to the church admin): {detail}
                </p>
              )}
            </div>
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
              {pending ? "Uploading…" : "Submit receipt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
