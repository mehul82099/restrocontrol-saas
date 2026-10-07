# RestroControl audit and repair

Audited 7 October 2026. Baseline: public repository mehul82099/restrocontrol-saas at 91f97d0c3280f620f773f27b0d4eada41d9f7161.

## Status

Fixes are prepared and tested on security/restrocontrol-audit-20261007. They are not yet published or deployed. GitHub sign-in is required. Current live Vercel deployment remains FVDwGwQvzdh1TgF71ZedbnamQmoz, Ready and Current, on the original commit.

This review does not prove that every bug or vulnerability has been found. It combines source review, npm advisory checks, isolated Postgres regression tests, and local production-build browser checks. No live customer database was modified, no paid service installed, and no production signing key changed during this audit.

## Confirmed findings and repairs

| Severity | Finding | Evidence | Repair prepared |
|---|---|---|---|
| Critical | Public fallback JWT key permits token forgery when configuration is missing | src/server/auth/jwt.ts | Remove fallback; reject weak/unconfigured keys; restrict JWT verification to HS256; shorten sessions to 12 hours |
| Critical | Public .env contains signing secrets | .env in initial public commit | Remove tracked .env, ignore private env files; production key rotation still required; historical git copies remain |
| Critical | Public demo OWNER and other accounts use shared seeded credentials | login page and scripts/seed.js | Production seed now requires explicit opt-in. Live demo login remains unchanged pending owner decision and safe replacement access |
| High | Signed token role stays valid after user disable/demotion | auth/middleware.ts | Reload active user and DB role for every request |
| High | Arbitrary outlet headers/queries accepted; staff not restricted to assigned outlets | auth/middleware.ts and auth/me | Resolve active tenant-owned outlets and enforce staff assignments |
| High | Manager can create an OWNER account; omitted passwords become a known default | api/users | Restrict non-owner role assignment; require a supplied 12-72 character password |
| High | Cross-tenant IDs accepted in checkout, recipes, menu, inventory and purchase input | mutating routes and services | Shared bounded tenant-reference checks; enforce customer/menu/variant/table/supplier/ingredient ownership before mutation |
| High | Global idempotency lookup can return another tenant's order | order.service.ts | Verify tenant and outlet before returning a duplicate; provide complete duplicate receipt response |
| High | Checkout trusts item prices, totals, names and quantities | order.service.ts | Use catalog prices, active variants/addons, quantity bounds, per-item taxes and server totals; reject changed totals |
| High | Negative, excessive and repeated refunds accepted; partial refund marks all refunded | order.service.ts | Require positive bounded refund, track previous refunds, respect amount paid and partial/full distinction |
| High | Inventory-manager request can self-approve a stock count | api/stock-count | Check approval permission; service also verifies auto-approver authority |
| High | Concurrent cancel/refund/receive/approval can repeat stock changes | transaction workflows | Serializable transactions for protected workflows; concurrent losers reject safely rather than double-apply |
| High | Old framework and PostCSS have published advisories | package-lock.json and npm audit | Upgrade Next to 15.5.27, PostCSS to 8.5.29, override selector parser 7.1.6; production npm audit is zero at check time |
| Medium | Login is unthrottled and errors disclose implementation detail | api/auth/login | DB-backed per-account attempt budget serialized by row lock; bounded inputs and generic failures; no Redis needed |
| Medium | Cookie mutations lack explicit origin defense | auth/middleware.ts | Reject cross-origin cookie-authenticated mutations |
| Medium | Broad raw error messages and unbounded JSON/numeric inputs | API routes | Request size/depth/item bounds, numeric validation, generic errors for mutations and reads |
| Medium | Authenticated API responses can be cached | route exports and next.config.js | Force dynamic API handling and private/no-store cache headers |
| Medium | CSV string cells can become spreadsheet formulas | report.service.ts | Prefix formula-like untrusted text and retain CSV quote escaping |
| Medium | No frame restriction/security headers | next.config.js | Add no-frame policy, nosniff, referrer/permissions headers and limited CSP |
| Medium | Inventory movement uses grams as KG and assumes 1L = 1KG | inventory, wastage, purchase, unit-converter | Normalize movements and costs to ingredient unit; reject incompatible conversions; normalize wastage approval threshold |
| Medium | Stale stock audit variance applied after stock changes | stock-count.service.ts | Reject approval when current stock differs from captured baseline; require a fresh count |
| Medium | Count-based document numbers collide under concurrent orders | order, purchase, stock-count | Use random UUID suffixes instead of count-based uniqueness |
| Medium | Cancelled/refunded tickets remain in kitchen and can be resurrected | kot.service.ts | Exclude terminal orders and reject terminal-order KOT changes |
| Medium | 29 TypeScript errors hidden by build; POS Scale icon undefined | baseline tsc, next.config.js | Repair icon, Badge aliases, modal width props, cached type; type errors now block builds |
| Medium | Recipe create dialog options fetch destructures a non-array | recipes page | Correct Promise.all fetch |
| Medium | Reports UI expects arrays, APIs return objects; 12 selections have no handler | reports page and report service | Adapt rows, add missing handlers/aliases, test all 20 selections |
| Medium | Purchase order number undefined; Receive button can crash | purchases page | Match poNumber and totalAmount fields |
| Medium | Pending approval controls never appear; wastage and variance totals use wrong fields | wastage/stock-count pages | Match PENDING_APPROVAL, totalCost and variance fields |
| Medium | Several branch screens ignore selected outlet when loading or writing | dashboard pages and Header | Pass x-outlet-id through shared API helper; reload on branch change |
| Medium | Notification branch details exposed across staff outlets | notification routes/service | Scope reads and updates to selected outlet plus tenant-wide notifications |
| Low | Audit before/after UI uses fields absent from API | audit-logs page | Parse stored before/after JSON |
| Low | Recipe cost ignores yield and base recipe selection is ambiguous | recipe-engine | Use base/variant filter and per-yield costing |
| Low | Optional Redis falls back to localhost on every runtime | cache/redis.ts | Skip client creation when REDIS_URL is absent |
| Low | Dashboard cache invalidation misses actual prefixed keys | order.service.ts | Invalidate outlet dashboard prefix |
| Review | Unneeded native link/UID/shared-memory shim committed | libfakelink.c and libfakelink.so | Remove from app repository; no evidence it was used by the deployed Next app |

## Verification

- npm run typecheck: pass.
- npm run build: pass with type checking enabled.
- npm test: 12/12 original business tests pass on isolated local Postgres. Tax expectations and one floating-point tolerance corrected to match valid behavior.
- npm run test:security: 29/29 new regressions pass, including all 20 report selections.
- Local production browser: login, dashboard, POS, recipes, inventory, orders, audit logs, stock counts, purchases, users, menu, reports, wastage and tables inspected. No client exceptions in the route smoke test. HTTP validation, cookie auth, no-store and CSV smoke checks pass.
- Pixel inspection: POS, recipes, dashboard, reports, purchases and stock-count views readable; pending approval controls restored.
- GitHub Actions workflow added to repeat typecheck, business/security tests, production dependency audit and build using an isolated Postgres service.
- npm audit --omit=dev: zero known vulnerabilities at audit time. This is an advisory scan, not proof of security.

## Remaining risks and follow-up

1. Publish and verify branch/PR, configure a fresh random JWT_SECRET in Vercel, then deploy. Existing sessions will be signed out by rotation. Never reuse the public committed signing value. Secrets are write-only in the current Vercel UI, so the current live value could not be compared with the public file.
2. Decide whether this is strictly a public demo sandbox or a real restaurant system. Disable or replace seeded privileged credentials before private data is stored. This cannot be safely finalized without preserving an owner login route. Seed opt-in alone does not disable already-created demo accounts.
3. Five high npm findings remain in the build-only Tailwind 3 glob chain (braces, chokidar, micromatch, fast-glob, tailwindcss). The braces advisory has no patched compatible version currently published; Tailwind 4 migration changes CSS/build tooling and needs separate visual validation. No server accepts user-provided glob patterns in the reviewed code.
4. Live/Preview deployment tests are not complete. No production exploit, forged token, live refund, stock change or customer-data mutation was attempted.
5. Financial reports still need a reviewed accounting policy for net revenue, partial refunds, tax allocation and date boundaries in each restaurant timezone. Gross report totals can include refunded orders; not suitable as audited financial accounts yet.
6. Purchase-return service is not exposed by an HTTP route and still lacks a per-item cumulative return ledger/limit. Do not wire it into production until that lifecycle is designed and tested. Negative return input and non-received PO are now rejected.
7. Cross-instance login throttling covers known accounts, not comprehensive IP-level abuse, and its audit records need retention management. Public demo traffic can consume the account attempt budget.
8. Concurrent duplicate checkout requests fail safely on uniqueness/serialization races, but do not yet automatically replay the winner. A caller must retry with the same idempotency key; POS still generates a new key for a fresh payment attempt. Full network-retry reconciliation remains needed before high-volume use.
9. Report aliases reuse common calculations (consumption/variance and recipe-cost/margin). They are functional views, not new independent accounting models.
10. No disaster-recovery/backup restore drill, load test, accessibility audit, full mobile layout audit or independent penetration test was completed. No schema migration was needed for the prepared fixes.

## Sources

Repository: https://github.com/mehul82099/restrocontrol-saas
Baseline commit: https://github.com/mehul82099/restrocontrol-saas/commit/91f97d0c3280f620f773f27b0d4eada41d9f7161
Current deployment: https://vercel.com/bespoke-frn/restrocontrol-saas-qjcj/FVDwGwQvzdh1TgF71ZedbnamQmoz
Live site: https://restrocontrol-saas-qjcj.vercel.app/
Build-only advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
PostCSS advisory: https://github.com/advisories/GHSA-6g55-p6wh-862q
Next.js cache advisory: https://github.com/advisories/GHSA-gp8f-8m3g-qvj9
