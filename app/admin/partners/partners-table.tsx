"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusChip } from "@/components/status-chip";
import { formatNaira } from "@/lib/format";
import {
  PLAN_LABELS,
  TIER_LABELS,
  type Plan,
  type Tier,
  type DerivedStatus,
} from "@/lib/constants";

export interface PartnerTableRow {
  id: string;
  name: string;
  phone: string;
  tier: Tier;
  plan: Plan;
  pledged: number;
  verified: number;
  progressPct: number;
  status: DerivedStatus;
}

export function PartnersTable({
  rows,
  initialStatus,
}: {
  rows: PartnerTableRow[];
  initialStatus?: string;
}) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string>(initialStatus ?? "all");
  const [plan, setPlan] = React.useState<string>("all");

  const filtered = rows.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (status !== "all" && r.status !== status) return false;
    if (plan !== "all" && r.plan !== plan) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search partners by name"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="on_track">On track</SelectItem>
            <SelectItem value="behind">Behind</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger aria-label="Filter by plan">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {Object.entries(PLAN_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-emerge-line p-10 text-center text-muted-foreground">
          <p className="font-medium text-emerge-ink">No partners match</p>
          <p className="mt-1 text-sm">
            Try clearing the search or filters. New partners appear here as they
            sign up.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Pledged</TableHead>
              <TableHead className="text-right">Verified</TableHead>
              <TableHead className="text-right">Progress</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/admin/partners/${r.id}`}
                    className="font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.phone}
                </TableCell>
                <TableCell>{TIER_LABELS[r.tier]}</TableCell>
                <TableCell>{PLAN_LABELS[r.plan]}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatNaira(r.pledged)}
                </TableCell>
                <TableCell className="text-right font-mono text-emerge-green">
                  {formatNaira(r.verified)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {Math.round(r.progressPct)}%
                </TableCell>
                <TableCell className="text-right">
                  <StatusChip status={r.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
