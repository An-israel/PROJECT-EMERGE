import { requireAdmin } from "@/lib/auth";
import { getBroadcastRecipients, getRecentBroadcasts } from "@/lib/admin-data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { audienceCounts, AUDIENCE_LABELS } from "@/lib/broadcast";
import { toE164 } from "@/lib/phone";
import { smsConfig } from "@/lib/sms";
import { formatDate } from "@/lib/format";
import { BroadcastForm } from "./broadcast-form";
import { SmsForm } from "./sms-form";
import { ContactsPanel } from "./contacts-panel";

export const metadata = { title: "Reach everyone — Project Emerge" };

export default async function BroadcastPage() {
  const me = await requireAdmin();
  const [recipients, history] = await Promise.all([
    getBroadcastRecipients(),
    getRecentBroadcasts(),
  ]);

  const emailCounts = audienceCounts(recipients, "email");
  const smsCounts = audienceCounts(recipients, "sms");
  const emailOptedOut = recipients.filter((r) => r.emailOptOut).length;
  const smsOptedOut = recipients.filter((r) => r.smsOptOut).length;
  const unreachableByPhone = recipients.filter((r) => !toE164(r.phone)).length;

  const emailConfigured = Boolean(process.env.RESEND_API_KEY);
  const sms = smsConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display-title text-3xl text-emerge-ink">
          Reach everyone
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Email or text every registered partner, or copy their numbers to use
          elsewhere.
        </p>
      </div>

      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="sms">Text message</TabsTrigger>
          <TabsTrigger value="numbers">Phone numbers</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-6">
          {!emailConfigured && (
            <Notice>
              <strong>Email is not configured.</strong> Set{" "}
              <code>RESEND_API_KEY</code> and <code>RESEND_FROM_EMAIL</code> in
              your environment to deliver mail. Until then, sending here only
              writes the message to the server log.
            </Notice>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Compose an email</CardTitle>
            </CardHeader>
            <CardContent>
              <BroadcastForm
                counts={emailCounts}
                senderName={me.full_name}
                optedOutCount={emailOptedOut}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="space-y-6">
          {!sms && (
            <Notice>
              <strong>No SMS gateway is configured.</strong> Set{" "}
              <code>SMS_API_KEY</code>, <code>SMS_PROVIDER</code> and{" "}
              <code>SMS_SENDER_ID</code> in your environment (see the README for
              registering the sender name). Until then, sending here only writes
              the message to the server log — you can still copy the numbers
              from the <strong>Phone numbers</strong> tab and send from your
              gateway&apos;s own dashboard.
            </Notice>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Compose a text message</CardTitle>
            </CardHeader>
            <CardContent>
              <SmsForm
                counts={smsCounts}
                senderName={me.full_name}
                senderId={sms?.senderId ?? "ProjEmerge"}
                optedOutCount={smsOptedOut}
                unreachableCount={unreachableByPhone}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numbers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Phone numbers</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactsPanel people={recipients} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                    <span className="font-medium">
                      {b.channel === "sms" ? b.body : b.subject}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {b.channel === "sms" ? "SMS" : "Email"}
                      </Badge>
                      <Badge
                        variant={
                          b.status === "sent"
                            ? "default"
                            : b.status === "partial" || b.status === "skipped"
                              ? "muted"
                              : "rejected"
                        }
                      >
                        {b.status}
                      </Badge>
                    </div>
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

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-emerge-line bg-emerge-paper p-4 text-sm"
    >
      {children}
    </div>
  );
}
