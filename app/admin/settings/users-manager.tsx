"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { setUserRoleAction } from "@/app/admin/actions";
import type { Profile } from "@/lib/supabase/types";

export function UsersManager({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const adminCount = users.filter((u) => u.role === "admin").length;

  async function setRole(userId: string, role: "admin" | "partner") {
    setBusy(userId);
    const res = await setUserRoleAction(userId, role);
    setBusy(null);
    if (res.success) {
      toast({
        variant: "success",
        title: role === "admin" ? "Promoted to admin" : "Set back to partner",
      });
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "Failed", description: res.error });
    }
  }

  return (
    <ul className="divide-y divide-emerge-line">
      {users.map((u) => {
        const isLastAdmin = u.role === "admin" && adminCount <= 1;
        return (
          <li
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div>
              <div className="font-medium">
                {u.full_name}
                {u.id === currentUserId && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (you)
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">{u.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={u.role === "admin" ? "default" : "muted"}>
                {u.role}
              </Badge>
              {u.role === "partner" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRole(u.id, "admin")}
                  disabled={busy === u.id}
                >
                  Make admin
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRole(u.id, "partner")}
                  disabled={busy === u.id || isLastAdmin}
                  title={
                    isLastAdmin
                      ? "You cannot demote the last remaining admin"
                      : undefined
                  }
                >
                  Set to partner
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
