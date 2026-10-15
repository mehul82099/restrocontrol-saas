# Plan reconciliation: review required, not executed

The owner requested replacement of the legacy Rs 1,499/2,999/4,999/9,999 offer with four choices: Rs 499 one outlet, Rs 699 two or more outlets, Rs 699 app + website (upcoming), Rs 999 app + website with two or more outlets (upcoming).

The current database schema only has monthly/yearly prices and mandatory integer quota fields. Monthly cadence is confirmed. The Rs 699 website plan has unlimited outlets and staff. Monthly order limits, the Rs 499 staff cap and feature entitlements are not confirmed. Do not insert guessed limits, an unlimited sentinel, a free price or a monthly interpretation to make the schema accept unresolved terms.

## Prepared code

`scripts/reconcile-plan-catalog.cjs` compiles the exact catalogue only after an explicit reviewed configuration supplies monthly cadence and every quota/feature entitlement. With a configuration path it defaults to a read-only dry run. It lists existing accounts not assigned to a new plan. `--apply` rejects all non-local database hosts. This is migration preparation, not a production migration route.

There are no executable business defaults in the repository. Tests use clearly synthetic quotas only. To run the compiler tests: `node tests/plan-migration-regression.cjs`.

The reviewed configuration must contain `billingFrequency`, `monthlyCadenceConfirmed`, `quotas` keyed by the four catalogue codes, and optional `restaurantAssignments` keyed by each exact restaurant ID. Every quota needs `maxOutlets`, `maxUsers`, `maxOrdersPerMonth`, `hasAdvancedReports` and `hasAiFeatures`. Do not assume an old tier maps to a new one because its name resembles it. Accounts with more than one outlet cannot be assigned to the one-outlet plan. Upcoming app plans cannot receive subscriptions.

## Remaining launch work

- Obtain the remaining order/staff decisions. The confirmed uncapped outlets/staff for the Rs 699 website plan must be represented explicitly with reviewed nullable-schema/service changes instead of a magic integer. The current compiler intentionally refuses an invented integer substitute and is not ready to apply that plan yet.
- Replace both legacy seeding entry points (`SubscriptionService.seedStandardPlans` and `scripts/seed.js`) and register's old `PRO` lookup together. Do not remove the old lookup while signup still depends on it.
- Disable annual billing explicitly before using the new monthly catalogue. `priceYearly=0` is not an annual offer.
- Dry-run on an isolated database copied without real customer secrets; review per-restaurant assignments, seat/outlet compatibility and preservation of records.
- Add DB-backed migration, entitlement, expiry, upgrade and signup tests. Current compiler tests do not replace them.
- Only after explicit publish approval, take a supported backup, use a separately reviewed production migration procedure and verify results. No production mutation has been run by this change.
- Connect/test Razorpay and webhook-backed lifecycle before any plan activates from payment. This script never changes subscription status, billing periods, mandates or payments.

Legacy records remain intact until a safe mapping is approved. The preview hides legacy prices as new offers. Actual reconciliation is not yet complete.
