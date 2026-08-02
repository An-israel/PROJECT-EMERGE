"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label: string;
  toastMessage?: string;
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
}

export function CopyButton({
  value,
  label,
  toastMessage,
  variant = "outline",
  className,
}: CopyButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({
        variant: "success",
        title: toastMessage ?? "Copied",
        description: `${label} copied to your clipboard.`,
      });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        variant: "destructive",
        title: "Could not copy",
        description: "Copy it manually instead.",
      });
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      onClick={onCopy}
      className={cn("gap-1.5", className)}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      Copy
    </Button>
  );
}
