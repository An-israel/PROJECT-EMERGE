"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  AUDIENCE_LABELS,
  BROADCAST_AUDIENCES,
  matchesAudience,
  type BroadcastAudience,
  type BroadcastRecipient,
} from "@/lib/broadcast";
import { toE164 } from "@/lib/phone";
import { Copy, Download, Phone } from "lucide-react";

/**
 * Copy the phone numbers out of Project Emerge — for a gateway's own
 * dashboard, a WhatsApp broadcast list, or the church phone.
 */
export function ContactsPanel({ people }: { people: BroadcastRecipient[] }) {
  const { toast } = useToast();
  const [audience, setAudience] = React.useState<BroadcastAudience>("all");
  const [includeOptedOut, setIncludeOptedOut] = React.useState(false);

  const inAudience = React.useMemo(
    () => people.filter((p) => matchesAudience(p, audience)),
    [people, audience],
  );

  // One row per dialable number, de-duplicated the same way sending is.
  const rows = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Array<BroadcastRecipient & { e164: string }> = [];
    for (const person of inAudience) {
      const e164 = toE164(person.phone);
      if (!e164 || seen.has(e164)) continue;
      if (!includeOptedOut && person.smsOptOut) continue;
      seen.add(e164);
      out.push({ ...person, e164 });
    }
    return out;
  }, [inAudience, includeOptedOut]);

  const optedOutCount = inAudience.filter(
    (p) => p.smsOptOut && toE164(p.phone),
  ).length;
  const unusableCount = inAudience.filter((p) => !toE164(p.phone)).length;

  async function copy(text: string, label: string) {
    if (!text) {
      toast({ variant: "destructive", title: "Nothing to copy" });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({ variant: "success", title: `${label} copied` });
    } catch {
      toast({ variant: "destructive", title: "Could not copy" });
    }
  }

  function csv(): string {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = "Name,Phone,Email,Status";
    const lines = rows.map((r) =>
      [
        escape(r.name),
        escape(r.e164),
        escape(r.email),
        escape(r.status ?? r.role),
      ].join(","),
    );
    return [header, ...lines].join("\n");
  }

  function downloadCsv() {
    const blob = new Blob([csv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `project-emerge-${audience}-contacts.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast({ variant: "success", title: "CSV downloaded" });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contacts-audience">Show</Label>
          <Select
            value={audience}
            onValueChange={(v) => setAudience(v as BroadcastAudience)}
          >
            <SelectTrigger id="contacts-audience">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BROADCAST_AUDIENCES.map((a) => (
                <SelectItem key={a} value={a}>
                  {AUDIENCE_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={includeOptedOut}
              onCheckedChange={(v) => setIncludeOptedOut(Boolean(v))}
              className="mt-0.5"
            />
            <span>
              Include the {optedOutCount} who opted out of texts.
              <span className="block text-xs text-muted-foreground">
                They asked not to be texted announcements. Only include them for
                something they would expect, like a personal call.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() =>
            copy(rows.map((r) => r.e164).join(", "), `${rows.length} numbers`)
          }
          disabled={rows.length === 0}
        >
          <Phone className="h-4 w-4" />
          Copy {rows.length} phone {rows.length === 1 ? "number" : "numbers"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => copy(csv(), "Contacts")}
          disabled={rows.length === 0}
        >
          <Copy className="h-4 w-4" />
          Copy as CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={downloadCsv}
          disabled={rows.length === 0}
        >
          <Download className="h-4 w-4" />
          Download CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Numbers are copied in international form (+234…), comma separated —
        the form every SMS gateway accepts.
        {unusableCount > 0 &&
          ` ${unusableCount} number(s) in this group could not be read as a phone number and are left out.`}
      </p>

      <div className="max-h-80 overflow-y-auto rounded-lg border border-emerge-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-emerge-paper text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Phone</th>
              <th className="px-3 py-2 font-semibold">Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Nobody in this group has a number we can text.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-emerge-line">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 font-mono">{r.e164}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.email}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
