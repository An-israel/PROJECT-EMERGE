"use client";

import * as React from "react";
import { formatNaira } from "@/lib/format";

interface RisingColumnProps {
  progressPct: number;
  verifiedTotal: number;
  remaining: number;
  amount: number;
}

/**
 * Signature element (spec section 4): a vertical column — a stylized tent /
 * pillar — that fills from the bottom in green as verified payments accumulate.
 * The fill animates on mount unless the user prefers reduced motion.
 */
export function RisingColumn({
  progressPct,
  verifiedTotal,
  remaining,
  amount,
}: RisingColumnProps) {
  const pct = Math.max(0, Math.min(100, progressPct));
  const [fill, setFill] = React.useState(0);

  React.useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setFill(pct);
      return;
    }
    const id = requestAnimationFrame(() => setFill(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div className="flex items-stretch gap-6">
      {/* The rising column */}
      <div
        className="relative flex w-24 shrink-0 flex-col justify-end overflow-hidden rounded-t-[2rem] rounded-b-lg border-2 border-emerge-ink/10 bg-emerge-paper"
        style={{ minHeight: 220 }}
        role="img"
        aria-label={`Your building is ${Math.round(pct)} percent complete`}
      >
        {/* roof notch to read as a tent/pillar */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-emerge-ink/5 to-transparent"
        />
        <div
          className="rise-column-fill w-full bg-gradient-to-t from-emerge-green to-emerge-green-bright transition-[height] duration-1000 ease-out"
          style={{ height: `${fill}%` }}
        >
          <div className="flex h-full items-start justify-center pt-2">
            <span className="font-mono text-sm font-bold text-white drop-shadow">
              {Math.round(pct)}%
            </span>
          </div>
        </div>
      </div>

      {/* Figures beside it */}
      <div className="flex flex-col justify-center gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Verified
          </div>
          <div className="font-mono text-2xl font-bold text-emerge-green">
            {formatNaira(verifiedTotal)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Remaining
          </div>
          <div className="font-mono text-xl font-semibold">
            {formatNaira(remaining)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Your partnership
          </div>
          <div className="font-mono text-lg">{formatNaira(amount)}</div>
        </div>
      </div>
    </div>
  );
}
