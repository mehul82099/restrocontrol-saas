# Staff order updates (preview)

Production must not be changed until the owner approves publishing.

## What works without new services

- The signed-in dashboard checks an authenticated, tenant/outlet-scoped revision every four seconds while visible, every 30 seconds while hidden. It catches up on reconnect/focus, backs off after failures, and shows a stale/reconnecting notice.
- Changed revisions refresh the order list, kitchen board, owner/manager metrics, and POS table availability without resetting carts, held orders or payment state. A short in-app popup signals order activity. The initial load does not replay old activity.
- This is near-live automatic refresh, not a persistent WebSocket connection or a guarantee of instant delivery. No paid pub/sub service or Redis is required. Database/serverless usage still counts toward the host's free allowances; monitor usage before scaling.
- Owner, Manager, Cashier and Kitchen Staff are included. There is no waiter role yet; that needs an agreed permission set before adding it.

## Background push setup (not enabled on production)

1. Use an isolated preview database. Never point the preview at the production database for mutation testing.
2. Apply the additive `StaffPushSubscription` schema there with `npx prisma db push` (existing project uses schema push, not a migration-history baseline). An equivalent additive SQL script is in `docs/sql/staff-push.sql`.
3. Generate one VAPID key pair with `npx web-push generate-vapid-keys`. Keep the private key only in the deployment's secret environment settings. Set `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, and `WEB_PUSH_SUBJECT` (a verified support `mailto:` address or HTTPS contact URL). Do not commit private keys.
4. Deploy over HTTPS. Each staff member clicks Enable alerts and accepts that browser's notification prompt. No permission prompt is fired automatically on page load. Permissions are per browser/device.
5. A subscription follows that browser's currently selected outlet. Switching outlets updates its binding. Logging in again renews the binding only when permission already exists. Turning alerts off removes the current session's subscriptions and unsubscribes the browser.
6. Run a real two-device test: submit an order on one, observe kitchen/order updates on the other; close the receiving page and confirm a native push. Verify logout, expiry, disabled user, removed outlet membership and browser permission denial. Test the actual supported Android/iPhone browsers before release.

If the environment is not configured, the UI says setup is pending. It must not imply background alerts are active. VAPID private keys are not needed for the in-app update flow.

## Security and delivery limits

- Every revision read reloads current user, role, trial and outlet authority. No cross-tenant/global order feed exists.
- Push registration requires a current cookie session, CSRF/origin checks and an order-facing role. Tenant/user/outlet identifiers come from authentication, not the supplied JSON. Only known HTTPS browser-push service hosts are accepted, to prevent arbitrary server-side requests. Other provider hosts fail closed until deliberately reviewed.
- Server dispatch rechecks user activity, membership, role, outlet and trial. The queued payload contains only a random subscription ID, not order/customer details or credentials.
- On receipt, the service worker fetches the current authenticated session and matching subscription before showing a generic order-activity notification. Signed-out/expired/disabled/unassigned users fail closed, including an old push arriving after sign-out. No authenticated page/API caching is added. A notification already displayed before sign-out may remain in the operating system notification tray.
- Subscriptions expire with the 12-hour login. Logout removes registrations for that session. 404/410 browser endpoints are removed. The host should periodically remove expired rows as routine maintenance; no paid scheduler is installed by this change.
- Delivery is best effort after a committed order create/cancel/refund or kitchen update. An idempotent checkout retry does not send again. Push failures never undo the order. There is no durable push retry queue, so a process interruption/provider outage can lose an alert; the in-app revision check recovers the authoritative order state when the page returns.
- Browser/OS support, network access, notification permission, battery/background restrictions and device settings affect delivery. Unsupported browsers retain automatic in-app updates. iPhone/iPad web push generally requires an eligible Home Screen web app. A push subscription is not an indefinitely valid staff login.
- Native notification text is intentionally generic on lock screens. Opening it takes the staff member to their normal authenticated screen, whose existing access checks still apply.

## Checks

`npm run build`, `npm run test:reliability`, `npm run test:security`, and `npm run test:live-orders`.

Database-dependent tests refuse a non-local database. Test VAPID keys are generated only in process; the regression suite does not send to external push services.
