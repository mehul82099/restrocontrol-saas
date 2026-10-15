// Run against an isolated local DB only: DATABASE_URL=postgresql://...@localhost/... JWT_SECRET=<32+ chars> node tests/staff-invite-regression.js
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) throw new Error('Isolated local DB required');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(8) + 'unit-test-signing-key-0123456789abcdef';
const assert = require('node:assert/strict');
const jiti = require('jiti')(__filename, {alias: {'@': require('path').resolve(__dirname, '../src')}});
const {prisma} = jiti('../src/server/db/prisma');
const {verifyToken} = jiti('../src/server/auth/jwt');
const svc = jiti('../src/server/services/invite.service');
const {POST: register} = jiti('../src/app/api/auth/register/route');
const {POST: createInvite, GET: listInvites} = jiti('../src/app/api/staff-invites/route');
const {DELETE: revokeInvite} = jiti('../src/app/api/staff-invites/[id]/route');
const {POST: inviteRegister} = jiti('../src/app/api/auth/invite/register/route');
const {GET: preview} = jiti('../src/app/api/auth/invite/preview/route');
const {GET: googleStart} = jiti('../src/app/api/auth/google/start/route');
const {POST: createStaff} = jiti('../src/app/api/users/route');
const {NextRequest} = require('next/server');
const U = 'http://localhost:3000';
const req = (path, o = {}) => new NextRequest(U + path, {method: o.method || (o.body ? 'POST' : 'GET'), headers: {'content-type': 'application/json', ...(o.token ? {cookie: 'token=' + o.token} : {}), ...(o.headers || {})}, ...(o.body ? {body: JSON.stringify(o.body)} : {})});
const tokenOf = (res) => res.cookies.get('token').value;
let n = 0; async function test(name, fn) { await fn(); n++; console.log('PASS ' + name); }
let ip = 0; const nextIp = () => ({'x-forwarded-for': '10.0.0.' + (++ip)});

async function main() {
  const sfx = Date.now();
  const mk = async (tag) => { const r = await register(req('/api/auth/register', {body: {restaurantName: 'Test ' + tag, ownerName: 'Owner ' + tag, email: `owner-${tag}-${sfx}@example.com`, password: 'Passw0rd-long1'}, headers: nextIp()})); assert.equal(r.status, 201); return tokenOf(r); };
  const ownerA = await mk('A'), ownerB = await mk('B');
  const restA = verifyToken(ownerA).restaurantId, restB = verifyToken(ownerB).restaurantId;
  // A manager of restaurant A
  const managerUser = await prisma.user.create({data: {restaurantId: restA, email: `mgr-${sfx}@example.com`, name: 'Mgr', role: 'MANAGER', passwordHash: 'x'}});
  const outletA = await prisma.outlet.findFirst({where: {restaurantId: restA}});
  await prisma.userOutlet.create({data: {userId: managerUser.id, outletId: outletA.id}});
  const mgrTok = require('jsonwebtoken').sign({userId: managerUser.id, restaurantId: restA, role: 'MANAGER', email: managerUser.email, name: 'Mgr', outletId: outletA.id}, process.env.JWT_SECRET, {expiresIn: '1h'});
  const create = async (tok, role, label) => { const r = await createInvite(req('/api/staff-invites', {body: {role, label}, token: tok})); return {status: r.status, body: await r.json()}; };
  const tokenFromLink = (l) => l.split('/join/')[1];

  let inv;
  await test('Owner creates a cashier invite; only hash stored', async () => {
    inv = await create(ownerA, 'CASHIER', 'Ravi'); assert.equal(inv.status, 201);
    const t = tokenFromLink(inv.body.link); assert.equal(t.length, 43);
    const row = await prisma.staffInvite.findUnique({where: {id: inv.body.invite.id}});
    assert.equal(row.tokenHash, svc.hashToken(t)); assert.notEqual(row.tokenHash, t);
    const ttl = row.expiresAt.getTime() - row.createdAt.getTime(); assert.ok(Math.abs(ttl - 48 * 3600e3) < 5000);
    const list = await (await listInvites(req('/api/staff-invites', {token: ownerA}))).json();
    assert.ok(!JSON.stringify(list).includes(t)); assert.ok(!JSON.stringify(list).includes(row.tokenHash));
  });
  await test('Manager can create; Owner/Manager presets and unauthenticated are refused', async () => {
    assert.equal((await create(mgrTok, 'WAITER')).status, 201);
    assert.equal((await create(ownerA, 'OWNER')).status, 400);
    assert.equal((await create(ownerA, 'MANAGER')).status, 400);
    assert.equal((await create(mgrTok, 'MANAGER')).status, 400);
    assert.equal((await create(ownerA, 'INVENTORY_MANAGER')).status, 400);
    assert.equal((await createInvite(req('/api/staff-invites', {body: {role: 'CASHIER'}}))).status, 401);
  });
  await test('Cashier cannot create invites; cross-origin refused', async () => {
    const cash = await inviteRegister(req('/api/auth/invite/register', {body: {token: tokenFromLink((await create(ownerA, 'CASHIER')).body.link), name: 'Cash Ier', email: `c-${sfx}@example.com`, password: 'Passw0rd-long1'}, headers: nextIp()}));
    assert.equal(cash.status, 201);
    assert.equal((await create(tokenOf(cash), 'CASHIER')).status, 403);
    const x = await createInvite(req('/api/staff-invites', {body: {role: 'CASHIER'}, token: ownerA, headers: {origin: 'https://evil.invalid'}})); assert.equal(x.status, 403);
  });
  const t1 = tokenFromLink(inv.body.link);
  await test('Preview shows restaurant and role only', async () => {
    const r = await preview(req('/api/auth/invite/preview?token=' + t1)); const b = await r.json();
    assert.deepEqual(Object.keys(b).sort(), ['expiresAt', 'restaurantName', 'role', 'success']); assert.equal(b.role, 'CASHIER');
    assert.equal((await preview(req('/api/auth/invite/preview?token=nope'))).status, 404);
  });
  let staffTok, staffUser;
  await test('Email signup via invite: inside restaurant A, preset role, attendance token', async () => {
    const r = await inviteRegister(req('/api/auth/invite/register', {body: {token: t1, name: 'Ravi K', email: `Ravi-${sfx}@Example.com`, password: 'Passw0rd-long1', role: 'OWNER', restaurantId: restB}, headers: nextIp()}));
    assert.equal(r.status, 201); staffTok = tokenOf(r); const c = verifyToken(staffTok);
    staffUser = await prisma.user.findUnique({where: {id: c.userId}});
    assert.equal(staffUser.restaurantId, restA); assert.equal(staffUser.role, 'CASHIER'); assert.equal(staffUser.email, `ravi-${sfx}@example.com`);
    assert.ok(c.attendanceSessionId); assert.ok(await prisma.attendanceSession.findUnique({where: {id: c.attendanceSessionId}}));
    assert.equal(await prisma.userOutlet.count({where: {userId: staffUser.id}}), 1);
  });
  await test('Invite is single-use', async () => {
    const r = await inviteRegister(req('/api/auth/invite/register', {body: {token: t1, name: 'Second', email: `second-${sfx}@example.com`, password: 'Passw0rd-long1'}, headers: nextIp()}));
    assert.equal(r.status, 404); assert.equal(await prisma.user.count({where: {email: `second-${sfx}@example.com`}}), 0);
  });
  await test('Concurrent redemption: exactly one wins', async () => {
    const t = tokenFromLink((await create(ownerA, 'KITCHEN_STAFF')).body.link);
    const rs = await Promise.allSettled([0, 1, 2].map(i => svc.redeemInvite({token: t, name: 'Racer ' + i, email: `race${i}-${sfx}@example.com`, password: 'Passw0rd-long1'})));
    assert.equal(rs.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await prisma.user.count({where: {email: {startsWith: 'race'}, restaurantId: restA, name: {startsWith: 'Racer'}}}), 1);
  });
  await test('Expired and revoked links are refused', async () => {
    const e = await create(ownerA, 'WAITER'); await prisma.staffInvite.update({where: {id: e.body.invite.id}, data: {expiresAt: new Date(Date.now() - 1000)}});
    assert.equal((await preview(req('/api/auth/invite/preview?token=' + tokenFromLink(e.body.link)))).status, 404);
    await assert.rejects(svc.redeemInvite({token: tokenFromLink(e.body.link), name: 'Late', email: `late-${sfx}@example.com`, password: 'Passw0rd-long1'}), /invalid, expired/);
    const v = await create(ownerA, 'WAITER');
    assert.equal((await revokeInvite(req('/api/staff-invites/' + v.body.invite.id, {method: 'DELETE', token: ownerA}), {params: Promise.resolve({id: v.body.invite.id})})).status, 200);
    await assert.rejects(svc.redeemInvite({token: tokenFromLink(v.body.link), name: 'Gone', email: `gone-${sfx}@example.com`, password: 'Passw0rd-long1'}), /invalid, expired/);
  });
  await test('Revoke is tenant scoped and manager can revoke', async () => {
    const v = await create(ownerA, 'CASHIER');
    const other = await revokeInvite(req('/api/staff-invites/' + v.body.invite.id, {method: 'DELETE', token: ownerB}), {params: Promise.resolve({id: v.body.invite.id})});
    assert.equal(other.status, 404);
    assert.equal((await revokeInvite(req('/api/staff-invites/' + v.body.invite.id, {method: 'DELETE', token: mgrTok}), {params: Promise.resolve({id: v.body.invite.id})})).status, 200);
  });
  await test('Google-style redemption (no password) joins restaurant, unusable password', async () => {
    const t = tokenFromLink((await create(ownerA, 'WAITER')).body.link);
    const r = await svc.redeemInvite({token: t, name: 'Gina G', email: `gina-${sfx}@gmail.com`});
    assert.equal(r.user.role, 'WAITER'); assert.equal(r.user.restaurantId, restA); assert.ok(verifyToken(r.token).attendanceSessionId);
    assert.ok(!(await require('bcryptjs').compare('', r.user.passwordHash)));
  });
  await test('Existing email and demo email are not touched by an invite', async () => {
    const t = tokenFromLink((await create(ownerA, 'CASHIER')).body.link);
    await assert.rejects(svc.redeemInvite({token: t, name: 'Dup', email: staffUser.email, password: 'Passw0rd-long1'}), /already exists/);
    await assert.rejects(svc.redeemInvite({token: t, name: 'Demo', email: 'x@demokitchen.com', password: 'Passw0rd-long1'}), /valid email/);
    const row = await prisma.staffInvite.findUnique({where: {tokenHash: svc.hashToken(t)}}); assert.equal(row.usedAt, null); // failed attempts do not burn the link
    assert.equal((await prisma.user.findUnique({where: {id: staffUser.id}})).role, 'CASHIER');
  });
  await test('Cannot invite into demo restaurant', async () => {
    const demo = await prisma.restaurant.findUnique({where: {slug: 'demo-kitchen'}});
    if (!demo) return;
    const t = svc.newToken(); const owner = await prisma.user.findFirst({where: {restaurantId: demo.id, role: 'OWNER'}});
    await prisma.staffInvite.create({data: {restaurantId: demo.id, tokenHash: svc.hashToken(t), role: 'CASHIER', createdById: owner.id, expiresAt: new Date(Date.now() + 1e6)}});
    await assert.rejects(svc.redeemInvite({token: t, name: 'Nope', email: `nope-${sfx}@example.com`, password: 'Passw0rd-long1'}), /invalid, expired/);
  });
  await test('Public signup creates a new restaurant, never staff in an existing one', async () => {
    const before = await prisma.user.count({where: {restaurantId: restA}});
    const r = await register(req('/api/auth/register', {body: {restaurantName: 'Test C', ownerName: 'Owner C', email: `c-own-${sfx}@example.com`, password: 'Passw0rd-long1', restaurantId: restA, role: 'CASHIER'}, headers: nextIp()}));
    assert.equal(r.status, 201); const c = verifyToken(tokenOf(r)); assert.notEqual(c.restaurantId, restA); assert.equal(c.role, 'OWNER');
    assert.equal(await prisma.user.count({where: {restaurantId: restA}}), before);
  });
  await test('Manager still cannot create Owner/Manager via users API', async () => {
    for (const role of ['OWNER', 'MANAGER']) {
      const r = await createStaff(req('/api/users', {body: {name: 'X Y', email: `${role}-${sfx}@example.com`, role, password: 'Passw0rd-long12'}, token: mgrTok})); assert.equal(r.status, 403);
    }
  });
  await test('Google start: invite cookie set only for valid invite token', async () => {
    process.env.GOOGLE_CLIENT_ID = 'id'; process.env.GOOGLE_CLIENT_SECRET = 's';
    const t = svc.newToken();
    const ok = await googleStart(req(`/api/auth/google/start?mode=invite&invite=${t}`));
    assert.ok(ok.cookies.get('g_invite')); assert.ok(ok.cookies.get('g_oauth').value.endsWith('.invite'));
    const bad = await googleStart(req('/api/auth/google/start?mode=invite&invite=short'));
    assert.ok(/invite_invalid/.test(bad.headers.get('location'))); assert.ok(!bad.cookies.get('g_invite'));
    const plain = await googleStart(req(`/api/auth/google/start?mode=login&invite=${t}`));
    assert.ok(!plain.cookies.get('g_invite'));
  });
  console.log(`${n} staff-invite checks passed`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
