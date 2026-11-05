# Human check and signup disclosure mitigation

Approved scope: free Cloudflare Managed Turnstile on password login and password signup; generic duplicate-signup rejection with sign-in/reset links. Valid new signup stays immediate and sends no extra email. Google OAuth routes and signed Google signup capability remain unchanged. No rate limit values, database schema or DNS changes.

## Configuration and rollout
- TURNSTILE_ENABLED=1, TURNSTILE_HOSTNAMES=restrocontrol.new.tg,restrocontrol-saas-qjcj.vercel.app (explicit exact allowlist), TURNSTILE_SITE_KEY (public widget key), TURNSTILE_SECRET_KEY (vault-managed server secret).
- Site key is served through the no-store dynamic provider endpoint, not bundled from build env. Secret is never returned.
- Widget hostnames must include both restrocontrol.new.tg and restrocontrol-saas-qjcj.vercel.app for both active deployments. No wildcard/all-hostname widget. APP_URL stays pinned to https://restrocontrol.new.tg for trusted public origin/CSRF handling; verification also requires request hostname in the explicit server allowlist and Siteverify hostname equal to that exact hostname. No arbitrary host-header allowance.
- When explicitly enabled, absent configuration, rejected/expired/reused token, action/hostname mismatch, provider HTTP failure, malformed response or 6-second timeout denies password authentication. Existing origin/body/IP/identity checks run before Siteverify. No silent bypass on provider failure.
- Production rejects published Cloudflare testing site/secret keys. Testing keys belong only to isolated development/CI. The feature is not active until real configuration is installed and enabled; do not call a disabled deployment protected.
- Managed visible widget retains Cloudflare branding and recovery text. Password managers/autofill are not rejected on timing or honeypot rules. Google sign-in remains a separate available route, not blocked by the password widget.
- Report-only CSP adds challenges.cloudflare.com script/frame/connect. Existing enforcing anti-frame/object/base CSP stays unchanged.

## Tests
TypeScript and production build pass. Existing security, sessions, auth, auth-request and 201 route/config regression checks pass. New unit tests cover token bounds, hostname/action binding, replay/provider/error failures and production testing-key rejection. New isolated DB route tests cover origin/budget ordering, accepted signup201 with immediate session, duplicate generic400 without new account/session, and accepted password login. Local real testing widgets visually inspected at390px on login and signup with Success and enabled submit, no clipping.

## Limits
Generic400 removes the explicit account-exists sentence and409. It does not make signup indistinguishable: successful creation still returns201 and a session while rejection does not. Existing lookup/hash/timing differences and Google account-state messages remain. No false email-sent claim or unmeasured timing-padding claim. Turnstile mitigates automated abuse, not proof of complete application security. Real production widget/hostname verification must pass before declaring rollout complete.

## Sources
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/
- https://developers.cloudflare.com/turnstile/plans/
