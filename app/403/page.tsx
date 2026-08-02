import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-emerge-paper px-6 text-center">
      <ShieldAlert className="h-12 w-12 text-emerge-red" aria-hidden="true" />
      <h1 className="display-title mt-4 text-4xl text-emerge-ink">
        Access denied
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        This area is for church admins only. If you are a partner, your
        dashboard is where you track your giving.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/dashboard">Go to my dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </main>
  );
}
