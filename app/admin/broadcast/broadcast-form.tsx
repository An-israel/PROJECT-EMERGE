"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  sendBroadcastAction,
  sendTestBroadcastAction,
  type BroadcastActionState,
} from "@/app/admin/broadcast/actions";
import {
  AUDIENCE_HINTS,
  AUDIENCE_LABELS,
  BROADCAST_AUDIENCES,
  MAX_BODY_LENGTH,
  MAX_SUBJECT_LENGTH,
  personalize,
  textToHtml,
  type BroadcastAudience,
} from "@/lib/broadcast";
import { Send, Mail } from "lucide-react";

const FORM_ID = "broadcast-form";

interface Props {
  counts: Record<BroadcastAudience, number>;
  senderName: string;
  optedOutCount: number;
}

export function BroadcastForm({ counts, senderName, optedOutCount }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [audience, setAudience] = React.useState<BroadcastAudience>("all");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const [state, formAction, pending] = useActionState<
    BroadcastActionState,
    FormData
  >(sendBroadcastAction, {});
  const [testState, testAction, testPending] = useActionState<
    BroadcastActionState,
    FormData
  >(sendTestBroadcastAction, {});

  const handled = React.useRef<BroadcastActionState | null>(null);
  React.useEffect(() => {
    if (state.success && handled.current !== state) {
      handled.current = state;
      setConfirmOpen(false);
      toast({
        variant: "success",
        title: "Broadcast sent",
        description: state.message,
      });
      setSubject("");
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
        title: "Test email",
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
  const ready = subject.trim().length >= 3 && body.trim().length >= 10;
  const preview = personalize(body, { name: senderName });

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
          <Label htmlFor="audience">Send to</Label>
          <Select
            value={audience}
            onValueChange={(v) => setAudience(v as BroadcastAudience)}
          >
            <SelectTrigger id="audience">
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
              ` ${optedOutCount} user(s) have opted out of announcements and are never included.`}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={MAX_SUBJECT_LENGTH}
            placeholder="An update on Project Emerge"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_BODY_LENGTH}
            rows={12}
            placeholder={
              "Hello {{first_name}},\n\nThank you for building with us. Here is what is happening this month…"
            }
            required
          />
          <p className="text-xs text-muted-foreground">
            Plain text only. Leave a blank line between paragraphs. Use{" "}
            <code>{"{{name}}"}</code> for a partner&apos;s full name or{" "}
            <code>{"{{first_name}}"}</code> for their first name.{" "}
            {body.length}/{MAX_BODY_LENGTH}
          </p>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button type="button" disabled={!ready || recipientCount === 0}>
              <Send className="h-4 w-4" />
              Send to {recipientCount} {recipientCount === 1 ? "person" : "people"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send this email?</DialogTitle>
              <DialogDescription>
                {recipientCount}{" "}
                {recipientCount === 1 ? "person" : "people"} in “
                {AUDIENCE_LABELS[audience]}” will receive “{subject}”. This
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
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
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="body" value={body} />
          <Button
            type="submit"
            variant="outline"
            disabled={!ready || testPending}
          >
            <Mail className="h-4 w-4" />
            {testPending ? "Sending…" : "Send a test to me"}
          </Button>
        </form>
      </div>

      {body.trim() && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Preview</div>
          <div className="rounded-lg border border-emerge-line bg-white p-5">
            <div className="mb-3 border-b border-emerge-line pb-2 text-sm font-semibold">
              {subject || "(no subject)"}
            </div>
            <div
              className="prose-sm text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: textToHtml(preview) }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Tokens are shown filled in with your own name. Each recipient sees
            their own.
          </p>
        </div>
      )}
    </div>
  );
}
