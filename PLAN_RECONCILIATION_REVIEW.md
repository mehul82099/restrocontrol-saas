# Plan reconciliation: code prepared, production unchanged

Confirmed website subscriptions: Rs 499/month for one outlet, Rs 699/month for unlimited outlets. Both have unlimited staff and monthly orders. Rs 699 app + website and Rs 999 app + website multi-outlet remain Upcoming and cannot be requested or assigned.

## Model and seed

`src/lib/plan-catalog.json` is the shared source for UI, server seed and migration. `null` quotas mean genuinely unlimited, never a large magic integer. `priceYearly=null` means no annual offer. `isAvailable=false` blocks upcoming plan entitlements even if a bad assignment is attempted. App-plan quotas carry no purchasable rights while unavailable; review entitlements before launch.

`prisma/review-migrations/20261015_plan_unlimited.sql` makes Plan quotas/yearly price nullable and adds availability. It changes no existing values, subscriptions or customer records. It is not run by build/install/startup. Do not run Prisma schema push or the demo seed against production as part of preview work.

Both seeding entry points now use the four-plan catalogue; signup uses WEBSITE_SINGLE instead of PRO. Reads no longer auto-create an ACTIVE subscription. Missing subscription state derives a trial end from restaurant creation, not a fresh trial on each read. Existing legacy subscriptions keep their data and access until explicitly mapped.

## Dry run and local migration test

`scripts/reconcile-plan-catalog.cjs` defaults to a read-only dry run. Optional `--config=/path/reviewed.json` contains `restaurantAssignments`, an object mapping exact restaurant IDs to WEBSITE_SINGLE or WEBSITE_MULTI. There is no guessed mapping from old tier names. Upcoming app plans and assignments exceeding the one-outlet quota are rejected. It never deletes legacy plans or changes status, billing periods, mandates or payments.

`--apply` rejects all non-local database hosts. It is for isolated test databases only; production migration needs a separately reviewed procedure, backup and explicit publish approval. A serializable transaction rechecks outlet counts before assignments. Unmapped restaurants are listed for review, not silently changed.

Tests: `node tests/plan-migration-regression.cjs` validates the catalogue. DB-backed reconciliation/entitlement tests must use an isolated local database. Production data has not been altered.

## Release checklist

- Integrate the register change with the separate Google-auth PR, and Plan schema changes with the waiter/push PR. Regenerate Prisma and rerun all relevant tests on the combined branch.
- Apply reviewed schema SQL on an isolated preview DB, seed the catalogue and test signup, one-outlet enforcement, unlimited staff/orders, denied upcoming plans, expiry and unchanged legacy records.
- Review each existing restaurant assignment using actual outlet counts. Keep paid plan/status/period migration separate from payment verification. Never activate a subscription solely because its plan was selected.
- Keep annual billing disabled. Connect and test Razorpay test keys, plan IDs and verified webhook lifecycle before charging or enabling an upgrade.
- Finalise refund processing time and remaining legal/privacy details before policy publication. Hosted previews do not finalize the terms.
- Only after explicit publish approval and a supported backup, run a separately reviewed production migration and verify outcomes. Do not reuse the local-only apply command to bypass this gate.

## Refund feedback preview

The draft now requires a feedback form stating why a refund is wanted and why the customer dislikes the service. Eligible refunds are issued within 24 hours of form submission, retaining the 80% / 7-day / latest-payment rules. Bank credit timing is not promised. The public form is a client-only preview: browser validation and a demo status message, no submission, storage, email, refund or processing timer. Before publication, implement and verify authenticated intake, eligibility/payment verification, operator notification and the actual refund process. Do not present the preview button as a live request channel.

## Saved refund intake (supersedes client-only form above)

Review-only SQL: `prisma/review-migrations/20261015_refund_intake.sql`. No production SQL has been run. Apply this additive table migration on an isolated preview DB before setting `REFUND_INTAKE_ENABLED=true`. Default is disabled; anonymous visitors see a demo. Signed-in restaurant owners can save their own restaurant's form. Registered email must match their account. Payment references are unique per restaurant, so retries retain the original timestamp and due date. Daily submissions are capped at five per restaurant. Full form contents are retained in the request table, not browser storage. Final retention/deletion policy remains a release decision.

Set `REFUND_ADMIN_USER_IDS` to a reviewed comma-separated list of exact existing active operator user IDs. This is a server-side allowlist, never granted from self-registered email or restaurant Owner role. Empty allowlist denies all operator access. The operator at `/refund-admin` can read the latest 100 requests across restaurants and mark UNDER_REVIEW or DECLINED. No REFUNDED state is provided without verified money movement. The in-app pending count and queue are the notification channel: a manual Refresh is required, no email, push, polling, wake or background alert is set up. The queue must be staffed to meet the deadline; the code alone does not guarantee a response within 24 hours.

`/api/refunds` and `/api/refunds/admin` remain accessible after trial expiry, but still enforce authentication/permissions. No payment ledger lookup or bank refund exists: latest-charge eligibility, seven-day window and reference authenticity must be reviewed manually. Deadline is submittedAt + 24 hours. Displayed status/deadline is not proof of a refund. This feature never charges, refunds, cancels service or alters subscription entitlements.

Test with `DATABASE_URL=<isolated localhost DB> JWT_SECRET=<test secret> node tests/refund-intake-regression.cjs`. Apply SQL before the test; it creates and removes only its fixtures. Combined schema/register/sidebar changes from other preview PRs still require final integration checks. No new paid services or email provider were added.
