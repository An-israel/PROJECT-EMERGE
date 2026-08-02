import { describe, it, expect } from "vitest";
import { formatNaira } from "@/lib/format";

describe("formatNaira", () => {
  it("formats zero", () => {
    expect(formatNaira(0)).toBe("₦0");
  });

  it("formats 100,000", () => {
    expect(formatNaira(100000)).toBe("₦100,000");
  });

  it("formats 2,000,000", () => {
    expect(formatNaira(2000000)).toBe("₦2,000,000");
  });

  it("formats 100,000,000", () => {
    expect(formatNaira(100000000)).toBe("₦100,000,000");
  });

  it("rounds to whole Naira (no decimals)", () => {
    expect(formatNaira(1000.4)).toBe("₦1,000");
    expect(formatNaira(1000.6)).toBe("₦1,001");
  });

  it("handles non-finite input gracefully", () => {
    expect(formatNaira(NaN)).toBe("₦0");
  });
});
