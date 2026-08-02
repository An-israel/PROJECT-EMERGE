import { describe, it, expect } from "vitest";
import { reminderMessage, whatsappMessage } from "@/lib/messages";

const ctx = {
  name: "Grace Okonkwo",
  behindBy: 150000,
  bankAccountName: "IdealLife Global City Outreach - Project",
  bankAccountNumber: "4005900458",
  bankName: "Moniepoint",
};

describe("reminder messages", () => {
  it("includes the partner name, amount behind, and bank details", () => {
    const msg = reminderMessage(ctx);
    expect(msg).toContain("Grace Okonkwo");
    expect(msg).toContain("₦150,000");
    expect(msg).toContain("4005900458");
    expect(msg).toContain("Moniepoint");
  });

  it("whatsapp variant is a single line with the essentials", () => {
    const msg = whatsappMessage(ctx);
    expect(msg).not.toContain("\n");
    expect(msg).toContain("Grace Okonkwo");
    expect(msg).toContain("₦150,000");
    expect(msg).toContain("4005900458");
  });
});
