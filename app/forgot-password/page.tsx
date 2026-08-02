"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestResetAction, type ResetRequestState } from "./actions";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<
    ResetRequestState,
    FormData
  >(requestResetAction, {});

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will email you a link to set a new password."
      footer={
        <Link href="/login" className="font-semibold text-white underline">
          Back to log in
        </Link>
      }
    >
      {state.sent ? (
        <p className="rounded-md bg-emerge-green/10 px-3 py-3 text-sm text-emerge-green">
          If an account exists for that email, a reset link is on its way. Check
          your inbox.
        </p>
      ) : (
        <form action={formAction} className="space-y-4">
          {state.error && (
            <p role="alert" className="text-sm text-emerge-red">
              {state.error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
