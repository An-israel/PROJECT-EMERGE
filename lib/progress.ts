/**
 * Progress and status computation (sections 7.2 and 7.3).
 *
 * Pure functions over receipts + installments + "today". No DB, fully testable.
 */
import { addDays, compareISODate, type ISODate } from "./date";
import type { DerivedStatus } from "./constants";

export interface ReceiptLike {
  amount: number;
  status: "pending" | "approved" | "rejected";
}

export interface InstallmentLike {
  sequence: number;
  dueDate: ISODate;
  amount: number;
}

export interface ProgressInput {
  amount: number; // pledged amount
  receipts: ReceiptLike[];
  installments: InstallmentLike[];
  today: ISODate;
  behindGraceDays: number;
}

export interface ProgressResult {
  verifiedTotal: number;
  pendingTotal: number;
  remaining: number;
  progressPct: number;
  expectedToDate: number;
  status: DerivedStatus;
  behindBy: number; // 0 unless behind
  nextDue: { sequence: number; dueDate: ISODate; amount: number } | null;
  surplus: number; // amount verified beyond the pledge (admin insight)
}

export function computeProgress(input: ProgressInput): ProgressResult {
  const { amount, receipts, installments, today, behindGraceDays } = input;

  const verifiedTotal = sum(
    receipts.filter((r) => r.status === "approved").map((r) => r.amount),
  );
  const pendingTotal = sum(
    receipts.filter((r) => r.status === "pending").map((r) => r.amount),
  );

  const remaining = Math.max(0, amount - verifiedTotal);
  const progressPct =
    amount > 0 ? Math.min(100, (verifiedTotal / amount) * 100) : 0;
  const surplus = Math.max(0, verifiedTotal - amount);

  // Expected to date: installments whose due date + grace has passed (<= today).
  const expectedToDate = sum(
    installments
      .filter(
        (i) => compareISODate(addDays(i.dueDate, behindGraceDays), today) <= 0,
      )
      .map((i) => i.amount),
  );

  let status: DerivedStatus;
  let behindBy = 0;
  if (verifiedTotal >= amount) {
    status = "completed";
  } else if (verifiedTotal < expectedToDate) {
    status = "behind";
    behindBy = expectedToDate - verifiedTotal;
  } else {
    status = "on_track";
  }

  // Next due: earliest installment strictly after today.
  const future = installments
    .filter((i) => compareISODate(i.dueDate, today) > 0)
    .sort((a, b) => compareISODate(a.dueDate, b.dueDate));
  const nextDue = future[0]
    ? {
        sequence: future[0].sequence,
        dueDate: future[0].dueDate,
        amount: future[0].amount,
      }
    : null;

  return {
    verifiedTotal,
    pendingTotal,
    remaining,
    progressPct,
    expectedToDate,
    status,
    behindBy,
    nextDue,
    surplus,
  };
}

/**
 * Per-row derived state for the schedule table (section 8, partner dashboard).
 * "met" once cumulative verified covers this installment's cumulative target,
 * else "overdue" if past due+grace, else "due_soon".
 */
export type InstallmentRowState = "met" | "due_soon" | "overdue";

export function installmentRowStates(
  installments: InstallmentLike[],
  verifiedTotal: number,
  today: ISODate,
  behindGraceDays: number,
): InstallmentRowState[] {
  const ordered = [...installments].sort((a, b) => a.sequence - b.sequence);
  let cumulative = 0;
  return ordered.map((i) => {
    cumulative += i.amount;
    if (verifiedTotal >= cumulative) return "met";
    if (compareISODate(addDays(i.dueDate, behindGraceDays), today) <= 0) {
      return "overdue";
    }
    return "due_soon";
  });
}

// ---- Aggregate (admin only, section 7.3) -----------------------------------

export interface AggregateInput {
  goal: number;
  partnerships: Array<{
    amount: number;
    status: "active" | "completed" | "cancelled";
    verifiedTotal: number;
    derivedStatus: DerivedStatus;
  }>;
  totalPendingAmount: number;
  receiptsAwaitingReview: number;
}

export interface AggregateResult {
  totalVerified: number;
  totalPending: number;
  totalPledged: number;
  goalPct: number;
  partnerCount: number;
  onTrackCount: number;
  behindCount: number;
  completedCount: number;
  receiptsAwaitingReview: number;
}

export function computeAggregate(input: AggregateInput): AggregateResult {
  const included = input.partnerships.filter((p) => p.status !== "cancelled");
  const totalVerified = sum(included.map((p) => p.verifiedTotal));
  const totalPledged = sum(included.map((p) => p.amount));
  const goalPct = input.goal > 0 ? (totalVerified / input.goal) * 100 : 0;

  return {
    totalVerified,
    totalPending: input.totalPendingAmount,
    totalPledged,
    goalPct,
    partnerCount: included.length,
    onTrackCount: included.filter((p) => p.derivedStatus === "on_track").length,
    behindCount: included.filter((p) => p.derivedStatus === "behind").length,
    completedCount: included.filter((p) => p.derivedStatus === "completed")
      .length,
    receiptsAwaitingReview: input.receiptsAwaitingReview,
  };
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
