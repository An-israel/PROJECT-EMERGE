import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNaira, formatDate } from "@/lib/format";
import type { Installment } from "@/lib/supabase/types";
import type { InstallmentRowState } from "@/lib/progress";

function StateBadge({ state }: { state: InstallmentRowState }) {
  if (state === "met") return <Badge variant="success">Met</Badge>;
  if (state === "overdue") return <Badge variant="rejected">Overdue</Badge>;
  return <Badge variant="muted">Due soon</Badge>;
}

export function ScheduleTable({
  installments,
  rowStates,
}: {
  installments: Installment[];
  rowStates: InstallmentRowState[];
}) {
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((i, idx) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono">{i.sequence}</TableCell>
                <TableCell>{formatDate(i.due_date)}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatNaira(Number(i.amount))}
                </TableCell>
                <TableCell className="text-right">
                  <StateBadge state={rowStates[idx]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile stacked cards */}
      <ul className="space-y-2 sm:hidden">
        {installments.map((i, idx) => (
          <li
            key={i.id}
            className="flex items-center justify-between rounded-lg border border-emerge-line bg-white p-3"
          >
            <div>
              <div className="text-xs text-muted-foreground">
                Payment {i.sequence} · {formatDate(i.due_date)}
              </div>
              <div className="font-mono font-semibold">
                {formatNaira(Number(i.amount))}
              </div>
            </div>
            <StateBadge state={rowStates[idx]} />
          </li>
        ))}
      </ul>
    </>
  );
}
