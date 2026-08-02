import { CopyButton } from "@/components/copy-button";
import { Card } from "@/components/ui/card";
import { Landmark } from "lucide-react";

interface BankCardProps {
  accountName: string;
  accountNumber: string;
  bankName: string;
  /** Show the "transfer then upload" instruction (dashboard). */
  withInstruction?: boolean;
}

/**
 * Church bank details. On the dashboard this is pinned at the top and always
 * visible with copy buttons on each field.
 */
export function BankCard({
  accountName,
  accountNumber,
  bankName,
  withInstruction = false,
}: BankCardProps) {
  return (
    <Card className="border-emerge-green/30 bg-white">
      <div className="flex items-start gap-3 p-5">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerge-green/10 text-emerge-green">
          <Landmark className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Church account
          </h2>
          <dl className="mt-2 space-y-2.5">
            <Row
              label="Account name"
              value={accountName}
              copyLabel="Account name"
            />
            <Row
              label="Account number"
              value={accountNumber}
              copyLabel="Account number"
              mono
            />
            <Row label="Bank" value={bankName} copyLabel="Bank name" />
          </dl>
          {withInstruction && (
            <p className="mt-3 text-sm text-muted-foreground">
              Transfer to this account, then upload your receipt below.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  copyLabel,
  mono,
}: {
  label: string;
  value: string;
  copyLabel: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd
          className={`truncate font-semibold ${mono ? "font-mono text-lg tracking-wide" : ""}`}
        >
          {value}
        </dd>
      </div>
      <CopyButton value={value} label={copyLabel} />
    </div>
  );
}
