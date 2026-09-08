# Decisions & Assumptions

This file records assumptions made where the build spec left room for
interpretation, per the instruction to choose the simplest option for a
non-technical church admin and note it here.

## Stack & scaffolding

- **Next.js 15 (App Router) + React 19**, TypeScript, Tailwind 3, pnpm — as
  specified. shadcn/ui components are hand-vendored into `components/ui` (the
  standard shadcn approach) rather than pulled via the CLI, so the repo is
  self-contained and installs offline-friendly.
- **Package manager:** pnpm, with `onlyBuiltDependencies` limited to `esbuild`
  and `sharp` so installs don't run arbitrary post-install scripts.

## Business logic

- **Rounding:** base installments floor to whole Naira; the final installment
  absorbs the remainder so the schedule always sums exactly to the pledge
  (spec 7.1). Verified in unit tests across every tier × plan.
- **Month arithmetic:** adding months clamps to the last valid day of the
  target month (e.g. Jan 31 + 1 month → Feb 28/29) to avoid invalid dates.
- **"Today":** computed in `Africa/Lagos` on the server via `Intl`
  (`lib/time.ts`). Due dates and transfer dates are stored as plain `date`
  columns and compared as `YYYY-MM-DD` strings, so no browser timezone can
  shift a due date (spec 10).
- **Next due** is the earliest installment strictly after today. **Expected to
  date** counts installments whose `due_date + behind_grace_days <= today`.

## Honor roll

- Public wall shows `honor_roll_name` when set, otherwise `full_name`, and only
  for `show_on_honor_roll = true`. Amounts are never selected in the public
  query path.

## Aggregate visibility

- Aggregate totals and the goal are computed only in admin server code using the
  service role. There is no partner-facing route, query, or API that returns
  `total_verified`, `total_pledged`, `total_pending`, or `goal_pct`. RLS on
  `settings` hides the `goal` column from partners via a public-safe view.

## Auth & atomic sign up

- Account + profile + partnership + installments are created in one server
  action using the service role. Because Supabase JS has no multi-statement
  transaction, atomicity is provided by a single Postgres RPC
  (`create_partner_signup`) that does all inserts in one function body and
  raises (rolling back) on any failure. If the RPC fails after the auth user is
  created, the server action deletes the orphaned auth user as compensation.

## Email

- Resend is optional. When `RESEND_API_KEY` is absent, every send logs the
  intended email to the server console and returns success, so no flow throws.

## Broadcast email

- **Audiences, not a mailing list.** There is no separate subscriber table:
  the audience is derived live from `profiles` plus the same progress math the
  admin dashboard uses, so "partners who are behind" is always current at the
  moment of sending.
- **One message per recipient**, not one message with many recipients, so
  addresses are never disclosed to each other and `{{name}}` /
  `{{first_name}}` can be personalised. Sent in batches of 100 via Resend's
  batch endpoint; a rejected batch is retried one message at a time so a single
  bad address cannot silence the rest.
- **Plain text in, escaped HTML out.** Admins compose plain text; blank lines
  become paragraphs. No HTML is accepted from the compose box, so a pasted
  fragment cannot break (or inject into) the email.
- **Consent.** Partners can untick "Email me campaign announcements"
  (`profiles.email_opt_out`), which excludes them from every broadcast in every
  audience. Transactional mail about their own receipts ignores the flag — it
  is not marketing.
- **Honest reporting.** With no API key the app cannot deliver, so the send is
  recorded as `skipped` and the admin is told the message was only logged.
  Partial failures are recorded as `partial` with per-address counts, rather
  than reported as a clean success.
- **Every send is logged** to `broadcasts` (audience, subject, body, counts,
  who sent it), so the church has a record of what went out. Test sends to
  yourself are not logged — they are a preview, not a broadcast.
- **Rate limited** to 5 broadcasts per admin per 10 minutes, using the same
  in-memory limiter as the rest of the app — a guard against a double-click or
  a slipped finger mailing everyone twice.

## Bulk SMS

- **Provider-agnostic, two gateways included.** `lib/sms.ts` mirrors
  `lib/email.ts`: Termii (default) and Africa's Talking, chosen with
  `SMS_PROVIDER`, both common in Nigeria and both supporting a registered
  alphanumeric sender name. Adding a third is one function. The church is not
  locked to whichever account they open first.
- **Numbers are normalised, not trusted.** Partners type `08031234567`,
  `+234 803 123 4567`, or `234-803-123-4567`; `lib/phone.ts` converts each to
  E.164 before sending and uses that as the de-duplication key, so one person
  with two accounts is texted once. A number that cannot be dialled is
  reported and skipped rather than sent and silently lost.
- **Sender ID is 11 characters, and that is a GSM limit.** `Project Emerge` is
  14 and would be rejected, so the default is `ProjEmerge`; the README says it
  must be registered with the provider before it works.
- **Cost is shown before sending, not after.** SMS is billed per 160-character
  part per recipient, and one `₦`, emoji, or curly quote flips the message to
  UCS-2 and cuts each part to 70 characters. `smsCost()` computes parts and
  encoding, and the compose box shows "N parts × M people" in the confirm
  dialog. Unit tested at the 160/153 and 70/67 boundaries.
- **One text per recipient**, sent individually with a short pause, because
  each message is personalised. A failed number is recorded against itself and
  the rest still go.
- **A separate opt-out from email** (`profiles.sms_opt_out`). Someone may
  welcome an email newsletter and not want texts; the two are independent.
  Copying numbers respects it by default, with a deliberate opt-in to include
  those who opted out (for a personal call, not a blast) — because copied
  numbers leave the app and its consent rules behind.
- **Copying numbers is a first-class feature**, not a workaround: it is how
  the church can use a gateway's own dashboard, or build a WhatsApp broadcast
  list, without exporting the whole database. Numbers copy in E.164, comma
  separated — what every gateway accepts.

## Receipt upload path

- **The browser uploads straight to Supabase Storage; the Server Action only
  receives the resulting object path.** Passing the file through the action
  looked simpler but could never work in production: a Next.js Server Action
  caps the entire request body at 1MB by default, and Vercel rejects any
  request over 4.5MB regardless — while an ordinary phone photo of a bank
  receipt is 2–5MB. Partners hit a framework-level rejection before our code
  ran, so no validation message could ever explain it.
- **The path is the permission.** Storage RLS (`receipts insert own`) already
  restricts a partner to `{their uuid}/…`, so the browser upload is safe. The
  server then re-derives the folder from the session and refuses any path
  outside it, so a client cannot claim someone else's file.
- **Size and type are still checked on the server**, read back from the stored
  object's metadata rather than taken on trust from the browser. A file that
  fails is deleted, not left orphaned.
- **An empty `type` is no longer a rejection.** Some Android pickers report no
  MIME type at all; we fall back to the file extension instead of telling a
  partner their JPEG is not a JPEG.
- Hero backgrounds still post through a Server Action (the branding bucket is
  admin-only and the files are chosen on a desktop), so `bodySizeLimit` is
  raised to 4MB and the advertised image limit lowered from 8MB to match what
  the platform will actually carry.

## Rate limiting

- Sign-up and receipt-upload endpoints use a lightweight in-memory fixed-window
  limiter (per IP). This is adequate for a single-region church deployment; a
  note in the README explains swapping in a shared store if scaled out.

## Testing scope

- **Unit tests (Vitest)** run with no external services and are always green.
- **Integration tests (Vitest)** and **e2e tests (Playwright)** require a
  reachable Supabase project (env vars set). They are written to the spec and
  **skip themselves cleanly** with an explanatory message when those env vars
  are absent, so `pnpm verify` never fails purely due to missing local infra.
  With Supabase configured they execute the full flows in spec section 13.
