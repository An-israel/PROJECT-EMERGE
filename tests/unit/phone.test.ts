import { describe, it, expect } from "vitest";
import { isDialable, smsCost, toE164, uniqueE164 } from "@/lib/phone";

describe("toE164", () => {
  it("accepts the ways a Nigerian number is normally typed", () => {
    const expected = "+2348031234567";
    for (const typed of [
      "08031234567",
      "0803 123 4567",
      "0803-123-4567",
      "(0803) 123 4567",
      "+2348031234567",
      "+234 803 123 4567",
      "2348031234567",
      "008031234567",
      "8031234567",
    ]) {
      expect(toE164(typed), typed).toBe(expected);
    }
  });

  it("keeps a number that is already international", () => {
    expect(toE164("+447911123456")).toBe("+447911123456");
    expect(toE164("+1 415 555 2671")).toBe("+14155552671");
  });

  it("refuses what cannot be dialled rather than guessing", () => {
    for (const bad of ["", "   ", "abc", "12", "0", "080312345678901234"]) {
      expect(toE164(bad), bad).toBeNull();
    }
    expect(toE164(null)).toBeNull();
    expect(toE164(undefined)).toBeNull();
  });

  it("respects a different default country code", () => {
    expect(toE164("0712345678", "254")).toBe("+254712345678");
  });

  it("isDialable agrees with toE164", () => {
    expect(isDialable("08031234567")).toBe(true);
    expect(isDialable("nope")).toBe(false);
  });
});

describe("uniqueE164", () => {
  it("canonicalises, de-duplicates, and keeps the original order", () => {
    expect(
      uniqueE164([
        "08031234567",
        "+234 803 123 4567",
        "08039999999",
        "not a number",
        null,
      ]),
    ).toEqual(["+2348031234567", "+2348039999999"]);
  });
});

describe("smsCost", () => {
  it("counts a plain short message as one part", () => {
    const text = "Hello Grace, thank you for building with us.";
    const cost = smsCost(text);
    expect(cost.segments).toBe(1);
    expect(cost.encoding).toBe("GSM-7");
    expect(cost.characters).toBe(text.length);
    expect(cost.remaining).toBe(160 - text.length);
  });

  it("splits at 160 characters, then 153 per part", () => {
    expect(smsCost("a".repeat(160)).segments).toBe(1);
    expect(smsCost("a".repeat(161)).segments).toBe(2);
    expect(smsCost("a".repeat(306)).segments).toBe(2);
    expect(smsCost("a".repeat(307)).segments).toBe(3);
  });

  it("charges two characters for a GSM extension character", () => {
    expect(smsCost("€").characters).toBe(2);
    expect(smsCost("[]").characters).toBe(4);
  });

  it("drops to 70 characters per part when a character forces UCS-2", () => {
    // The Naira sign is not in the GSM alphabet — a real trap for this app.
    const naira = smsCost("Your ₦100,000 partnership");
    expect(naira.encoding).toBe("UCS-2");
    expect(smsCost("🎉").segments).toBe(1);
    expect(smsCost("🎉" + "a".repeat(70)).segments).toBe(2);
    expect(smsCost("a".repeat(70) + "é🎉").encoding).toBe("UCS-2");
  });

  it("is zero parts for an empty message", () => {
    expect(smsCost("")).toEqual({
      segments: 0,
      characters: 0,
      remaining: 160,
      encoding: "GSM-7",
    });
  });
});
