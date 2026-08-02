import { formatNaira } from "@/lib/format";

/**
 * Horizontal thermometer toward the campaign goal. ADMIN ONLY — this is the
 * only place aggregate totals are ever shown.
 */
export function Thermometer({
  verified,
  goal,
  goalPct,
}: {
  verified: number;
  goal: number;
  goalPct: number;
}) {
  const pct = Math.max(0, Math.min(100, goalPct));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-2xl font-bold text-emerge-green">
          {formatNaira(verified)}
        </span>
        <span className="text-sm text-muted-foreground">
          of {formatNaira(goal)} · {pct.toFixed(1)}%
        </span>
      </div>
      <div
        className="mt-2 h-4 w-full overflow-hidden rounded-full bg-emerge-line"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress toward campaign goal"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerge-green to-emerge-green-bright transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
