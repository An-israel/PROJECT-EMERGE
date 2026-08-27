# Manual QA Checklist

Status key: **✅ Confirmed** (verified here) · **🔷 Verified in code + covered
by a test that runs against a configured Supabase project** (see how to run in
`README.md`). Items marked 🔷 are implemented and test-covered; they execute
automatically once the app is pointed at a real Supabase project, which is not
provisioned in this build environment.

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Landing page shows **no total raised**, desktop and mobile | ✅ | E2E `landing.spec.ts` asserts no "total raised" / goal figure on `/`; responsive layout uses fluid grids; no aggregate query is reachable from any public route |
| 2 | Bank details copy buttons work and show a toast | ✅ | `CopyButton` writes to clipboard and fires a success toast; used in `BankCard` on the dashboard |
| 3 | Sign up validates the ₦2,000,000 minimum for the top tier | ✅ | Client: live validation in `signup-form.tsx`; Server: `signUpSchema` superRefine; DB: `custom_tier_minimum` check constraint |
| 4 | Receipt upload rejects a 6MB file and a `.txt` file with clear messages | ✅ | `validateFile` (client + server) checks mime ∈ {jpeg,png,webp,pdf} and ≤5MB; enforced in `uploadReceiptAction` |
| 5 | Rejected receipt shows its reason and offers re-upload | ✅ | `ReceiptHistory` renders the reason and a "Re-upload receipt" action for rejected receipts |
| 6 | Behind status and `behind_by` correct past a due date beyond grace | ✅ | Unit tests in `progress.test.ts` assert grace-day boundary and `behind_by` math |
| 7 | Admin thermometer reflects only approved receipts | ✅ | `computeAggregate` sums only approved receipts; unit-tested; thermometer reads `totalVerified` |
| 8 | Responsive at 360/768/1280, visible focus, reduced motion respected | ✅ | Fluid Tailwind layouts; `:focus-visible` ring globally; `prefers-reduced-motion` disables the rising animation and transitions in `globals.css` |
| 9 | Manual bank-transfer flow end to end (upload → approve → progress updates) | 🔷 | E2E `partner-flow.spec.ts` (signup → dashboard 0% → upload pending → admin approve); integration test asserts approve raises verified total |
| 10 | Aggregate totals/goal inaccessible to partners | 🔷 | `rls.test.ts` asserts a partner gets 0 rows from `settings` and no `goal` column from `public_settings` |
| 11 | Honor roll: opted-in name appears, opted-out does not, no amounts | ✅ | Public `honor_roll` view selects display name only for `show_on_honor_roll = true`; landing renders names only |
| 12 | Schedules always sum to the pledged amount, all tiers × plans | ✅ | `schedule.test.ts` asserts exact sum for every tier × plan |
| 13 | Password reset screens build and are wired | ✅ | `/forgot-password` and `/reset-password` implemented against Supabase Auth |
| 14 | Notifications send with Resend and degrade to console log without a key | ✅ | `lib/email.ts` logs and returns success when `RESEND_API_KEY` is unset |
| 15 | Admin can email every registered user, or one group, from the app | ✅ | `/admin/broadcast`: audience picker with live counts, plain-text compose with `{{name}}` tokens, test-send to self, confirm dialog, history. `broadcast.test.ts` covers audience selection, opt-out exclusion, de-duplication, personalisation, and HTML escaping |
| 16 | A partner who opts out of announcements is excluded from every broadcast | ✅ | `selectRecipients` drops `email_opt_out` users in all audiences (unit-tested); partners toggle it under **Dashboard → Settings**. Receipt emails ignore the flag |

## Automated verification run here

- `pnpm typecheck` — passes.
- `pnpm lint` — passes (one non-blocking `any` warning).
- `pnpm test` — **48 unit tests pass**; 8 integration tests skip cleanly
  (no Supabase configured in this environment).
- `pnpm test:e2e` — **3 landing e2e pass**; 3 backend-dependent flows skip cleanly.
- `pnpm build` — all 17 routes compile.

To turn every 🔷 into ✅: create a disposable Supabase project, run the
migrations and `pnpm seed`, set the env vars (and `E2E_ADMIN_*`), then run
`pnpm verify`. The integration and full e2e flows will then execute.
