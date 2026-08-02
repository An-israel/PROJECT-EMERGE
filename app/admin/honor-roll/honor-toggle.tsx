"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { toggleHonorRollAction } from "@/app/admin/actions";
import { EyeOff } from "lucide-react";

export function HonorToggle({ userId }: { userId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function onHide() {
    setBusy(true);
    const res = await toggleHonorRollAction(userId, false);
    setBusy(false);
    if (res.success) {
      toast({ variant: "success", title: "Removed from the wall" });
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "Failed", description: res.error });
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onHide} disabled={busy}>
      <EyeOff className="h-4 w-4" /> Hide from wall
    </Button>
  );
}
