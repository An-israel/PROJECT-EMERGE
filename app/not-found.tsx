import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-emerge-paper px-6 text-center">
      <p className="display-title text-6xl text-emerge-red">404</p>
      <h1 className="mt-2 text-2xl font-bold text-emerge-ink">
        We could not find that page
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The page you are looking for may have moved. Let us take you back to
        solid ground.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </main>
  );
}
