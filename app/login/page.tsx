import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in — Project Emerge" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to track your partnership."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-semibold text-white underline">
            Become a Partner
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
