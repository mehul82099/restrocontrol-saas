# Staff attendance (preview)

- Only Owner/Manager can create staff through Team & Permissions. Managers cannot create Owner or Manager roles. Public signup always creates a new restaurant and Owner, never staff in an existing restaurant.
- Each successful staff password login saves a separate record before a token is returned. Failed logins and page refreshes do not check in. Owner logins are excluded. Manager, Cashier, Kitchen Staff, Inventory Manager and the future WAITER role are staff.
- Explicit Logout closes only that login session and invalidates it for protected APIs. Other device sessions remain separate. A DB failure leaves Logout retryable, with an error shown to the user.
- If no Logout occurs, the stored `expiresAt` supplies the exact effective checkout time. The report derives it even if nobody made a request at expiry; there is no background timer or claim that a person physically left. It is labeled "Session expired / System-estimated". This is login activity, not payroll-ready time worked.
- Owner/Manager attendance is restaurant-wide, in the restaurant timezone. Reports use bounded 31-day ranges and 100-row keyset pages. No staff edit/correction or payroll total is included.
- Preexisting login tokens have no attendance ID. They keep working until expiry and cannot be backfilled accurately. New staff sessions start recording after deployment and reviewed schema setup.

## Integration before publishing

1. Keep the additive AttendanceSession model and its User/Restaurant relations when integrating PR #7's Plan model and PR #8's WAITER/push schema changes.
2. Keep the attendanceSessionId JWT payload field when integrating PR #9's JWT helper additions.
3. Password login calls await issueAttendanceToken instead of signToken. If staff Google login remains enabled, PR #9's Google callback MUST use the same helper for staff check-in. If Google login is Owner-only, keep that restriction instead. Public Google signup must still use the Owner-only registration path.
4. Merge auth middleware session-validity guard, Sidebar Attendance item, and Header/layout Logout error handling with PR #8 rather than overwriting it.
5. Apply a reviewed additive schema migration to an isolated preview database first. Do not run unreviewed prisma db push on production. For a no-data-loss SQL baseline see prisma/attendance-additive.sql.
6. Re-generate Prisma and run typecheck, build, attendance and security regressions on the combined code. Tests require an isolated local DB seeded with scripts/seed.js. Run attendance before merging demo lockdown, or replace only the local fixtures with non-demo staff.

## Validation

`node tests/attendance-regression.js` uses actual local Postgres and Next route handlers. It covers login success/failure, refresh, explicit logout, idempotence, concurrent-device isolation, exact expiry, access control, tenant isolation, cursor checks, Manager staff creation and Owner-only public signup.
