"use client";

import * as React from "react";
import { useActionState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  uploadHeroBackgroundAction,
  removeHeroBackgroundAction,
  type AdminActionState,
} from "@/app/admin/actions";
import {
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_BYTES,
  validateImageFile,
} from "@/lib/validation";

export function HeroBackgroundForm({
  currentUrl,
}: {
  currentUrl: string | null;
}) {
  const { toast } = useToast();
  const [clientError, setClientError] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    AdminActionState,
    FormData
  >(uploadHeroBackgroundAction, {});
  const prev = React.useRef(false);

  React.useEffect(() => {
    if (state.success && !prev.current) {
      prev.current = true;
      toast({ variant: "success", title: "Background updated" });
      formRef.current?.reset();
    }
    if (!state.success) prev.current = false;
  }, [state, toast]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const input = formRef.current?.elements.namedItem("file") as
      | HTMLInputElement
      | null;
    const file = input?.files?.[0];
    if (!file) {
      e.preventDefault();
      setClientError("Please choose an image to upload.");
      return;
    }
    const err = validateImageFile({ type: file.type, size: file.size });
    if (err) {
      e.preventDefault();
      setClientError(err);
      return;
    }
    setClientError(null);
  }

  async function onRemove() {
    setRemoving(true);
    const res = await removeHeroBackgroundAction();
    setRemoving(false);
    if (res.error) {
      toast({ variant: "destructive", title: res.error });
    } else {
      toast({ variant: "success", title: "Background removed" });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload a photo to show behind the campaign title on the public home
        page. Landscape images around 1920×1080 look best. Leave it empty (or
        remove it) to use the plain background. Text stays readable — a soft
        dark overlay is added automatically.
      </p>

      <div className="overflow-hidden rounded-xl border border-emerge-line bg-emerge-paper">
        {currentUrl ? (
          <div className="relative aspect-[16/7] w-full">
            {/* Preview of the current background. */}
            <Image
              src={currentUrl}
              alt="Current home page background"
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="flex aspect-[16/7] w-full items-center justify-center text-sm text-muted-foreground">
            No background set — the home page uses the plain paper look.
          </div>
        )}
      </div>

      {(clientError || state.error) && (
        <p role="alert" className="text-sm text-emerge-red">
          {clientError ?? state.error}
        </p>
      )}

      <form
        ref={formRef}
        action={formAction}
        onSubmit={onSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="file">Background image</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept={ALLOWED_IMAGE_MIME.join(",")}
            onChange={() => setClientError(null)}
          />
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, or WEBP. Up to {Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}
            MB.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Uploading…" : "Upload background"}
          </Button>
          {currentUrl && (
            <Button
              type="button"
              variant="outline"
              onClick={onRemove}
              disabled={removing}
            >
              {removing ? "Removing…" : "Remove"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
