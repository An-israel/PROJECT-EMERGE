"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  createOwnPartnershipAction,
  type ReceiptActionState,
} from "./actions";
import {
  TIERS,
  TIER_LABELS,
  PLANS,
  PLAN_LABELS,
  CUSTOM_TIER_MINIMUM,
  type Tier,
  type Plan,
} from "@/lib/constants";
import { generateSchedule } from "@/lib/schedule";
import { todayInCampaignTZ } from "@/lib/time";
import { formatNaira, formatDate } from "@/lib/format";
import { formatAmountInput, parseAmountInput } from "@/lib/amount";
import { HandHeart } from "lucide-react";

interface Props {
  oneTimeGraceDays: number;
  monthlyIntervalMonths: number;
}

/**
 * Pledge from an account that already exists. Same choices as sign up, minus
 * the account fields — the person is already signed in.
 */
export function PledgeForm({
  oneTimeGraceDays,
  monthlyIntervalMonths,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [tier, setTier] = React.useState<Tier>("2000000_plus");
  const [plan, setPlan] = React.useState<Plan>("one_time");
  const [customAmount, setCustomAmount] = React.useState<string>(
    formatAmountInput(String(CUSTOM_TIER_MINIMUM)),
  );

  const [state, formAction, pending] = useActionState<
    ReceiptActionState,
    FormData
  >(createOwnPartnershipAction, {});

  const handled = React.useRef<ReceiptActionState | null>(null);
  React.useEffect(() => {
    if (state.success && handled.current !== state) {
      handled.current = state;
      toast({
        variant: "success",
        title: "Partnership created",
        description: "You can upload your receipts now.",
      });
      router.refresh();
    }
  }, [state, toast, router]);

  const isCustom = tier === "2000000_plus";
  const amount = isCustom
    ? (parseAmountInput(customAmount) ?? 0)
    : Number(tier);
  const customValid = !isCustom || amount >= CUSTOM_TIER_MINIMUM;

  const schedule = React.useMemo(() => {
    if (!amount || amount <= 0) return [];
    try {
      return generateSchedule({
        amount,
        plan,
        startDate: todayInCampaignTZ(),
        monthlyIntervalMonths,
        oneTimeGraceDays,
      });
    } catch {
      return [];
    }
  }, [amount, plan, monthlyIntervalMonths, oneTimeGraceDays]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="tier" value={tier} />
      <input type="hidden" name="plan" value={plan} />

      {state.error && (
        <div role="alert" className="space-y-1">
          <p className="text-sm text-emerge-red">{state.error}</p>
          {state.detail && (
            <p className="break-words text-xs text-muted-foreground">
              Technical detail: {state.detail}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pledge-tier">Partnership amount</Label>
          <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
            <SelectTrigger id="pledge-tier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIERS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TIER_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pledge-plan">Payment plan</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
            <SelectTrigger id="pledge-plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PLAN_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isCustom && (
        <div className="space-y-1.5">
          <Label htmlFor="customAmount">Your amount (₦)</Label>
          <Input
            id="customAmount"
            name="customAmount"
            inputMode="decimal"
            value={customAmount}
            onChange={(e) => setCustomAmount(formatAmountInput(e.target.value))}
            required
          />
          {!customValid && (
            <p className="text-xs text-emerge-red">
              Amount must be at least {formatNaira(CUSTOM_TIER_MINIMUM)}.
            </p>
          )}
        </div>
      )}

      {schedule.length > 0 && (
        <div className="rounded-lg border border-emerge-line bg-emerge-paper p-4">
          <h3 className="mb-2 text-sm font-semibold">Your schedule</h3>
          <ul className="divide-y divide-emerge-line text-sm">
            {schedule.map((s) => (
              <li key={s.sequence} className="flex justify-between py-1.5">
                <span className="text-muted-foreground">
                  {schedule.length === 1 ? "Due by" : `Payment ${s.sequence}`} ·{" "}
                  {formatDate(s.dueDate)}
                </span>
                <span className="font-mono font-semibold">
                  {formatNaira(s.amount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Total: <span className="font-mono">{formatNaira(amount)}</span>
          </p>
        </div>
      )}

      <Button type="submit" disabled={pending || !customValid}>
        <HandHeart className="h-4 w-4" />
        {pending ? "Setting up…" : "Create my partnership"}
      </Button>
    </form>
  );
}
