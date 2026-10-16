# Combined release review - no merge or publish yet

Current main baseline: 384902c51f91c4f7f92f24b3c8fee55b8836e811. Combined snapshots: #7 8b03e77, #8 0570fcf, #9 6fccd80, #10 75516f1, #11 baea565. This draft contains the integration fixes; do not independently merge the old PR heads over it. No live changes have been made.

## First safe release scope, subject to approved migration and smoke tests

- Remove visible demo credentials and block new password/Google demo sign-ins. Demo database rows are not deleted. Old demo session tokens are not deliberately revoked by this change; they expire within their existing lifetime.
- Existing non-demo email/password logins, owner/manager staff invites (single-use, 48h, preset role), waiter-only unpaid order entry/ready tickets, staff attendance and low-frequency revision polling.
- Without production WEB_PUSH_* config, browser push stays disabled; visible online polling uses the documented two-minute fallback, longer under browser/network delay. No claim of instant or background delivery.
- Without GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET, Google buttons stay hidden. Invites can still use the existing password path. Do not claim Google sign-in works until a real authorised round trip is tested.
- Keep REFUND_INTAKE_ENABLED unset/false and REFUND_ADMIN_USER_IDS unset for this release: form stays demo, no stored intake or global operator access. No automatic 24-hour fulfilment, email or refunds.
- Keep RAZORPAY_TEST_ENABLED unset/false and all RAZORPAY_TEST_* out of production. TEST routes also refuse VERCEL_ENV=production. No paid checkout, production autopay or paid entitlement activation. Do not install live keys as part of this release.
- Policy pages stay visibly draft/preview and noindex. The 24h refund wording is not a promise fulfilled by a demo form. No effective commercial terms, tax treatment, retention or real paid launch is established here.
- Existing legacy plan assignments/status/periods remain unchanged. Never run demo seed or guessed restaurant-plan remapping on production. New signups use the 14-day WEBSITE_SINGLE trial.

## Backup, migration, deployment sequence

1. Confirm exact Vercel project/domain and production DB target. Freeze release changes. Record current production deployment URL/SHA and configuration names (never export secrets into a public artifact).
2. Take provider-supported recoverable snapshot or encrypted restricted pg_dump custom-format backup of the production DB. Verify completion and restore it to an isolated DB. Check restore/table counts and run migrations there first. If no recoverable backup/restore route is verified, stop.
3. Apply reviewed SQL against the restored database, then authorised production DB, in this order:
   - prisma/review-migrations/20261015_plan_unlimited.sql
   - docs/sql/staff-push.sql (includes WAITER enum addition)
   - prisma/attendance-additive.sql
   - prisma/staff-invites-additive.sql (WAITER uses IF NOT EXISTS)
   - prisma/review-migrations/20261015_refund_intake.sql
   - prisma/review-migrations/20261015_razorpay_test.sql (inert TEST bookkeeping only; optional deferral needs a reviewed release plan)
   Apply enum additions outside a transaction as files prescribe. Do not use prisma db push/--accept-data-loss or demo seed against production. SQL is not generally rerunnable after partial completion: inspect exact state before retrying.
4. The whole sequence was run successfully on isolated Postgres initialized from main; Prisma diff to combined schema was empty. This is not evidence that it has been applied to production. Check provider permissions, backup and actual production baseline before running.
5. Deploy the exact reviewed combined head, regenerate Prisma, preserve the existing production DB/JWT. Verify build and deployment readiness before domain promotion. Stop on any missing prerequisite or smoke-test failure.
6. Verify signed-out login has no demo credentials, new demo sign-in rejects, existing authorised non-demo account login works, Owner/Manager/Waiter boundaries, staff check-in/logout, invite single use/expiry, tenant/outlet isolation and polling. Use isolated preview fixtures for order/payment mutations, never production demo customer data. Check refund/billing remain disabled and Google hidden unless configured/tested.
7. If application rollback is needed, restore the prior deployment. Leave additive tables/columns in place unless a separately reviewed DB recovery requires otherwise. A destructive rollback can lose new attendance/invite data. Restore production backup only with a reviewed loss window and owner approval.

## Configuration and decisions

No new secret is needed for the narrow first release above; it relies on existing production DATABASE_URL/JWT_SECRET. Their identity/access, secure key quality and recoverability must be verified without rotating blindly.

For later activation:
- Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (secret via vault), exact authorised redirect URL for the production/preview origin at /api/auth/google/callback. Confirm Google OAuth consent audience/test users/publishing status and do a real owner + invited staff round trip. Never assume account activation publishes the OAuth app.
- Browser push: WEB_PUSH_SUBJECT, WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY (private key via vault), only after production permission/delivery test. Keys may be generated for the intended origin with approval; do not reuse unrelated values blindly.
- Refund intake: verified existing active operator user IDs for REFUND_ADMIN_USER_IDS (non-secret IDs), owner approval of those operators' cross-restaurant access, REFUND_INTAKE_ENABLED=true only after intake test/queue staffing/retention decision. A public email or a restaurant Owner role is not platform-admin authority. Queue is manual-refresh only, no email/push notification.
- TEST billing on isolated preview only: RAZORPAY_TEST_ENABLED, RAZORPAY_TEST_KEY_ID/SECRET (vault), plan single plan_ToFI9giqkcs6ob and multi plan_ToFIAZ82cBq36j, separate RAZORPAY_TEST_WEBHOOK_SECRET (vault), test dashboard webhook. Actual checkout/renewal/failure/halt/upgrade/webhook delivery remain end-to-end unverified. Never enable or claim live payments from this code.

Ask the owner to approve the narrow release scope with optional features OFF, the backed-up additive migration/deploy window and rollback approach, and a specific existing non-demo account for live login verification. If he wants Google/push/refund/payment features active at the same time, hold release until those specific prerequisites/tests are complete. Existing "publish everything" permission is conditional on passing tests and safe setup, not permission to hide inactive features.

## Combined local evidence

Clean Prisma generation, TypeScript and production build. Reliability; 9 auth; 15 staff invites; 31 live-order/push; 30 security; 21 attendance (new non-demo fixture); plan catalog/migration/DB entitlements; refund form/intake; and TEST billing regression groups passed. Provider tests: two TEST plans verified, one unauthenticated two-cycle TEST subscription created then cancelled. No live money or production entitlement changes.

Integration fixes preserve narrower Waiter permissions and /waiter routing (Cashier stays /pos), staff Google/invite attendance, retryable attendance logout plus optional push cleanup, all schema additions and all test scripts. Hosted Google/push/payment round trips, current production migrations, backup and full release smoke checks remain unverified.
