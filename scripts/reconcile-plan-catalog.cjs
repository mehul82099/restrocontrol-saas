/* Review-only migration preparation. Default is a read-only dry run.
 * Apply is restricted to an isolated localhost database. No production apply route.
 */
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const CATALOG = [
  { code: 'WEBSITE_SINGLE', name: '1 outlet setup', price: 499, upcoming: false },
  { code: 'WEBSITE_MULTI', name: '2 or more outlets', price: 699, upcoming: false },
  { code: 'APP_SINGLE', name: 'App + website access', price: 699, upcoming: true },
  { code: 'APP_MULTI', name: 'App + website, 2+ outlets', price: 999, upcoming: true },
];
function compile(config) {
  if (config.billingFrequency !== 'MONTHLY' || config.monthlyCadenceConfirmed !== true) throw new Error('Monthly cadence must be confirmed before writing into priceMonthly fields.');
  return CATALOG.map(p => {
    const q = config.quotas?.[p.code];
    if (!q) throw new Error(`Missing approved quotas: ${p.code}`);
    for (const field of ['maxOutlets','maxUsers','maxOrdersPerMonth']) if (!Number.isSafeInteger(q[field]) || q[field] < 1) throw new Error(`Explicit positive quota required: ${p.code}.${field}. Do not use a guessed unlimited sentinel.`);
    if (p.code === 'WEBSITE_SINGLE' && q.maxOutlets !== 1) throw new Error('Website single plan must have one outlet.');
    if (p.code.endsWith('_MULTI') && q.maxOutlets < 2) throw new Error('Multi-outlet plan must support at least two outlets.');
    if (typeof q.hasAdvancedReports !== 'boolean' || typeof q.hasAiFeatures !== 'boolean') throw new Error('Feature entitlements require explicit review.');
    return { code:p.code, name:p.name, priceMonthly:p.price, priceYearly:0, maxOutlets:q.maxOutlets, maxUsers:q.maxUsers, maxOrdersPerMonth:q.maxOrdersPerMonth, hasAdvancedReports:q.hasAdvancedReports, hasAiFeatures:q.hasAiFeatures, features:JSON.stringify([p.upcoming ? 'Upcoming - not available for purchase' : 'Website access', p.name, 'No annual plan is offered']) };
  });
}
async function main() {
  const file = process.argv.find(x => x.startsWith('--config='))?.slice(9);
  if (!file) throw new Error('Use --config=/path/to/reviewed-config.json. Default is dry-run; --apply is localhost only.');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  const plans = compile(config);
  const apply = process.argv.includes('--apply');
  if (apply) {
    const host = new URL(process.env.DATABASE_URL || '').hostname;
    if (!['localhost','127.0.0.1','[::1]'].includes(host)) throw new Error('Apply is restricted to an isolated local database. Production migration is a separate reviewed operation.');
  }
  const prisma = new PrismaClient();
  try {
    const subscriptions = await prisma.subscription.findMany({include:{plan:true}});
    const assignments = config.restaurantAssignments || {};
    const moves = [];
    for (const [restaurantId, code] of Object.entries(assignments)) {
      const sub = subscriptions.find(s=>s.restaurantId === restaurantId);
      const plan = CATALOG.find(p=>p.code === code && !p.upcoming);
      if (!sub || !plan) throw new Error('Assignment must name an existing restaurant and an available website plan.');
      const outletCount = await prisma.outlet.count({where:{restaurantId,isActive:true}});
      const userCount = await prisma.user.count({where:{restaurantId,isActive:true}});
      const target = plans.find(p=>p.code === code);
      if (outletCount > target.maxOutlets || userCount > target.maxUsers) throw new Error('Assignment exceeds reviewed quota; resolve without deleting data.');
      moves.push({restaurantId,from:sub.plan.code,to:code});
    }
    const report = {dryRun:!apply,plans,moves,unassigned:subscriptions.filter(s=>!assignments[s.restaurantId]).map(s=>({restaurantId:s.restaurantId,planCode:s.plan.code})),notes:['No automatic legacy-tier mapping.','No subscription status, payment, mandate or period changes.','No legacy plan deletion. Unassigned accounts retain existing entitlements.','priceYearly=0 is not a free annual offer; annual billing must stay disabled.']};
    if (apply) await prisma.$transaction(async tx=>{
      for (const plan of plans) await tx.plan.upsert({where:{code:plan.code},create:plan,update:plan});
      for (const move of moves) {
        const plan = await tx.plan.findUniqueOrThrow({where:{code:move.to}});
        await tx.subscription.update({where:{restaurantId:move.restaurantId},data:{planId:plan.id}});
      }
    });
    console.log(JSON.stringify(report,null,2));
  } finally { await prisma.$disconnect(); }
}
module.exports = { compile, CATALOG };
if (require.main === module) main().catch(error=>{console.error(error.message);process.exitCode=1;});
