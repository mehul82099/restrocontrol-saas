# Razorpay subscription TEST preview

Preview only, no production settings, database or real money. The code refuses non-test keys, requires RAZORPAY_TEST_ENABLED=true and refuses VERCEL_ENV=production. Default is off. No test state updates the real Subscription/Plan entitlement records or issues refunds.

Configuration on an isolated preview environment:
- Apply review SQL `prisma/review-migrations/20261015_razorpay_test.sql` to its isolated DB, not production.
- RAZORPAY_TEST_ENABLED=true, RAZORPAY_TEST_KEY_ID=rzp_test_..., RAZORPAY_TEST_KEY_SECRET from vault, RAZORPAY_TEST_PLAN_SINGLE and RAZORPAY_TEST_PLAN_MULTI (Razorpay monthly INR 49900 and 69900 paise, interval 1).
- A separate random RAZORPAY_TEST_WEBHOOK_SECRET, set identically on the TEST dashboard webhook and server. Never use the API secret as webhook secret. Endpoint `/api/billing/test/webhook`.
- Subscribe TEST webhook to subscription lifecycle events. No email/customer notifications are requested by this test. Test records use internal opaque IDs only.

Owner signs in and opens `/billing-test`. Checkout creates a bounded two-monthly-cycle TEST mandate with quantity one and a one-hour authentication window. Two cycles are a testing limit, not an approved live mandate term. Server verifies configured plan amounts/currency/interval before creating or upgrading. API origin is fixed; keys are never sent to a caller URL. Checkout verifies HMAC(payment ID | stored subscription ID). A success callback never activates paid account entitlements. Webhooks require raw-body HMAC and event ID; duplicate events are safe. Current provider state is fetched instead of applying potentially stale webhook payloads. An unknown subscription cannot be associated with a restaurant by an untrusted webhook.

Upgrade: user chose ₹499 → ₹699 at next renewal, no immediate charge and no proration. Only the existing TEST mandate is changed, schedule_change_at=cycle_end; no second mandate. Pending plan is shown separately until the provider changes it. Immediate TEST cancellation affects only the TEST mandate, never real access. New checkout retries reuse the existing local record. An uncertain creation leaves a CREATING reservation: manually reconcile with the TEST dashboard before any retry; do not create another mandate blindly.

Limits before production: no live-key route; live mandate duration, tax/final payable amount, paid entitlement lifecycle and actual refunds remain release work. Need hosted TEST checkout authentication, renewal success/failure/halted, next-cycle upgrade, immediate cancellation and signed webhook evidence. No claim of end-to-end autopay until those checks pass. Provider documentation: https://razorpay.com/docs/payments/subscriptions/integration-guide/ , https://razorpay.com/docs/payments/subscriptions/test , https://razorpay.com/docs/webhooks/validate-test , https://razorpay.com/docs/api/payments/subscriptions/create-subscription/ , https://razorpay.com/docs/api/payments/subscriptions/update-subscription/ .

## Evidence from this review

Razorpay TEST API authentication returned HTTP 200. Created/verified TEST plans: WEBSITE_SINGLE `plan_ToFI9giqkcs6ob` (INR 49900 paise monthly interval 1), WEBSITE_MULTI `plan_ToFIAZ82cBq36j` (INR 69900 paise monthly interval 1). TEST subscription `sub_ToFIwiH0GyYCR2` was created with total_count=2, customer_notify=false and then cancelled through the API; provider returned cancelled. No checkout authentication payment was made. Plans remain TEST definitions; the smoke subscription is cancelled. No production state or account environment was changed.

`tests/razorpay-test-regression.cjs` uses only localhost DB plus mocked provider HTTP responses. Covers disabled/live-key/production gates, plan validation, upcoming plans, duplicate creation protection, HMAC/tenant verification, cycle-end update parameters, pending-plan tracking, webhook HMAC/replay/current-provider refresh and cancellation. Mocks establish server handling, not actual hosted checkout, bank mandate, renewal or webhook delivery.
