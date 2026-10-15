# Reliability preview checks

This is preview work. Do not merge until it has been reviewed. No schema migration is included.

## Automated checks

- `npm ci` (the repository's `.npmrc` sets legacy-peer-deps).
- `npm run test:reliability`: pure recovery validation, storage-key isolation, retry identity, ticket ages and source regressions. No database needed.
- `npm run typecheck` and `npm run build`.
- `npm test` and `npm run test:security` require an isolated local PostgreSQL database seeded with `npm run prisma:seed`. They deliberately refuse a remote database. The security suite includes a concurrent same-key checkout regression.
- Optional UI fixture test: install Playwright without changing the lockfile (`npm install --no-save --package-lock=false playwright`), start the built application at `127.0.0.1:3000`, then run `OUTPUT_DIR=/tmp/restrocontrol-preview node tests/preview-smoke.cjs`. The script uses `/usr/bin/google-chrome`; adjust that executable path if needed. All `/api/` requests in this test are intercepted fixtures. It does not submit a real order or payment.

## Scope and remaining limits

- Drafts and holds are local to this browser, user, restaurant and outlet. They do not sync between devices, and are not offline order support. Clearing site data removes them. Browser storage failures and unreadable saved data pause checkout rather than pretending recovery worked.
- An unconfirmed checkout freezes its exact payload and identity across reloads. Retry the same checkout. Do not collect payment again. Check Orders & Bills if the server continues rejecting it. There is no automatic release of an uncertain payment lock.
- Receipt identity uses restaurant settings. Tax is labelled "menu rates" and uses the server's calculated total; this is not a GST-compliance certification, a per-rate GST split, or a historical restaurant-identity snapshot. Real 58/80mm printer testing remains required.
- Delivery fee is entered per order, starting at zero. There is no saved restaurant-default fee in the current schema.
- UPI and card entries are manually recorded, not gateway-verified. There is no QR or automatic bank verification.
- Table handoff selects an available table. Occupied tables link to Orders & Bills instead of promising an unsupported "add to bill" flow. Running bills, merges and transfers remain out of scope.
- Kitchen tokens are shortened display identifiers, not new sequential numbers. Full IDs remain available as hover text. Old tickets show days/hours; they are not silently removed or marked served.
- Role navigation and the separate landing-page PR are unchanged. No production deployment, production data changes or paid services are part of this preview.
