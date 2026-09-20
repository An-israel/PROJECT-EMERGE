"use client";

import * as React from "react";
import { useActionState } from "react";
import { signUpAction, type SignUpState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface SignUpFormProps {
  initialTier?: Tier;
  oneTimeGraceDays: number;
  monthlyIntervalMonths: number;
}

export function SignUpForm({
  initialTier,
  oneTimeGraceDays,
  monthlyIntervalMonths,
}: SignUpFormProps) {
  const [state, formAction, pending] = useActionState<SignUpState, FormData>(
    signUpAction,
    {},
  );

  const [step, setStep] = React.useState(1);
  // Default to the largest tier (₦2,000,000 and above) when none was chosen
  // from a landing-page link, pre-filled to the minimum so it's valid on load.
  const [tier, setTier] = React.useState<Tier>(initialTier ?? "2000000_plus");
  const [plan, setPlan] = React.useState<Plan>("one_time");
  const [customAmount, setCustomAmount] = React.useState<string>(
    formatAmountInput(String(CUSTOM_TIER_MINIMUM)),
  );
  const [showHonor, setShowHonor] = React.useState(false);

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
    <form action={formAction} className="space-y-6">
      {/* progress dots */}
      <ol className="flex items-center gap-2" aria-label="Sign up steps">
        {[1, 2, 3].map((n) => (
          <li
            key={n}
            className={`h-1.5 flex-1 rounded-full ${
              step >= n ? "bg-emerge-green" : "bg-emerge-line"
            }`}
            aria-current={step === n ? "step" : undefined}
          />
        ))}
      </ol>

      {state.error && (
        <p
          role="alert"
          className="rounded-md bg-emerge-red/10 px-3 py-2 text-sm text-emerge-red"
        >
          {state.error}
        </p>
      )}

      {/* Hidden fields carry state into the server action regardless of step */}
      <input type="hidden" name="tier" value={tier} />
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="customAmount" value={isCustom ? customAmount : ""} />
      <input
        type="hidden"
        name="showOnHonorRoll"
        value={showHonor ? "on" : ""}
      />

      {/* STEP 1: tier + plan */}
      <section className={step === 1 ? "block space-y-5" : "hidden"}>
        <div className="space-y-1.5">
          <Label>Partnership amount</Label>
          <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
            <SelectTrigger>
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

        {isCustom && (
          <div className="space-y-1.5">
            <Label htmlFor="customAmount">Your amount (₦)</Label>
            <Input
              id="customAmount"
              inputMode="decimal"
              value={customAmount}
              onChange={(e) =>
                setCustomAmount(formatAmountInput(e.target.value))
              }
              placeholder="2,000,000"
              aria-invalid={!customValid}
            />
            {!customValid && (
              <p className="text-xs text-emerge-red">
                Amount must be at least {formatNaira(CUSTOM_TIER_MINIMUM)}.
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Payment plan</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
            <SelectTrigger>
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

        <SchedulePreview amount={amount} schedule={schedule} />

        <Button
          type="button"
          className="w-full"
          disabled={!customValid || amount <= 0}
          onClick={() => setStep(2)}
        >
          Continue
        </Button>
      </section>

      {/* STEP 2: identity */}
      <section className={step === 2 ? "block space-y-4" : "hidden"}>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required={step === 2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required={step === 2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" required={step === 2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required={step === 2}
          />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            Back
          </Button>
          <Button type="button" className="flex-1" onClick={() => setStep(3)}>
            Continue
          </Button>
        </div>
      </section>

      {/* STEP 3: honor roll + review + submit */}
      <section className={step === 3 ? "block space-y-5" : "hidden"}>
        <div className="rounded-lg border border-emerge-line bg-emerge-paper p-4">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={showHonor}
              onCheckedChange={(c) => setShowHonor(c)}
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
              <Label htmlFor="honorRollName">
                Name to display (optional)
              </Label>
              <Input
                id="honorRollName"
                name="honorRollName"
                placeholder="Leave blank to use your full name"
              />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-emerge-green/30 bg-emerge-green/5 p-4">
          <h3 className="text-sm font-semibold">You are committing to</h3>
          <p className="mt-1 font-mono text-2xl font-bold text-emerge-green">
            {formatNaira(amount)}
          </p>
          <p className="text-sm text-muted-foreground">{PLAN_LABELS[plan]}</p>
          <SchedulePreview amount={amount} schedule={schedule} compact />
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => setStep(2)}>
            Back
          </Button>
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? "Creating your account…" : "Create my partnership"}
          </Button>
        </div>
      </section>
    </form>
  );
}

function SchedulePreview({
  amount,
  schedule,
  compact,
}: {
  amount: number;
  schedule: Array<{ sequence: number; dueDate: string; amount: number }>;
  compact?: boolean;
}) {
  if (schedule.length === 0) return null;
  return (
    <div className={compact ? "mt-3" : "rounded-lg border border-emerge-line bg-emerge-paper p-4"}>
      {!compact && (
        <h3 className="mb-2 text-sm font-semibold">Your schedule</h3>
      )}
      <ul className="divide-y divide-emerge-line text-sm">
        {schedule.map((s) => (
          <li key={s.sequence} className="flex justify-between py-1.5">
            <span className="text-muted-foreground">
              {schedule.length === 1
                ? "Due by"
                : `Payment ${s.sequence}`}{" "}
              · {formatDate(s.dueDate)}
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
  );
}
