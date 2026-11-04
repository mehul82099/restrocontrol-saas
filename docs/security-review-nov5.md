# RestroControl security review - November 5, 2026

## Status
Local fixes passed build/typecheck and regression tests. Guarded branch delivery is in progress, not ready for merge or production. PR32 is separate and unapproved. No production DB/DNS/dashboard changes or real payments were made.

## Verified and prepared
- Existing Node handlers use DB-backed current session, role permissions and tenant/outlet scope. Public auth routes use signed capabilities/abuse budgets; provider webhooks use signatures. Operator refund administration is explicitly cross-tenant and gated by a configured user-ID allowlist, not an ordinary OWNER role.
- Existing login/register/reset enforce same-origin checks and shared DB abuse counters. Signup already enforces 10-72 characters, letter and number, and bcrypt's 72-byte cap server-side. Session cookies are HttpOnly, production Secure, SameSite=Lax, Path=/, Max-Age=43200 (12 hours).
- Next15.5.28 upgraded locally to15.5.29 using official November3 maintenance patch. React/ReactDOM remain18.3.1, latest patch of installed18 line. npm audit reported0 known advisories before/after; this is not proof of absence of vulnerabilities.
- Add host-only HSTS max-age31536000, no includeSubDomains/preload. Preserve current enforcing anti-frame/object/base policy; expanded CSP remains report-only, with a bounded privacy-safe reporting endpoint. Reports are untrusted and raw bodies, document URLs and script snippets are not logged.
- Remove personal Gmail/phone/street address from Organization JSON-LD; keep name/url/brand and logo.
- Add form autocomplete fields and explicit productionBrowserSourceMaps:false.
- Document every API route access policy; machine-readable manifest plus denied-role regression script.

## Tests and limitations
- Full Next production build and TypeScript check PASS.
-201 new role-denial/CSP/config assertions PASS. These do not demonstrate every allowed route and tenant isolation by themselves.
- Existing suites rerun on isolated localhost PostgreSQL:30 security,12 session,31 live order/push,15 invite,21 attendance plus auth-request security suite PASS. These include forged DB roles, disabled/revoked sessions, foreign-outlet and foreign-tenant references, bounded bodies and allowed operation flows. They do not certify full application security.
- Passive production checks: requested unauthenticated catalog/live-order APIs return401 + private,no-store. Baseline security headers exist, HSTS absent on new domain, robots still uses old sitemap until PR32 approved. Public HTML shells cacheable and currently client-render personal data; do not put user data into those shared shells.
- Screenshots generated locally, hosted visual verification still pending. Real payment, provider checkout behavior under future enforced CSP, and physical device push remain untested.

## Checklist proposals not blindly adopted
- Canonical/OG/robots/sitemap new-domain fix is already PR32, pending explicit approval. Current public sitemap includes refunds/shipping as deliberate public pages, not private shells. Do not remove legitimate pages just to mirror a sample list.
- Old Vercel host redirect needs reverse-proxy routing verification. Current primary domain runs independently through Caddy/Oracle; retain old host until reviewed, no blind permanent redirect.
- Wildcard CORS exists on old Vercel static HTML but not new-domain HTML; no such header exists in repo config/middleware. Platform/source attribution remains to check; do not claim a repo fix removed it.
- Turnstile/hCaptcha requires a real widget registration/sitekey/secret and dashboard setup. No fake production keys or auth lockout introduced. Existing server abuse counters retained. Add bot protection only after authorized setup and tested rollout.
- Generic signup success would change immediate account creation/login into an email-verification workflow. Current duplicate email409 exposes account existence. Reported as remaining design gap; no unsolicited verification/email workflow added.
- Existing login budget100/IP +10/IP+email per15min; signup5/IP+email and5/IP perhour. Reported proposed tighter values are not silently chosen due restaurant shared-IP lockout risk.
- Optional security.txt awaits confirmed business contact. Do not substitute personal email.

## MANUAL STEPS / separate decisions
- Confirm business security contact, then optional security.txt with verified expiry.
- Turnstile widget/account and secrets if wanted; no dashboard changes made.
- Do not set DMARC for new.tg shared parent zone unless actual ownership/control permits. Domain renewal/control must be checked with provider; no ownership assertion from passive report.
- Enforce fuller CSP only after browser/payment/OAuth flows and collected reports reviewed. Report-only rollout does not block scripts.
- Source-only changes require PR review then explicit publish approval; no database migration is required by this patch.

## Sources
See sources.md. Primary official source https://nextjs.org/blog/november-2026-security-release and advisory indices https://github.com/vercel/next.js/security/advisories , https://github.com/facebook/react/security/advisories . Applicability depends on cache/runtime/image/response-forwarding configuration; an installed-version match alone is not proof of exploitability.
