import { describe, it, expect } from "vitest";
import { generateSchedule } from "@/lib/schedule";
import { PLANS, PLAN_INSTALLMENTS, type Plan } from "@/lib/constants";

const TIER_AMOUNTS = [100000, 200000, 300000, 500000, 1000000, 2000000, 3333333];

const CONFIG = {
  startDate: "2026-01-15",
  monthlyIntervalMonths: 1,
  oneTimeGraceDays: 30,
};

describe("generateSchedule", () => {
  it("every tier x every plan sums exactly to the amount", () => {
    for (const amount of TIER_AMOUNTS) {
      for (const plan of PLANS) {
        const schedule = generateSchedule({ amount, plan, ...CONFIG });
        const total = schedule.reduce((acc, s) => acc + s.amount, 0);
        expect(total, `${amount} / ${plan}`).toBe(amount);
      }
    }
  });

  it("produces the correct number of installments per plan", () => {
    for (const plan of PLANS) {
      const schedule = generateSchedule({ amount: 600000, plan, ...CONFIG });
      expect(schedule.length).toBe(PLAN_INSTALLMENTS[plan]);
    }
  });

  it("one_time due date equals start date plus grace days", () => {
    const schedule = generateSchedule({
      amount: 500000,
      plan: "one_time",
      ...CONFIG,
    });
    expect(schedule).toHaveLength(1);
    // 2026-01-15 + 30 days = 2026-02-14
    expect(schedule[0].dueDate).toBe("2026-02-14");
    expect(schedule[0].amount).toBe(500000);
  });

  it("installment due dates step by the configured interval in months", () => {
    const schedule = generateSchedule({
      amount: 300000,
      plan: "three_months",
      ...CONFIG,
    });
    expect(schedule.map((s) => s.dueDate)).toEqual([
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
  });

  it("base installments floor to whole Naira and the last absorbs remainder", () => {
    // 100000 / 3 = 33333.33 -> 33333, 33333, 33334
    const schedule = generateSchedule({
      amount: 100000,
      plan: "three_months",
      ...CONFIG,
    });
    expect(schedule.map((s) => s.amount)).toEqual([33333, 33333, 33334]);
  });

  it("evenly divisible amounts split evenly", () => {
    const schedule = generateSchedule({
      amount: 600000,
      plan: "six_months",
      ...CONFIG,
    });
    expect(schedule.map((s) => s.amount)).toEqual([
      100000, 100000, 100000, 100000, 100000, 100000,
    ]);
  });

  it("respects a custom monthly interval", () => {
    const schedule = generateSchedule({
      amount: 300000,
      plan: "three_months",
      startDate: "2026-01-31",
      monthlyIntervalMonths: 2,
      oneTimeGraceDays: 30,
    });
    // +2, +4, +6 months from Jan 31, clamped to month-end where needed
    expect(schedule.map((s) => s.dueDate)).toEqual([
      "2026-03-31",
      "2026-05-31",
      "2026-07-31",
    ]);
  });

  it("rejects non-positive amounts", () => {
    expect(() =>
      generateSchedule({ amount: 0, plan: "one_time" as Plan, ...CONFIG }),
    ).toThrow();
  });
});
