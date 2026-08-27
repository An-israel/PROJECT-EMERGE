"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  sendSmsBroadcastAction,
  sendTestSmsAction,
  type BroadcastActionState,
} from "@/app/admin/broadcast/actions";
import {
  AUDIENCE_HINTS,
  AUDIENCE_LABELS,
  BROADCAST_AUDIENCES,
  MAX_SMS_LENGTH,
  personalize,
  type BroadcastAudience,
} from "@/lib/broadcast";
import { smsCost } from "@/lib/phone";
import { MessageSquare, Send } from "lucide-react";

const FORM_ID = "sms-broadcast-form";

interface Props {
  counts: Record<BroadcastAudience, number>;
  senderName: string;
  senderId: string;
  optedOutCount: number;
  unreachableCount: number;
}

export function SmsForm({
  counts,
  senderName,
  senderId,
  optedOutCount,
  unreachableCount,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [audience, setAudience] = React.useState<BroadcastAudience>("all");
  const [body, setBody] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const [state, formAction, pending] = useActionState<
    BroadcastActionState,
    FormData
  >(sendSmsBroadcastAction, {});
  const [testState, testAction, testPending] = useActionState<
    BroadcastActionState,
    FormData
  >(sendTestSmsAction, {});

  const handled = React.useRef<BroadcastActionState | null>(null);
  React.useEffect(() => {
    if (state.success && handled.current !== state) {
      handled.current = state;
      setConfirmOpen(false);
      toast({
        variant: "success",
        title: "Text sent",
        description: state.message,
      });
      setBody("");
      router.refresh();
    }
    if (state.error) setConfirmOpen(false);
  }, [state, toast, router]);

  const testHandled = React.useRef<BroadcastActionState | null>(null);
  React.useEffect(() => {
    if (testState.success && testHandled.current !== testState) {
      testHandled.current = testState;
      toast({
        variant: "success",
        title: "Test text",
        description: testState.message,
      });
    }
    if (testState.error) {
      toast({
        variant: "destructive",
        title: "Test failed",
        description: testState.error,
      });
    }
  }, [testState, toast]);

  const recipientCount = counts[audience] ?? 0;
  const ready = body.trim().length >= 5;
  const preview = personalize(body, { name: senderName });
  // Cost is per part, per person — a two-part text to 200 people is 400.
  const cost = smsCost(preview);
  const totalParts = cost.segments * recipientCount;

  return (
    <div className="space-y-6">
      <form id={FORM_ID} action={formAction} className="space-y-4">
        <input type="hidden" name="audience" value={audience} />

        {state.error && (
          <p role="alert" className="text-sm text-emerge-red">
            {state.error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="sms-audience">Send to</Label>
          <Select
            value={audience}
            onValueChange={(v) => setAudience(v as BroadcastAudience)}
          >
            <SelectTrigger id="sms-audience">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BROADCAST_AUDIENCES.map((a) => (
                <SelectItem key={a} value={a}>
                  {AUDIENCE_LABELS[a]} ({counts[a] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {AUDIENCE_HINTS[audience]}
            {optedOutCount > 0 &&
              ` ${optedOutCount} user(s) have opted out of texts and are never included.`}
            {unreachableCount > 0 &&
              ` ${unreachableCount} number(s) could not be read as a phone number.`}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sms-body">Message</Label>
          <Textarea
            id="sms-body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_SMS_LENGTH}
            rows={5}
            placeholder={
              "Hello {{first_name}}, thank you for building with us. Transfer and upload your receipt at projectemerge.org — Ideal Life City"
            }
            required
          />
          <p className="text-xs text-muted-foreground">
            Sent from <strong>{senderId}</strong>. Use{" "}
            <code>{"{{first_name}}"}</code> or <code>{"{{name}}"}</code> to
            greet each person by name. There is no unsubscribe link in a text,
            so keep it short and welcome.
          </p>
        </div>
      </form>

      <div className="rounded-lg border border-emerge-line bg-emerge-paper p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>{cost.characters}</strong> characters ·{" "}
            <strong>{cost.segments}</strong>{" "}
            {cost.segments === 1 ? "part" : "parts"} · {cost.encoding}
          </span>
          <span className="text-muted-foreground">
            {cost.remaining} left in this part
          </span>
        </div>
        {cost.encoding === "UCS-2" && (
          <p className="mt-2 text-xs text-muted-foreground">
            This message contains a character outside the plain SMS alphabet
            (often an emoji, a ₦ sign, or a curly quote pasted from Word). That
            cuts each part from 160 characters to 70, so it costs more to send.
          </p>
        )}
        {recipientCount > 0 && ready && (
          <p className="mt-2 text-xs text-muted-foreground">
            Sending to {recipientCount}{" "}
            {recipientCount === 1 ? "person" : "people"} costs about{" "}
            <strong>{totalParts}</strong> message{totalParts === 1 ? "" : "s"} at
            your gateway ({cost.segments} × {recipientCount}).
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button type="button" disabled={!ready || recipientCount === 0}>
              <Send className="h-4 w-4" />
              Text {recipientCount} {recipientCount === 1 ? "person" : "people"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send this text?</DialogTitle>
              <DialogDescription>
                {recipientCount}{" "}
                {recipientCount === 1 ? "person" : "people"} in “
                {AUDIENCE_LABELS[audience]}” will get this text from{" "}
                {senderId}, costing about {totalParts} message
                {totalParts === 1 ? "" : "s"}. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-emerge-line bg-emerge-paper p-3 text-sm">
              {preview}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} disabled={pending}>
                {pending ? "Sending…" : "Yes, send it"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <form action={testAction}>
          <input type="hidden" name="audience" value={audience} />
          <input type="hidden" name="body" value={body} />
          <Button
            type="submit"
            variant="outline"
            disabled={!ready || testPending}
          >
            <MessageSquare className="h-4 w-4" />
            {testPending ? "Sending…" : "Text a test to me"}
          </Button>
        </form>
      </div>

      {body.trim() && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Preview</div>
          <div className="max-w-sm rounded-2xl rounded-bl-sm border border-emerge-line bg-white p-4 text-sm leading-relaxed">
            <div className="mb-1 text-xs font-semibold text-muted-foreground">
              {senderId}
            </div>
            <p className="whitespace-pre-wrap">{preview}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Tokens are shown filled in with your own name. Each person sees
            their own.
          </p>
        </div>
      )}
    </div>
  );
}
