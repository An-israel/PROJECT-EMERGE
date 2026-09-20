import { describe, it, expect } from "vitest";
import { formatAmountInput, parseAmountInput } from "@/lib/amount";
import { receiptSchema, adminSettingsSchema } from "@/lib/validation";

describe("parseAmountInput", () => {
  it("reads the grouped form people actually type", () => {
    // The exact value that produced "Expected number, received nan".
    expect(parseAmountInput("200,000")).toBe(200000);
    expect(parseAmountInput("1,000,000")).toBe(1000000);
    expect(parseAmountInput("₦200,000")).toBe(200000);
    expect(parseAmountInput("200 000")).toBe(200000);
    expect(parseAmountInput("200 000")).toBe(200000);
  });

  it("reads a plain number, with or without decimals", () => {
    expect(parseAmountInput("50000")).toBe(50000);
    expect(parseAmountInput("50000.75")).toBe(50000.75);
    expect(parseAmountInput(".5")).toBe(0.5);
    expect(parseAmountInput(12345)).toBe(12345);
  });

  it("returns null for what is genuinely not a number", () => {
    for (const bad of ["", "   ", "abc", "1,2,3.4.5", "12a", "--5", "₦"]) {
      expect(parseAmountInput(bad), bad).toBeNull();
    }
    expect(parseAmountInput(null)).toBeNull();
    expect(parseAmountInput(undefined)).toBeNull();
    expect(parseAmountInput(NaN)).toBeNull();
  });
});

describe("formatAmountInput", () => {
  it("groups digits as they are typed", () => {
    expect(formatAmountInput("200000")).toBe("200,000");
    expect(formatAmountInput("1000")).toBe("1,000");
    expect(formatAmountInput("999")).toBe("999");
  });

  it("is stable when re-applied to its own output", () => {
    expect(formatAmountInput(formatAmountInput("200000"))).toBe("200,000");
  });

  it("keeps at most two decimals", () => {
    expect(formatAmountInput("1234.5")).toBe("1,234.5");
    expect(formatAmountInput("1234.5678")).toBe("1,234.56");
  });

  it("drops leading zeros and junk, and stays empty when empty", () => {
    expect(formatAmountInput("000200000")).toBe("200,000");
    expect(formatAmountInput("abc")).toBe("");
    expect(formatAmountInput("")).toBe("");
  });

  it("round-trips through the parser", () => {
    expect(parseAmountInput(formatAmountInput("200000"))).toBe(200000);
  });
});

describe("receiptSchema amount", () => {
  const base = { transferDate: "2026-09-20", reference: "", note: "" };

  it("accepts a grouped amount", () => {
    const result = receiptSchema.safeParse({ ...base, amount: "200,000" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(200000);
  });

  it("explains itself in plain words instead of leaking a type error", () => {
    const result = receiptSchema.safeParse({ ...base, amount: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "";
      expect(message).not.toMatch(/nan/i);
      expect(message).toContain("figures");
    }
  });

  it("still rejects zero and negatives", () => {
    expect(receiptSchema.safeParse({ ...base, amount: "0" }).success).toBe(
      false,
    );
    expect(receiptSchema.safeParse({ ...base, amount: "-500" }).success).toBe(
      false,
    );
  });
});

describe("adminSettingsSchema numbers", () => {
  const base = {
    campaignTitle: "Project Emerge",
    campaignSubtitle: "Building Together",
    scripture: "Haggai 1:8",
    heroBody: "",
    visionBody: "",
    bankAccountName: "Church",
    bankAccountNumber: "4005900458",
    bankName: "Moniepoint",
    contactPhone: "",
    contactEmail: "",
    contactAddress: "",
    oneTimeGraceDays: "30",
    monthlyIntervalMonths: "1",
    behindGraceDays: "3",
  };

  it("accepts a grouped goal", () => {
    const result = adminSettingsSchema.safeParse({
      ...base,
      goal: "100,000,000",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.goal).toBe(100000000);
  });

  it("gives a readable message for a bad goal", () => {
    const result = adminSettingsSchema.safeParse({ ...base, goal: "soon" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message ?? "").not.toMatch(/nan/i);
    }
  });
});
