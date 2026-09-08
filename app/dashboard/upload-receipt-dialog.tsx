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
import { uploadReceiptAction } from "./actions";
import { MAX_FILE_BYTES, ALLOWED_MIME, validateFile } from "@/lib/validation";
import { createClient } from "@/lib/supabase/client";
import { inferMimeType, receiptObjectPath } from "@/lib/upload";
import { Upload } from "lucide-react";

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
   * The file goes straight from the browser to Supabase Storage (RLS lets a
   * partner write only into their own folder). Only the resulting path is
   * sent to the server action, so a large photo never has to fit inside a
   * Server Action request body.
   */
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setError("Please attach your receipt file.");
      return;
    }
    const fileError = validateFile({
      type: file.type,
      size: file.size,
      name: file.name,
    });
    if (fileError) {
      setError(fileError);
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session has expired. Please log in again.");
        return;
      }

      const path = receiptObjectPath(user.id, file.name, file.type);
      const { error: uploadErr } = await supabase.storage
        .from("receipts")
        .upload(path, file, {
          contentType: inferMimeType(file.name, file.type) || undefined,
          upsert: false,
        });
      if (uploadErr) {
        setError(
          "We could not upload your file. Check your connection and try again.",
        );
        return;
      }

      formData.delete("file");
      formData.set("filePath", path);
      const result = await uploadReceiptAction({}, formData);

      if (result.error) {
        // The row was not created, so do not leave the file behind.
        await supabase.storage.from("receipts").remove([path]);
        setError(result.error);
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
    } catch {
      setError("Something went wrong. Please try again.");
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
            <p role="alert" className="text-sm text-emerge-red">
              {error}
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
              {pending ? "Uploading…" : "Submit receipt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
