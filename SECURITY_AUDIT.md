# RestroControl security audit

Date: 2026-10-26. Baseline: `f38a6231dc0762c35ad434d0ac99c93494b56620` (`main`). Scope: source, routes, services, Prisma schema, client request paths, configuration, tests and reachable Git history. This is a source audit and isolated local verification, not a penetration test or a guarantee that no other flaw exists. Production data and production credentials were not accessed. No merge or production deployment is authorized.

## Baseline, before edits

- Fresh lockfile install, isolated PostgreSQL on loopback, schema created and synthetic demo fixtures seeded only there. No copied production data, SMTP, Redis, OAuth or payment credentials.
- `npm test`, `npm run build`, `npm run test:security` (30 checks), `npm run test:auth` (9 checks), and `npm run test:invites` (15 checks): PASS.
- Local production server starts; login, signup and landing render. Screenshots retained for comparison. Real Google and Razorpay transactions were not exercised.
- `npm audit`: Next.js critical/high advisories and Nodemailer moderate advisories, affecting two installed packages. See dependency findings below.
- Gitleaks 8.30.1: 362 reachable commits scanned; 25 candidates in synthetic invite fixtures and a release configuration example. Historical `.env` and known signing material also inspected manually. A clean generic scanner result would not prove rotation.
- Semgrep 1.182.1, all five requested rule packs: zero findings, **17 partial-parser warnings** in existing TSX text containing ampersands. 187 targets scanned, approximately 99.8% parsed lines. This is limited coverage, not an all-clear.

## Follow-up security fixes, 2026-10-26 22:20 IST

The owner then requested remaining fixes before publication. This section supersedes the earlier "Needs owner decision" status only for the implemented code below. All-user one-time re-login was separately approved in the authenticated conversation. Production DB migration, credentials and final deployment remain gated; no production change has happened.

The independently tested code tree is `f2fdd5021e1f9109657f00854300f6d02374a990`, published at `bab5bf8be8251e7852125725d888f19232089754` before this documentation-only update. Local concern commits were Google `6c1ba79`, sessions/reset/rate `8bb4b43`, body/error `7e2b3af`, and CI `fc378ef`; remote normal-editor commits split files, so the full tree, not an intermediate commit, is the release artifact.

- AUTH-01/02/03: persisted, tenant/user-scoped AuthSession for every role; mandatory session identifier rejects legacy JWTs. Logout revokes the current device, password reset/change revokes all devices/attendance/push and consumes pending reset links. User-row serialization and expected password hash prevent an in-flight old-password login issuing a fresh session after reset. Reset claims are atomic: exactly one concurrent winner. Live revision retains one SQL query, now with session/version/attendance predicates. Owner demotion without a staff attendance session now returns 401 rather than 403 and needs re-login.
- AUTH-04: fixed Google JWKS authority, RS256 signature verification, required issuer/audience/expiry/subject/nonce, bounded fetch/body, public-key cache and fail-closed rotation/outage handling. No new dependency. Unknown-key refresh cooldown can temporarily reject a legitimate new-key login; do not revert to decode-only verification. Real Google login remains unverified.
- AUTH-05/RATE-01/02: same-origin login defense preserves no-Origin clients. Atomic PostgreSQL budgets work across instances, using HMAC keys, no raw email/IP/token storage, no new paid or Redis service. Forgot-password keeps its generic response even when denied. Missing limiter storage fails closed: other auth returns generic 503; forgot remains generic 200, not an email-delivery promise.
- AUTH-06: new password creation/change/reset rejects UTF-8 inputs over bcrypt's 72-byte limit; existing password login acceptance was not tightened. Existing response keys and UI text are unchanged.
- VAL-01/ERR-01: shared protected mutations and auth wrappers use a 64KiB streamed byte cap, not only Content-Length/full-body checks. Invite/refund route DB exceptions are generic; successful responses remain untouched. No blanket schema/refactor or claim every endpoint now has a route-specific Zod schema.
- CI explicitly runs sessions, attendance, Google signatures, auth requests and invites in addition to existing tests/security/audit/build.

### Rate policy proposed for final owner review

Login, forgot and reset: 100/IP per 15 minutes, plus 10 per IP+email (or reset-token hash) per 15 minutes. Existing login also retains its 10 known-account attempts/15m. Forgot adds 10/email/15m globally to cap SMTP abuse; an attacker can temporarily exhaust that victim's budget, a deliberate tradeoff. Invite signup: 100/IP and 20/IP+email per 15 minutes. Restaurant signup retains the prior 5/IP/hour policy, now shared across instances, plus 5/IP+email/hour. Shared offices/cafes can hit signup limits. The platform's trusted x-vercel-forwarded-for is used on Vercel; missing/invalid addresses share an "unknown" bucket. Auth budgets add DB writes; no claimed free-tier monthly cap has been assumed. Explicit final policy approval is still required before production rollout.

### Current verification and limits

Fresh isolated fixtures: typecheck; npm test (including live31); security30; sessions12; attendance21; auth9; Google signature11; invites15; auth-request origin/budget/cap/failure tests; production build/start all PASS. Login/signup/landing remain pixel-identical to the original baseline. Independent combined implementation gate reproduced the same code tree. Full npm audit: 0. Redacted Gitleaks: 0 unexcepted findings. Five-pack Semgrep: 0 findings, existing partial TSX parser warnings persist (~99.8% parsed), not full coverage. Remote CI at the final head must be checked separately; queued intermediate runs are not final evidence.

Synthetic baseline schema -> reviewed additive SQL -> final schema diff is empty. Correct-production encrypted backup/restore proof is still blocked on securely identifying the current app's database connection. A synthetic rehearsal is not a production backup restore. Required order: verified fresh encrypted backup + isolated restore/rehearsal; explicit production SQL OK; additive SQL and table/column checks; old app compatibility; only then merge (which deploys). SQL is in `prisma/security-migrations/auth-session-rate-additive.sql`, outside migration history because the repo uses db push and has no baseline. Do not run unreviewed production db push/migrate deploy.

Historical JWT/NextAuth rotation or verified non-use remains unresolved. No current secret values read here, no credential rotation. No blanket secure claim. Real Google/SMTP/payment/push and all authenticated screens remain unverified. Keep CSP report-only. Prefer forward fixes: old-code rollback restores JWT-only acceptance and can reactivate revoked/legacy tokens for 12h; it is not security-safe without paused access or separately approved fresh-key rotation.

Still owner policies: signing rotation, actual backup/migration/deploy gates, AuthSession/attendance retention (no silent deletion), POS shared-device pending-cart retention, tenant-composite constraints/data cleanup, branch protection, expensive-endpoint quotas/pagination and full route-schema validation. No optional refund transition refactor or production scan was added.

## Findings and planned treatment

Line references below refer to the baseline unless marked historical. Severity describes the potential impact, not proof of production exploitation.

| ID | Severity | Location | Finding | Planned treatment |
| --- | --- | --- | --- | --- |
| DEP-01 | Critical, conditional exposure | `package-lock.json` installed `next` 15.5.27; `package.json:30` | GHSA-2464-fhr4-w9xw / CVE-2026-96889 affects image optimization with the vulnerable upstream image library on glibc Linux. No `next/image` usage or dangerous SVG option found, so application exploitability was not established. | Patch within Next 15 to 15.5.28, then repeat baseline and visual checks. |
| DEP-02 | High, not currently exposed by source | Same Next dependency | GHSA-p3m5-59mp-jv5r / CVE-2026-94482 affects App Router with at least one Server Action. No `use server` actions found. | Same patch, do not claim an exploitable Server Action was found. |
| DEP-03 | Moderate | `package.json` Nodemailer; `src/server/services/mail.service.ts:20` | Installed Nodemailer precedes 10.1.4; three address-parser advisories can redirect mail when adversarial address syntax reaches the mailer. Existing signup email regex narrows, but does not replace dependency patching. | Patch to 10.1.4 in the same major. |
| AUTH-01 | High | `src/server/services/attendance.service.ts:14`, `src/app/api/auth/logout/route.ts:11`, `src/server/auth/middleware.ts:24` | Owner tokens have no server session record. Logout removes browser cookie but a copied owner token remains valid until its 12h expiry. Legacy staff tokens without attendanceSessionId also lack revocation. | Needs owner decision: introduce revocable sessions or token versions and decide migration/logout impact. No silent session policy change. |
| AUTH-02 | High | `src/app/api/auth/reset-password/route.ts:20-29`, `src/app/api/auth/change-password/route.ts:28-29` | Password reset/change updates passwordHash without revoking existing sessions. Reset token validity is checked before the transaction; consumption is an unconditional update, permitting concurrent reuse. | Needs owner decision: atomic single-use claim and session revocation, including what happens to the current session. |
| AUTH-03 | Medium | `src/app/api/live/orders/route.ts:12-39` | Separate efficient revision SQL rechecks user, role, tenant, outlet and trial but does not validate attendanceSessionId. A logged-out staff token can still read a tenant/outlet revision hash until JWT expiry. This is not full order-data access. | Needs owner decision: add session predicate while preserving the single-query budget; changes rejection behavior. |
| AUTH-04 | Medium, defense in depth | `src/server/auth/google.ts:29-41`, `src/app/api/auth/google/callback/route.ts:27-35` | ID-token claims are decoded, not cryptographically verified. Current tokens arrive directly from Google's fixed TLS token endpoint, with state, nonce, audience, issuer, expiry and verified email checks; no arbitrary client id_token acceptance found. | Needs owner decision: supported Google verifier/JWKS validation and tests for key rotation/availability. Do not describe this as a demonstrated OAuth bypass. |
| AUTH-05 | Medium | `src/app/api/auth/login/route.ts:8-10` | Password login lacks the explicit cross-origin mutation check used by signup/logout and the shared authenticated mutation guard. SameSite cookies do not themselves prevent login CSRF. | Needs owner decision: reject cross-origin login requests; this changes previously accepted requests. |
| AUTH-06 | Medium | `src/server/services/password-policy.ts:3`, `src/app/api/auth/register/route.ts:61`, `src/app/api/users/route.ts:46` | Password limits use JavaScript character count, whereas bcrypt truncates after 72 bytes. Non-ASCII inputs can exceed the bcrypt byte limit. | Needs owner decision: byte-length policy and migration messaging; do not change accepted passwords silently. |
| RATE-01 | High | `src/app/api/auth/forgot-password/route.ts:10-30`, `src/app/api/auth/reset-password/route.ts:8` | Forgot/reset password lack throttles. Forgot requests invalidate earlier links and trigger SMTP repeatedly for a known account. Login limits only known active accounts using DB audit rows; not IP+email, and unknown email lookups are unbounded. | Needs owner decision: distributed IP+email policy, privacy-safe key derivation, service choice and failure mode. No Upstash account or paid service provisioned. |
| RATE-02 | Medium | `src/app/api/auth/register/route.ts:13-21`, `src/app/api/auth/invite/register/route.ts:4-10` | Process-local per-IP maps reset across Vercel instances/cold starts and clear at 5000 entries. Signup also has a DB-backed global count but count/create is not atomic. | Needs owner decision: replace with distributed atomic limits without silently altering permitted traffic. |
| RATE-03 | Medium | `src/app/api/reports/route.ts:24`, `src/server/services/analytics.service.ts:65`, `src/app/api/recipes/route.ts:38`, `src/app/api/billing/live/[action]/route.ts:24` | Authenticated expensive reads and billing provider refreshes lack rate/concurrency limits; several result sets are unpaginated. Custom analytics date ranges are already capped at 366 days. | Needs owner decision: pagination/quotas/concurrency limits; those change API behavior or results. |
| VAL-01 | Medium | `src/server/services/api-validation.ts:12-41` | Shared mutation guard has bounds and tenant-reference checks, but no route-specific required/type/enum schemas. Read query filters often rely on Prisma rejection/defaults. `req.text()` reads the full body before length checks; auth login/register/forgot/reset have no application body-size cap. | Safe narrow schema conversion only where acceptance/error behavior is demonstrably identical. Needs owner decision for new rejection rules, stream limits, query enums and broad Zod rollout. |
| ERR-01 | Medium | `src/app/api/staff-invites/route.ts:10`, `src/app/api/staff-invites/[id]/route.ts:9`, `src/app/api/refunds/route.ts:7`, `src/app/api/refunds/admin/route.ts:17`, billing owner helpers | Some authenticated routes call DB/auth outside a safe catch. Framework-generated 500 responses may have a different shape; production stack disclosure not demonstrated. Most protected CRUD routes already normalize errors. | Needs owner decision before changing response bodies/statuses. Detailed server logging must redact bodies, tokens, DB URLs and provider errors, not blindly log Error objects. |
| SEC-01 | High, historical | Initial commit `91f97d0`, `.env:3-4`; `src/server/auth/jwt.ts:13` | Public history contains JWT_SECRET, NEXTAUTH_SECRET and old JWT fallback material. No values reproduced here. `.env:1-2` used loopback DB/Redis without passwords, not hosted credentials. | **ROTATION REQUIRED if ever used**, or owner verification of completed rotation/non-use. Deletion is insufficient. No credential changes made. Current `signingKey()` has no fallback, rejects missing/known-weak keys. NEXTAUTH_SECRET is not referenced by current code. |
| DEPLOY-01 | High operational risk | Vercel Environment Variables and Environments settings, checked 2026-10-26 | DATABASE_URL applies to Production and Preview; only feat/live-orders-push-preview has a branch-specific override. A new preview branch otherwise inherits production DB. Production tracks main. | Disable Git deployments for security-hardening in the first remote commit. Keep all other branches unchanged. No remote preview or production-data tests. |
| CI-01 | Medium | `.github/workflows/verify.yml:1`; absent Dependabot/security workflows | Existing local-DB verify action checks tests, audit and build, but lacks requested secret/SAST/dependency automation. Main branch is not protected, so checks alone do not enforce review. | Add weekly Dependabot npm/actions, push/PR Gitleaks and PR Semgrep. Branch protection is a separate owner decision; no account-setting change. |
| HDR-01 | Low | `next.config.js:28-33` | Existing enforcing CSP only restricts ancestors/objects/base; there is no report-only resource policy. Existing Referrer/Permissions/nosniff/frame protections are present. | Add a separate report-only policy, preserve existing enforcing policy. Observe locally before any enforcement. No reporting endpoint/new API route. |
| DATA-01 | Low | `src/app/(dashboard)/pos/page.tsx:132-150` | Device recovery stores selected customer/cart/order notes in localStorage across logout. Scoped by tenant/user/outlet but same-origin scripts and local device users can read it. No tokens/passwords stored there. | Needs owner decision: retention/shared-device policy. Clearing automatically could discard pending bills, so not applied. |
| UX-01 | Low | `src/app/(dashboard)/users/page.tsx:114` | After successful staff creation, UI resets password state to a known literal (currently shorter than the server's 12-character minimum, so rejected by the API). | Needs owner decision to change form reset behavior; not a usable default-server-password finding. |

## Authorization and route inventory

All 64 route files were inventoried. No `use server` Server Actions, upload/multipart handlers, raw unsafe SQL, eval or dynamic Function constructor were found. Public exceptions are deliberate, not missing login checks: login/register/forgot/reset, Google start/callback/providers/pending, token-capability invite preview/register, public live-billing status, and HMAC-authenticated webhooks.

- Authenticated routes use `authenticateRequest`, except `/api/live/orders`, which has its own parameterized SQL authority gate (AUTH-03). Fresh DB authority checks prevent JWT role escalation and disabled-user access. Tenant is derived from verified user, never trusted from JSON.
- Shared `protectMutation` checks nested menu/ingredient/category/supplier/customer/table/purchase-order references and dynamic order/KOT/wastage/stock-count IDs. Selected outlet membership is checked by auth; dynamic mutations additionally bind outlet. Services recheck tenant references for order/inventory/purchase/wastage/count operations.
- Categories, customers, ingredients, menu, recipes and suppliers are restaurant-wide; inventory/order/KOT/table/purchase/wastage/count reads bind selected outlet. Users/invites are manage:users gated. Managers cannot create Owner/Manager accounts or invite those roles.
- Refund operator queue intentionally spans tenants only for explicit configured REFUND_ADMIN_USER_IDS. This is a platform-operator exception, not general tenant access. No IDs or production queue read during audit.
- Billing checkout/verify/cancel/upgrade resolves subscription by authenticated restaurant; webhooks require raw-body HMAC, bounded body/event ID and known provider mapping, then fetch provider state. No live provider call or money action was performed.
- Existing regression suite covers cross-tenant references, foreign outlets, stale role, disabled user, waiter restrictions, price tampering, idempotency, refunds, inventory and approvals. Static review is not a proof against all races or corrupted pre-existing foreign-key relations. DB does not enforce composite tenant foreign keys; adding them requires a separately approved migration, not this task.

## Controls verified, not missing findings

Bcrypt cost 12; HS256 allowlist and 12h expiry; production session cookies already HttpOnly/Secure/SameSite=Lax (local HTTP development intentionally omits Secure); 256-bit hashed reset tokens with 30-minute lifetime; Google random state/nonce and fixed provider URL; same-origin checks on cookie-authenticated protected mutations. SQL uses Prisma/tagged parameterization; no unsafe raw calls. Push endpoint accepts only fixed HTTPS browser-provider hosts. Server fetches target fixed Google/Razorpay origins; no arbitrary server fetch destination found. Landing dangerouslySetInnerHTML is static JSON-LD, not user content. React escapes displayed user text. CSV exporter prefixes formula-leading text. Current NEXT_PUBLIC_ usage is not secret-bearing. Server log messages do not intentionally include credentials, but Prisma error logging deserves caution because malformed values/query details can enter logs.

CVE-2025-29927: current 15.5.27 is beyond the patched 15.2.3 line. Middleware only rewrites guest `/` to landing; authorization lives in route-level DB checks, not middleware. No middleware-only security boundary found.

## Needs owner decision

The behavior-preservation HARD RULE takes precedence over the suggested safe-fix list. AUTH-01 through AUTH-06, RATE-01 through RATE-03, new VAL-01 rejections, ERR-01 response/logging changes, DATA-01, UX-01, tenant-composite DB constraints, branch protection, and secret rotation are **not applied** without a decision. Existing cookie flags do not need a functional change. No paid service or new account created. Upstash requires an approved Redis service/configuration and a chosen outage policy; installing its SDK alone would not provide distributed protection.

Rotation plan: verify historical JWT and unused NextAuth material were replaced or never deployed. If not, generate replacement through the secure credential channel, update only approved environments, and verify login. JWT rotation signs out current sessions and invalidates purpose cookies. Never roll back to exposed material; rollback must use another fresh key. Rotate any reused secret at its other providers. No evidence of active compromise was established.

Optional production ZAP scan omitted: no production probing is needed for this request, and passive baseline tooling still visits/crawls the live service.

## Fix log

Audit written before implementation (`0e7319f`). No claim that the app is completely secure or every flow is identical follows from passing tests.

| Change | Remote commit(s) | Verification |
| --- | --- | --- |
| Disable Git deployment for this branch only | `be55d3c` (first remote write) | Official Vercel config contract checked; native GitHub read and fetched bytes match. Main and other branches unchanged. |
| Next 15.5.27 -> 15.5.28; Nodemailer 10.1.1 -> 10.1.4 | `592b629`, `d1a3b11` | Each patch separately passed local suites/build/start/render before publication. Lockfile retains baseline compact formatting. Only these packages and Next bundled platform packages changed. Full npm audit: 0 vulnerabilities. |
| Separate report-only resource CSP | `6fa3ffc` | Existing enforcing CSP byte-for-byte unchanged. Local Chromium securitypolicyviolation events, disposition=report: inline script-src-elem on login (8), signup (8), landing (22). Do not enforce this candidate policy without nonce/hash work and broader flow testing. No report endpoint or production telemetry was added. |
| Weekly npm/actions Dependabot | `1b9303a`, path correction `db39806` | Config byte-compared at .github/dependabot.yml. It takes effect on default branch only after an independently approved merge. |
| Redacted full-history Gitleaks on push/PR | `24a5453`, `8ed7acf`, path correction `6fa0922` | Gitleaks 8.30.1 passes locally with exact fingerprint exceptions only for reviewed synthetic variable expressions and non-secret Razorpay plan IDs. No path-wide secret suppression. Historical weak signing material still requires rotation verification, regardless of scanner status. |
| PR Semgrep, five requested packs | `d652f5e`, path correction `49a624e` | Same local scan: 0 findings, 17 partial-parser warnings, about 99.8% parsed. Warnings remain visible; no unrelated JSX refactor. Metrics disabled, no Semgrep account/token. |

Final isolated fresh-fixture gate: npm test, test:security, test:auth, test:invites, build and server start/render all PASS. Login, signup and landing screenshots inspected. Repeated suites on accumulated synthetic inventory briefly exposed an existing strict floating-point assertion mismatch; reverting the CI-only step did not remove it. Resetting only the isolated test DB to clean fixtures restored the gate. No test or application source was changed to mask it.

No route, API body, session policy, database schema or UI source changed. Live Google, SMTP, browser-push, payment, production CSP traffic and every authenticated UI screen remain unverified. Passing available checks is not proof of exact behavior in those flows.

PR: https://github.com/mehul82099/restrocontrol-saas/pull/22 (draft, unmerged).

## Sources

- https://github.com/advisories/GHSA-2464-fhr4-w9xw
- https://github.com/advisories/GHSA-p3m5-59mp-jv5r
- https://github.com/advisories/GHSA-8c8m-p3m8-cjg8
- https://github.com/advisories/GHSA-m943-m63m-w62w
- https://github.com/advisories/GHSA-85x2-q946-cp5h
- https://nextjs.org/blog/cve-2025-29927
- https://vercel.com/docs/project-configuration/git-configuration
- https://vercel.com/bespoke-frn/restrocontrol-saas-qjcj/settings/environments
- https://vercel.com/bespoke-frn/restrocontrol-saas-qjcj/settings/environment-variables
- https://github.com/gitleaks/gitleaks-action
- https://semgrep.dev/docs/semgrep-ci/sample-ci-configs
- https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference

## Prior audit retained

The earlier audit below is an unverified historical repository record, not a statement of current deployment state or evidence of user approval. Its attribution of an owner decision about demo access has not been authenticated in this review. No demo behavior was changed, under the current zero-functional-change instruction.

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
| Critical | Public demo OWNER and other accounts use shared seeded credentials | login page and scripts/seed.js | Production seed now requires explicit opt-in. Live demo login remains unchanged kept at the owner's explicit request on 7 October 2026 |
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
2. Owner chose "For now keep them" on 7 October 2026. Demo account access remains intentionally enabled. Treat this as a public demo sandbox, not a private restaurant system. Disable or replace seeded privileged credentials before private data is stored. This cannot be safely finalized without preserving an owner login route. Seed opt-in alone does not disable already-created demo accounts.
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
