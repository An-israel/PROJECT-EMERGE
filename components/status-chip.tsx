import { Badge } from "@/components/ui/badge";
import { CheckCircle2, TrendingUp, AlertTriangle } from "lucide-react";
import type { DerivedStatus } from "@/lib/constants";

export function StatusChip({ status }: { status: DerivedStatus }) {
  if (status === "completed") {
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Completed
      </Badge>
    );
  }
  if (status === "behind") {
    return (
      <Badge variant="rejected">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Behind
      </Badge>
    );
  }
  return (
    <Badge variant="success">
      <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> On track
    </Badge>
  );
}

export function ReceiptStatusChip({
  status,
}: {
  status: "pending" | "approved" | "rejected";
}) {
  if (status === "approved") return <Badge variant="success">Approved</Badge>;
  if (status === "rejected") return <Badge variant="rejected">Rejected</Badge>;
  return <Badge variant="pending">Pending</Badge>;
}
