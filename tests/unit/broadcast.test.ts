import { describe, it, expect } from "vitest";
import {
  audienceCounts,
  chunk,
  escapeHtml,
  firstName,
  personalize,
  selectRecipients,
  textToHtml,
  type BroadcastRecipient,
} from "@/lib/broadcast";

function person(
  overrides: Partial<BroadcastRecipient> & { id: string },
): BroadcastRecipient {
  return {
    name: "Grace Okonkwo",
    email: `${overrides.id}@example.com`,
    role: "partner",
    status: "on_track",
    emailOptOut: false,
    ...overrides,
  };
}

const people: BroadcastRecipient[] = [
  person({ id: "a", name: "Grace Okonkwo", status: "on_track" }),
  person({ id: "b", name: "Tunde Bello", status: "behind" }),
  person({ id: "c", name: "Ada Nwosu", status: "completed" }),
  person({ id: "d", name: "Church Admin", role: "admin", status: null }),
  person({ id: "e", name: "Opted Out", status: "behind", emailOptOut: true }),
];

describe("selectRecipients", () => {
  it("sends to everyone registered for the 'all' audience", () => {
    expect(selectRecipients(people, "all").map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("splits partners from admins", () => {
    expect(selectRecipients(people, "partners").map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(selectRecipients(people, "admins").map((p) => p.id)).toEqual(["d"]);
  });

  it("filters partners by derived status", () => {
    expect(selectRecipients(people, "behind").map((p) => p.id)).toEqual(["b"]);
    expect(selectRecipients(people, "on_track").map((p) => p.id)).toEqual(["a"]);
    expect(selectRecipients(people, "completed").map((p) => p.id)).toEqual([
      "c",
    ]);
  });

  it("never includes anyone who opted out, in any audience", () => {
    for (const audience of ["all", "partners", "behind"] as const) {
      expect(selectRecipients(people, audience).map((p) => p.id)).not.toContain(
        "e",
      );
    }
  });

  it("skips missing or malformed emails", () => {
    const messy = [
      person({ id: "f", email: "" }),
      person({ id: "g", email: "not-an-email" }),
      person({ id: "h", email: "real@example.com" }),
    ];
    expect(selectRecipients(messy, "all").map((p) => p.id)).toEqual(["h"]);
  });

  it("de-duplicates by email so nobody is emailed twice", () => {
    const dupes = [
      person({ id: "i", email: "same@example.com" }),
      person({ id: "j", email: "SAME@example.com" }),
    ];
    expect(selectRecipients(dupes, "all")).toHaveLength(1);
  });
});

describe("audienceCounts", () => {
  it("counts every audience the picker offers", () => {
    expect(audienceCounts(people)).toEqual({
      all: 4,
      partners: 3,
      admins: 1,
      behind: 1,
      on_track: 1,
      completed: 1,
    });
  });
});

describe("personalize", () => {
  it("fills in name and first name tokens, case and space tolerant", () => {
    const text = "Hello {{first_name}}, welcome {{ NAME }}.";
    expect(personalize(text, { name: "Grace Okonkwo" })).toBe(
      "Hello Grace, welcome Grace Okonkwo.",
    );
  });

  it("leaves an unknown token visible rather than blanking it", () => {
    expect(personalize("Hi {{amount}}", { name: "Grace" })).toBe(
      "Hi {{amount}}",
    );
  });

  it("takes the first word as the first name", () => {
    expect(firstName("  Ada  Nwosu ")).toBe("Ada");
  });
});

describe("textToHtml", () => {
  it("turns blank lines into paragraphs and single newlines into breaks", () => {
    const html = textToHtml("First para\nsecond line\n\nSecond para");
    expect(html).toContain("First para<br/>second line");
    expect(html).toContain("Second para");
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it("escapes HTML typed into the compose box", () => {
    const html = textToHtml('<script>alert("x")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops empty blocks from stray blank lines", () => {
    expect(textToHtml("\n\n\n")).toBe("");
  });

  it("escapes the characters that would break an attribute", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });
});

describe("chunk", () => {
  it("splits into batches, last one short", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns nothing for an empty list", () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it("rejects a zero size rather than looping forever", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});
