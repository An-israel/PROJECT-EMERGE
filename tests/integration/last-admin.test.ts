import { describe, it, expect, afterAll } from "vitest";
import { supabaseConfigured, adminClient, uniqueEmail } from "./helpers";

const d = supabaseConfigured ? describe : describe.skip;

d("last admin guard (integration)", () => {
  const admin = supabaseConfigured ? adminClient() : (null as unknown as ReturnType<typeof adminClient>);
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
  });

  it("cannot demote the last remaining admin, but can once another exists", async () => {
    // Count existing admins so the test is order-independent.
    const { count: adminCount } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    // Create a fresh admin for the test.
    const email = uniqueEmail("admin");
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "TestPass!2026",
      email_confirm: true,
    });
    const userId = data!.user!.id;
    created.push(userId);
    await admin.from("profiles").insert({
      id: userId,
      full_name: "Test Admin",
      email,
      phone: "08000000000",
      role: "admin",
    });

    const totalAdmins = (adminCount ?? 0) + 1;

    if (totalAdmins <= 1) {
      // This new admin is the only one — demotion must fail.
      const { error } = await admin
        .from("profiles")
        .update({ role: "partner" })
        .eq("id", userId);
      expect(error).not.toBeNull();
    } else {
      // Other admins exist — demoting this one is allowed.
      const { error } = await admin
        .from("profiles")
        .update({ role: "partner" })
        .eq("id", userId);
      expect(error).toBeNull();
    }
  });
});
