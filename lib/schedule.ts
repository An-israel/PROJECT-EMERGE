/**
 * Installment schedule generation (section 7.1).
 *
 * Pure and DB-free so it can be unit tested in isolation. The invariant that
 * matters most: the installment amounts always sum EXACTLY to the partnership
 * amount, with the final installment absorbing any rounding remainder.
 */
import { addDays, addMonths, type ISODate } from "./date";
import { PLAN_INSTALLMENTS, type Plan } from "./constants";

export interface ScheduleInput {
  amount: number;
  plan: Plan;
  startDate: ISODate;
  monthlyIntervalMonths: number;
  oneTimeGraceDays: number;
}

export interface ScheduledInstallment {
  sequence: number; // 1-based
  dueDate: ISODate;
  amount: number;
}

export function generateSchedule(input: ScheduleInput): ScheduledInstallment[] {
  const { amount, plan, startDate, monthlyIntervalMonths, oneTimeGraceDays } =
    input;

  if (!(amount > 0)) {
    throw new Error("Amount must be greater than 0");
  }

  const n = PLAN_INSTALLMENTS[plan];

  if (plan === "one_time") {
    return [
      {
        sequence: 1,
        dueDate: addDays(startDate, oneTimeGraceDays),
        amount,
      },
    ];
  }

  // Base installment rounded down to whole Naira; last one absorbs remainder.
  const base = Math.floor(amount / n);
  const installments: ScheduledInstallment[] = [];
  let allocated = 0;

  for (let i = 1; i <= n; i++) {
    const isLast = i === n;
    const value = isLast ? amount - allocated : base;
    allocated += value;
    installments.push({
      sequence: i,
      dueDate: addMonths(startDate, i * monthlyIntervalMonths),
      amount: value,
    });
  }

  return installments;
}
