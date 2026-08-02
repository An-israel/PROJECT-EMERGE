import { describe, it, expect } from "vitest";
import {
  computeProgress,
  computeAggregate,
  installmentRowStates,
  type InstallmentLike,
  type ReceiptLike,
} from "@/lib/progress";

const installments: InstallmentLike[] = [
  { sequence: 1, dueDate: "2026-02-15", amount: 100000 },
  { sequence: 2, dueDate: "2026-03-15", amount: 100000 },
  { sequence: 3, dueDate: "2026-04-15", amount: 100000 },
];

const base = {
  amount: 300000,
  installments,
  behindGraceDays: 3,
};

describe("computeProgress", () => {
  it("sums verified and pending totals", () => {
    const receipts: ReceiptLike[] = [
      { amount: 50000, status: "approved" },
      { amount: 25000, status: "approved" },
      { amount: 10000, status: "pending" },
      { amount: 99999, status: "rejected" },
    ];
    const r = computeProgress({ ...base, receipts, today: "2026-02-01" });
    expect(r.verifiedTotal).toBe(75000);
    expect(r.pendingTotal).toBe(10000);
  });

  it("remaining is floored at 0 and never negative", () => {
    const receipts: ReceiptLike[] = [{ amount: 400000, status: "approved" }];
    const r = computeProgress({ ...base, receipts, today: "2026-05-01" });
    expect(r.remaining).toBe(0);
    expect(r.surplus).toBe(100000);
  });

  it("caps progress_pct at 100 on overpayment and marks completed", () => {
    const receipts: ReceiptLike[] = [{ amount: 999999, status: "approved" }];
    const r = computeProgress({ ...base, receipts, today: "2026-05-01" });
    expect(r.progressPct).toBe(100);
    expect(r.status).toBe("completed");
  });

  it("expected_to_date counts installments past due + grace days", () => {
    // First installment due 2026-02-15, +3 grace = 2026-02-18.
    const before = computeProgress({
      ...base,
      receipts: [],
      today: "2026-02-17",
    });
    expect(before.expectedToDate).toBe(0);

    const after = computeProgress({
      ...base,
      receipts: [],
      today: "2026-02-18",
    });
    expect(after.expectedToDate).toBe(100000);
  });

  it("marks behind and computes behind_by past a due date beyond grace", () => {
    const receipts: ReceiptLike[] = [{ amount: 40000, status: "approved" }];
    const r = computeProgress({ ...base, receipts, today: "2026-02-20" });
    expect(r.status).toBe("behind");
    expect(r.behindBy).toBe(60000); // expected 100000 - verified 40000
  });

  it("is on_track when verified meets expectation", () => {
    const receipts: ReceiptLike[] = [{ amount: 100000, status: "approved" }];
    const r = computeProgress({ ...base, receipts, today: "2026-02-20" });
    expect(r.status).toBe("on_track");
    expect(r.behindBy).toBe(0);
  });

  it("computes next_due as the earliest future installment", () => {
    const r = computeProgress({ ...base, receipts: [], today: "2026-02-20" });
    expect(r.nextDue).toEqual({
      sequence: 2,
      dueDate: "2026-03-15",
      amount: 100000,
    });
  });

  it("next_due is null when all installments are in the past", () => {
    const r = computeProgress({ ...base, receipts: [], today: "2026-12-31" });
    expect(r.nextDue).toBeNull();
  });
});

describe("installmentRowStates", () => {
  it("marks met, overdue, and due_soon appropriately", () => {
    const states = installmentRowStates(installments, 100000, "2026-03-20", 3);
    // cumulative targets: 100k (met), 200k (overdue by 3/15+3), 300k (due_soon)
    expect(states).toEqual(["met", "overdue", "due_soon"]);
  });
});

describe("computeAggregate", () => {
  it("totals verified/pledged and excludes cancelled partnerships", () => {
    const r = computeAggregate({
      goal: 100_000_000,
      partnerships: [
        {
          amount: 500000,
          status: "active",
          verifiedTotal: 200000,
          derivedStatus: "on_track",
        },
        {
          amount: 1000000,
          status: "completed",
          verifiedTotal: 1000000,
          derivedStatus: "completed",
        },
        {
          amount: 300000,
          status: "active",
          verifiedTotal: 0,
          derivedStatus: "behind",
        },
        {
          amount: 999999,
          status: "cancelled",
          verifiedTotal: 0,
          derivedStatus: "on_track",
        },
      ],
      totalPendingAmount: 50000,
      receiptsAwaitingReview: 2,
    });
    expect(r.totalVerified).toBe(1200000);
    expect(r.totalPledged).toBe(1800000);
    expect(r.partnerCount).toBe(3);
    expect(r.onTrackCount).toBe(1);
    expect(r.behindCount).toBe(1);
    expect(r.completedCount).toBe(1);
    expect(r.totalPending).toBe(50000);
    expect(r.receiptsAwaitingReview).toBe(2);
    expect(r.goalPct).toBeCloseTo(1.2, 5);
  });
});
