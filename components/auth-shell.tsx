import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-emerge-ink px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerge-gold">
            Ideal Life City
          </span>
          <div className="display-title text-3xl text-white">
            Project Emerge
          </div>
        </Link>
        <div className="rounded-2xl border border-emerge-line bg-card p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold text-emerge-ink">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
        {footer && (
          <div className="mt-6 text-center text-sm text-white/70">{footer}</div>
        )}
      </div>
    </main>
  );
}
