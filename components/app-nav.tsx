import Link from "next/link";
import { signOutAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface AppNavProps {
  name: string;
  links: { href: string; label: string }[];
  homeHref: string;
}

export function AppNav({ name, links, homeHref }: AppNavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-emerge-line bg-emerge-paper/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href={homeHref} className="flex flex-col leading-none">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerge-red">
              Ideal Life City
            </span>
            <span className="display-title text-lg text-emerge-ink">
              Project Emerge
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-emerge-ink/80 hover:bg-muted hover:text-emerge-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {name}
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </form>
        </div>
      </div>
      {/* Mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-emerge-line px-4 py-2 md:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-emerge-ink/80 hover:bg-muted"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
