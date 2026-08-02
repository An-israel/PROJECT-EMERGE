import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-emerge-line bg-emerge-paper/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex flex-col leading-none">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerge-red">
            Ideal Life City
          </span>
          <span className="display-title text-xl text-emerge-ink">
            Project Emerge
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Become a Partner</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
