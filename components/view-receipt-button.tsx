"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getReceiptSignedUrl } from "@/app/dashboard/actions";
import { Eye } from "lucide-react";

export function ViewReceiptButton({
  receiptId,
  variant = "outline",
  size = "sm",
}: {
  receiptId: string;
  variant?: "outline" | "ghost" | "secondary";
  size?: "sm" | "default";
}) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  async function onView() {
    setLoading(true);
    const res = await getReceiptSignedUrl(receiptId);
    setLoading(false);
    if (res.url) {
      window.open(res.url, "_blank", "noopener,noreferrer");
    } else {
      toast({
        variant: "destructive",
        title: "Could not open file",
        description: res.error ?? "Please try again.",
      });
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={onView} disabled={loading}>
      <Eye className="h-4 w-4" /> {loading ? "Opening…" : "View"}
    </Button>
  );
}
