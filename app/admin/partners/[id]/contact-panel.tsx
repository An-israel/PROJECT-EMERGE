"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  logContactAction,
  sendBehindReminderAction,
  type AdminActionState,
} from "@/app/admin/actions";
import { reminderMessage, whatsappMessage } from "@/lib/messages";
import { Phone, Mail, Copy, MessageCircle, Send } from "lucide-react";

interface ContactPanelProps {
  partnerId: string;
  name: string;
  email: string;
  phone: string;
  behindBy: number;
  bankAccountName: string;
  bankAccountNumber: string;
  bankName: string;
  canRemind: boolean;
}

export function ContactPanel(props: ContactPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState<
    AdminActionState,
    FormData
  >(logContactAction, {});
  const prev = React.useRef(false);
  const [reminding, setReminding] = React.useState(false);

  React.useEffect(() => {
    if (state.success && !prev.current) {
      prev.current = true;
      toast({ variant: "success", title: "Contact logged" });
      router.refresh();
    }
    if (!state.success) prev.current = false;
  }, [state, toast, router]);

  const ctx = {
    name: props.name,
    behindBy: props.behindBy,
    bankAccountName: props.bankAccountName,
    bankAccountNumber: props.bankAccountNumber,
    bankName: props.bankName,
  };

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ variant: "success", title: `${label} copied` });
    } catch {
      toast({ variant: "destructive", title: "Could not copy" });
    }
  }

  async function onRemind() {
    setReminding(true);
    const res = await sendBehindReminderAction(props.partnerId);
    setReminding(false);
    if (res.success) {
      toast({
        variant: "success",
        title: "Reminder sent",
        description:
          "If email is configured it was emailed; otherwise it was logged on the server.",
      });
    } else {
      toast({ variant: "destructive", title: "Failed", description: res.error });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`tel:${props.phone}`}>
            <Phone className="h-4 w-4" /> Call
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={`mailto:${props.email}`}>
            <Mail className="h-4 w-4" /> Email
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => copy(whatsappMessage(ctx), "WhatsApp message")}
        >
          <MessageCircle className="h-4 w-4" /> Copy WhatsApp message
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => copy(reminderMessage(ctx), "Reminder message")}
        >
          <Copy className="h-4 w-4" /> Copy reminder message
        </Button>
        {props.canRemind && (
          <Button
            type="button"
            variant="success"
            size="sm"
            onClick={onRemind}
            disabled={reminding}
          >
            <Send className="h-4 w-4" /> Send behind reminder
          </Button>
        )}
      </div>

      <form action={formAction} className="space-y-3 rounded-lg border border-emerge-line p-4">
        <input type="hidden" name="partnerId" value={props.partnerId} />
        <div className="text-sm font-semibold">Log a contact</div>
        {state.error && (
          <p role="alert" className="text-sm text-emerge-red">
            {state.error}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="method">Method</Label>
            <MethodSelect />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" name="note" rows={2} />
          </div>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Log contact"}
        </Button>
      </form>
    </div>
  );
}

function MethodSelect() {
  const [value, setValue] = React.useState("phone");
  return (
    <>
      <input type="hidden" name="method" value={value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id="method">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="phone">Phone</SelectItem>
          <SelectItem value="email">Email</SelectItem>
          <SelectItem value="whatsapp">WhatsApp</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}
