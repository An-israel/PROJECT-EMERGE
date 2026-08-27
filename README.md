# Project Emerge

A partnership and fundraising platform for **Ideal Life City** church's
_Project Emerge_ campaign. Partners choose an amount and a payment plan,
transfer by bank, and upload receipts. Admins verify receipts, watch progress,
and reach out to partners who fall behind.

- **Payment is manual** — bank transfer + receipt upload. No card/gateway.
- **The public page never shows a total raised.** Aggregate totals and the
  goal are admin-only.
- **Honor roll shows names only** (never amounts), and only for partners who opt in.

Built with **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** on
**Supabase** (Postgres, Auth, Storage), with **Resend** for optional email.

---

## Quick start (local)

```bash
pnpm install
cp .env.example .env.local     # then fill in your Supabase keys
# run migrations + seed (see below)
pnpm dev                       # http://localhost:3000
```

### 1. Create a Supabase project

At [supabase.com](https://supabase.com), create a project. From
**Settings → API**, copy into `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only — never exposed to the browser)

### 2. Run the migration

The schema, RLS policies, `is_admin()` helper, the private `receipts` storage
bucket and its policies, and the sign-up/receipt RPCs all live in
`supabase/migrations/0001_init.sql`. Later files add editable landing copy,
the broadcast email log, and so on:

```
supabase/migrations/0001_init.sql        schema, RLS, storage, RPCs
supabase/migrations/0002_hero_background.sql
supabase/migrations/0003_footer_contact.sql
supabase/migrations/0004_landing_copy.sql
supabase/migrations/0005_broadcasts.sql  broadcast log + email opt-out
supabase/migrations/0006_sms_broadcasts.sql  SMS channel + SMS opt-out
```

Apply them **in order**, either with the Supabase CLI (`supabase db push`) or by
pasting each file into the **SQL Editor** and running it. Every file after
`0001` is idempotent and safe to re-run on an existing project.

### 3. Seed settings + the first admin

```bash
# set these first (in .env.local), or accept the documented default password:
#   SEED_ADMIN_EMAIL=admin@ideallifecity.org
#   SEED_ADMIN_PASSWORD=your-strong-password
pnpm seed            # settings row + one admin user
pnpm seed --demo     # ALSO create demo partners (never in production)
```

If `SEED_ADMIN_PASSWORD` is not set, a default is used and a warning is printed
— **change it immediately after first login.**

---

## For the church admin (non-technical)

- **Log in** at `/login` with the admin email and password created during seed.
- **Change the bank details or campaign wording** any time under
  **Settings** in the admin area — the whole app reads from there.
- **Verify receipts** under **Receipts**: open the file, then Approve or
  Reject (a reason is required so the partner knows what to fix).
- **Reach a partner who is behind**: open them under **Partners**, use the
  **Contact partner** panel to call, email, or copy a ready-made reminder, then
  **Log contact** to keep a record.
- **Reach everyone** under **Reach everyone**, which has three tabs:
  - **Email** — pick who it goes to (everyone, partners only, admins only, or
    partners who are behind / on track / completed), write the message, send
    yourself a test, then send. Type `{{name}}` or `{{first_name}}` and each
    person sees their own name.
  - **Text message** — the same, by SMS. The compose box shows how many parts
    the text costs and what the whole send will cost before you send it.
  - **Phone numbers** — copy every number in a group to the clipboard in the
    form SMS gateways expect (`+234…`, comma separated), or download them as a
    CSV with names and emails. Useful for sending from your gateway's own
    dashboard, or for a WhatsApp broadcast list.

  Every send is listed under **Recent broadcasts**.
- **Promote another admin** under **Settings → Users**. The last remaining
  admin can never be removed.

---

## Running the tests

```bash
pnpm test        # unit + integration (Vitest)
pnpm test:e2e    # end-to-end (Playwright)
pnpm verify      # typecheck + lint + unit/integration + e2e, in sequence
```

- **Unit tests** need nothing external and always run.
- **Integration tests** need a real Supabase project. They **skip cleanly**
  when `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset or
  placeholders. Point them at a disposable test project to run them.
- **E2E landing tests** run without a database (the landing page falls back to
  seeded constants). The full partner→admin e2e flow runs when Supabase is
  configured and `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` are set.
- If your environment ships a pre-installed Chromium, set
  `PLAYWRIGHT_CHROMIUM_PATH` to its binary; otherwise Playwright uses its own.

---

## Deploying to Vercel + Supabase

1. Create the **Supabase** project; run `supabase/migrations/0001_init.sql`.
   The migration also creates the private `receipts` bucket and its policies.
2. Run `pnpm seed` against production (settings + first admin). Do **not** use
   `--demo` in production.
3. Create the **Vercel** project from this repo. Add every variable from
   `.env.example` in **Project → Settings → Environment Variables**
   (`SUPABASE_SERVICE_ROLE_KEY` is server-side only). Set
   `NEXT_PUBLIC_SITE_URL` to your production URL.
4. In Supabase **Auth → URL Configuration**, add your production URL to the
   redirect allow-list (needed for password reset links).
5. Deploy, then run a smoke test: open the landing page, sign up a partner,
   upload a receipt, and approve it as admin.

### Email (optional)

Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to send transactional emails
(welcome, receipt received/approved/rejected, behind reminder) and admin
broadcasts. Without a key, the app logs the intended email to the server console
and continues — no flow breaks. The admin **Email** page says plainly when email
is unconfigured, and records such a send as `skipped` rather than claiming it
was delivered.

Broadcasts go out one personalised message per recipient, batched 100 at a time
through Resend's batch endpoint with a short pause between batches to stay
within its rate limit. If a batch is rejected the messages in it are retried
individually, so one bad address cannot silence the rest. Partners who untick
**Email me campaign announcements** in their own settings are excluded from every
broadcast; their receipt emails still send.

### Bulk SMS (optional)

Set `SMS_API_KEY` (and the variables below) to text partners from the
**Reach everyone → Text message** tab. Without a key the app logs the intended
texts and tells you plainly that nothing was sent — you can still copy the
numbers from the **Phone numbers** tab and send from your gateway's dashboard.

| Variable | Meaning |
|---|---|
| `SMS_PROVIDER` | `termii` (default) or `africastalking` |
| `SMS_API_KEY` | Your gateway API key |
| `SMS_SENDER_ID` | The name recipients see, e.g. `ProjEmerge` |
| `SMS_USERNAME` | Africa's Talking only; ignored by Termii |

Two things to know before your first send:

1. **A sender ID is at most 11 characters** — that is a GSM limit, not ours.
   `Project Emerge` (14) will be rejected; `ProjEmerge` or `IdealLife` fit. It
   must also be **registered with your provider before it works** (Termii and
   Africa's Talking both review sender names, usually in a day or two). Until
   it is approved, texts either fail or arrive from a shortcode.
2. **The ₦ sign, emoji, and curly quotes pasted from Word are not in the SMS
   alphabet.** Any one of them cuts a message part from 160 characters to 70,
   so a short text silently becomes three. The compose box shows this live —
   write `N100,000` rather than `₦100,000` and keep it to one part.

Numbers are normalised to international form before sending (`08031234567` →
`+2348031234567`), so it does not matter how a partner typed theirs. Anyone
whose number cannot be read as a phone number is reported and skipped, and
partners who untick **Text me announcements** are excluded from every text.

To add another gateway, implement one `send…` function in `lib/sms.ts` and add
it to the `SmsProvider` union — the rest of the pipeline is provider-agnostic.

---

## Notes

- **Rate limiting** is a lightweight in-memory limiter, fine for a single
  region. To scale horizontally, back `lib/rate-limit.ts` with a shared store.
- **Time**: "today" and all due-date math run in `Africa/Lagos`; due/transfer
  dates are stored as plain `date` columns so no browser timezone shifts them.
- See `DECISIONS.md` for assumptions made during the build and
  `QA-CHECKLIST.md` for the manual QA results.
