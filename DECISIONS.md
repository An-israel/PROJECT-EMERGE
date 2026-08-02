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
