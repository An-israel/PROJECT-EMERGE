"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/lib/validation";
import { useToast } from "@/components/ui/use-toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const parsed = resetPasswordSchema.safeParse({
      password: form.get("password"),
      confirm: form.get("confirm"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }

    setPending(true);
    const supabase = createClient();
    // The reset link establishes a recovery session; update the password on it.
    const { error: updErr } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    setPending(false);

    if (updErr) {
      setError(
        "This reset link is invalid or has expired. Request a new one.",
      );
      return;
    }
    toast({
      variant: "success",
      title: "Password updated",
      description: "You can now log in with your new password.",
    });
    router.push("/login");
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password you will remember."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="text-sm text-emerge-red">
            {error}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
