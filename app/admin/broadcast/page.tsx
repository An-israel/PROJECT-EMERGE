import { requireAdmin } from "@/lib/auth";
import { getBroadcastRecipients, getRecentBroadcasts } from "@/lib/admin-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { audienceCounts, AUDIENCE_LABELS } from "@/lib/broadcast";
import { formatDate } from "@/lib/format";
import { BroadcastForm } from "./broadcast-form";

export const metadata = { title: "Email partners — Project Emerge" };

export default async function BroadcastPage() {
  const me = await requireAdmin();
  const [recipients, history] = await Promise.all([
    getBroadcastRecipients(),
    getRecentBroadcasts(),
  ]);
  const counts = audienceCounts(recipients);
  const optedOut = recipients.filter((r) => r.emailOptOut).length;
  const emailConfigured = Boolean(process.env.RESEND_API_KEY);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display-title text-3xl text-emerge-ink">
          Email everyone
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Write once, send to every registered user or to a specific group.
        </p>
      </div>

      {!emailConfigured && (
        <div
          role="status"
          className="rounded-lg border border-emerge-line bg-emerge-paper p-4 text-sm"
        >
          <strong>Email is not configured.</strong> Set{" "}
          <code>RESEND_API_KEY</code> and <code>RESEND_FROM_EMAIL</code> in your
          environment to deliver mail. Until then, sending here only writes the
          message to the server log.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
        </CardHeader>
        <CardContent>
          <BroadcastForm
            counts={counts}
            senderName={me.full_name}
            optedOutCount={optedOut}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent broadcasts</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing sent yet. Your first broadcast will be listed here.
            </p>
          ) : (
            <ul className="divide-y divide-emerge-line">
              {history.map((b) => (
                <li key={b.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{b.subject}</span>
                    <Badge
                      variant={
                        b.status === "sent"
                          ? "default"
                          : b.status === "partial"
                            ? "muted"
                            : b.status === "skipped"
                              ? "muted"
                              : "rejected"
                      }
                    >
                      {b.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {AUDIENCE_LABELS[b.audience]} · {b.sent_count} of{" "}
                    {b.recipient_count} delivered
                    {b.failed_count > 0 && ` · ${b.failed_count} failed`}
                    {b.sender_name && ` · by ${b.sender_name}`} ·{" "}
                    {formatDate(b.created_at.slice(0, 10))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
