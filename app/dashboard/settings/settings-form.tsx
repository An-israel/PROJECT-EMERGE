"use client";

import * as React from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  updatePartnerSettingsAction,
  type ReceiptActionState,
} from "@/app/dashboard/actions";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/lib/validation";

interface Props {
  fullName: string;
  phone: string;
  showOnHonorRoll: boolean;
  honorRollName: string | null;
  emailOptOut: boolean;
}

export function PartnerSettingsForm({
  fullName,
  phone,
  showOnHonorRoll,
  honorRollName,
  emailOptOut,
}: Props) {
  const { toast } = useToast();
  const [showHonor, setShowHonor] = React.useState(showOnHonorRoll);
  const [announcements, setAnnouncements] = React.useState(!emailOptOut);
  const [state, formAction, pending] = useActionState<
    ReceiptActionState,
    FormData
  >(updatePartnerSettingsAction, {});
  const prev = React.useRef(false);

  React.useEffect(() => {
    if (state.success && !prev.current) {
      prev.current = true;
      toast({ variant: "success", title: "Changes saved" });
    }
    if (!state.success) prev.current = false;
  }, [state, toast]);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="text-sm text-emerge-red">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" defaultValue={fullName} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={phone} required />
      </div>
      <div className="rounded-lg border border-emerge-line bg-emerge-paper p-4">
        <label className="flex items-start gap-3">
          <Checkbox
            name="showOnHonorRoll"
            checked={showHonor}
            onCheckedChange={setShowHonor}
            className="mt-0.5"
          />
          <span className="text-sm">
            <span className="font-semibold">
              Show my name on the public partners wall.
            </span>{" "}
            Your amount is never shown.
          </span>
        </label>
        {showHonor && (
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="honorRollName">Name to display (optional)</Label>
            <Input
              id="honorRollName"
              name="honorRollName"
              defaultValue={honorRollName ?? ""}
              placeholder="Leave blank to use your full name"
            />
          </div>
        )}
      </div>
      <div className="rounded-lg border border-emerge-line bg-emerge-paper p-4">
        <label className="flex items-start gap-3">
          <Checkbox
            name="receiveAnnouncements"
            checked={announcements}
            onCheckedChange={setAnnouncements}
            className="mt-0.5"
          />
          <span className="text-sm">
            <span className="font-semibold">
              Email me campaign announcements.
            </span>{" "}
            Updates about Project Emerge sent to everyone. Emails about your own
            receipts are always sent.
          </span>
        </label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const parsed = resetPasswordSchema.safeParse({
      password: form.get("password"),
      confirm: form.get("confirm"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { error: updErr } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    setPending(false);
    if (updErr) {
      setError("Could not update your password. Please try again.");
      return;
    }
    (e.target as HTMLFormElement).reset();
    toast({ variant: "success", title: "Password updated" });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-emerge-red">
          {error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirm password</Label>
        <Input
          id="confirm-password"
          name="confirm"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
