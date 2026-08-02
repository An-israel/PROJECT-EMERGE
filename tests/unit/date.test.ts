import { describe, it, expect } from "vitest";
import { addDays, addMonths, compareISODate, toISODate } from "@/lib/date";
import { todayInCampaignTZ } from "@/lib/time";

describe("date helpers", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-01-15", 30)).toBe("2026-02-14");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); // leap year
  });

  it("adds months and clamps to month end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-01-15", 12)).toBe("2027-01-15");
  });

  it("compares ISO dates", () => {
    expect(compareISODate("2026-01-01", "2026-01-02")).toBe(-1);
    expect(compareISODate("2026-01-02", "2026-01-01")).toBe(1);
    expect(compareISODate("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("serializes a Date to ISO in UTC", () => {
    expect(toISODate(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05");
  });
});

describe("todayInCampaignTZ", () => {
  it("returns the Lagos calendar date, not UTC, near midnight", () => {
    // 2026-01-01 00:30 UTC is 2026-01-01 01:30 in Lagos (UTC+1).
    expect(todayInCampaignTZ(new Date("2026-01-01T00:30:00Z"))).toBe(
      "2026-01-01",
    );
    // 2025-12-31 23:30 UTC is 2026-01-01 00:30 in Lagos -> rolls to new day.
    expect(todayInCampaignTZ(new Date("2025-12-31T23:30:00Z"))).toBe(
      "2026-01-01",
    );
  });
});
