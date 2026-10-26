# Auth-session and rate-limit rollout

This is a reviewed additive SQL artifact, not a command to run on production.
The project currently uses `prisma db push`, not a baseline migration history;
do NOT run `prisma migrate deploy` against the existing database without baselining.

1. Owner approval is required for production DB access/mutation and the one-time
   sign-in reset described below. No production operations were performed here.
2. Take an encrypted pg_dump backup, store it in the owner's approved location,
   and restore-check it in isolation before the approved migration window.
3. Rehearse `auth-session-rate-additive.sql` on a restored isolated database.
   It adds User.authVersion with default 0, AuthSession and SecurityRateLimit;
   it neither edits business data nor drops existing columns/tables.
4. Apply the reviewed SQL as one transaction, using psql ON_ERROR_STOP. Old app
   code can continue with these extra columns/tables, but cannot yet revoke tokens.
5. Deploy the WHOLE auth/session/rate application change in one release. All old
   JWTs lacking authSessionId will receive 401 on protected APIs. Every user must
   sign in once again. No hidden legacy acceptance mode exists. This cutoff is
   separate from JWT signing-key rotation; changing the key is not required by
   this migration and was not performed. Existing trial/tenant/role checks remain.
6. Test owner/staff email login, Google login, signup, logout, password change,
   reset, push and live orders. Real Google/SMTP/provider tests were not done by
   the local session worker. Do not claim them from mocked/local tests.

## Rollback

Prefer a forward fix. Reverting application code is schema-compatible: leave
all additive schema in place. However, reverting to pre-hardening code restores
its JWT-only acceptance and can REACTIVATE previously revoked/legacy JWTs until
12h expiry. This is not a security-equivalent rollback. Pause access or obtain
owner approval for an appropriate signing-key rotation before reverting auth
checks; rotation signs everyone out. Do not silently roll back to insecure auth.
There is no reason to drop AuthSession, authVersion or SecurityRateLimit during
an application rollback. Any later schema removal needs its own approval and
backup; deleting rows loses revocation evidence.

## Local evidence

Synthetic PostgreSQL only. Baseline schema -> additive SQL -> current schema
comparison must be empty; the old schema also remains usable after the SQL.
New session test covers owner/staff copied-token logout, other-device isolation,
legacy rejection, session scoping/expiry/version, password invalidation,
concurrent reset one winner, stale-password issuance rejection, staff attendance,
and the one-query live revision budget. Run with explicit local DATABASE_URL:
`node tests/auth-session-regression.js`.
