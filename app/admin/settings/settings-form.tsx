"use client";

import * as React from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  updateAdminSettingsAction,
  type AdminActionState,
} from "@/app/admin/actions";
import type { Settings } from "@/lib/supabase/types";

export function AdminSettingsForm({ settings }: { settings: Settings }) {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState<
    AdminActionState,
    FormData
  >(updateAdminSettingsAction, {});
  const prev = React.useRef(false);

  React.useEffect(() => {
    if (state.success && !prev.current) {
      prev.current = true;
      toast({ variant: "success", title: "Settings saved" });
    }
    if (!state.success) prev.current = false;
  }, [state, toast]);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p role="alert" className="text-sm text-emerge-red">
          {state.error}
        </p>
      )}
      <Field name="campaignTitle" label="Campaign title" defaultValue={settings.campaign_title} />
      <Field
        name="campaignSubtitle"
        label="Campaign subtitle"
        defaultValue={settings.campaign_subtitle}
      />
      <Field name="scripture" label="Scripture reference" defaultValue={settings.scripture} />
      <Field
        name="goal"
        label="Phase One goal (₦)"
        type="number"
        defaultValue={String(Number(settings.goal))}
      />

      <div className="border-t border-emerge-line pt-4">
        <h3 className="mb-3 text-sm font-semibold">Bank details</h3>
        <div className="space-y-4">
          <Field
            name="bankAccountName"
            label="Account name"
            defaultValue={settings.bank_account_name}
          />
          <Field
            name="bankAccountNumber"
            label="Account number"
            defaultValue={settings.bank_account_number}
          />
          <Field name="bankName" label="Bank name" defaultValue={settings.bank_name} />
        </div>
      </div>

      <div className="border-t border-emerge-line pt-4">
        <h3 className="mb-1 text-sm font-semibold">Footer contact details</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Shown in the footer of the public home page. Leave a field blank to
          hide that line.
        </p>
        <div className="space-y-4">
          <Field
            name="contactPhone"
            label="Contact phone"
            defaultValue={settings.contact_phone ?? ""}
            required={false}
          />
          <Field
            name="contactEmail"
            label="Contact email"
            defaultValue={settings.contact_email ?? ""}
            required={false}
          />
          <Field
            name="contactAddress"
            label="Contact address"
            defaultValue={settings.contact_address ?? ""}
            required={false}
          />
        </div>
      </div>

      <div className="border-t border-emerge-line pt-4">
        <h3 className="mb-3 text-sm font-semibold">Timing rules</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            name="oneTimeGraceDays"
            label="One-time grace (days)"
            type="number"
            defaultValue={String(settings.one_time_grace_days)}
          />
          <Field
            name="monthlyIntervalMonths"
            label="Interval (months)"
            type="number"
            defaultValue={String(settings.monthly_interval_months)}
          />
          <Field
            name="behindGraceDays"
            label="Behind grace (days)"
            type="number"
            defaultValue={String(settings.behind_grace_days)}
          />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  required = true,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
      />
    </div>
  );
}
