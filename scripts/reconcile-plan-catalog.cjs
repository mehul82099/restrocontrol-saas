/* Default read-only dry run. --apply is restricted to an isolated localhost DB.
 * No production apply route. Schema SQL must be reviewed/applied separately.
 */
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { catalogueRows } = require('./plan-catalog-data.cjs');
const CATALOG = require('../src/lib/plan-catalog.json');
function compile() { return catalogueRows(); }
async function main() {
  const file = process.argv.find(x => x.startsWith('--config='))?.slice(9);
  const config = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const plans = compile();
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
      const outlets = await prisma.outlet.count({where:{restaurantId,isActive:true}});
      if (plan.maxOutlets !== null && outlets > plan.maxOutlets) throw new Error('Assignment exceeds reviewed outlet quota; resolve without deleting data.');
      moves.push({restaurantId,from:sub.plan.code,to:code});
    }
    const report = {dryRun:!apply,plans,moves,unassigned:subscriptions.filter(s=>!assignments[s.restaurantId]).map(s=>({restaurantId:s.restaurantId,planCode:s.plan.code})),notes:['No automatic legacy-tier mapping.','No subscription status, payment, mandate or period changes.','No legacy plan deletion. Unassigned accounts retain existing entitlements.','priceYearly=null means no annual offer. null quotas mean unlimited.']};
    if (apply) await prisma.$transaction(async tx=>{
      for (const plan of plans) await tx.plan.upsert({where:{code:plan.code},create:plan,update:plan});
      for (const move of moves) {
        const plan = await tx.plan.findUniqueOrThrow({where:{code:move.to}});
        // Recheck in the transaction; never delete excess outlets or silently downgrade.
        const count = await tx.outlet.count({where:{restaurantId:move.restaurantId,isActive:true}});
        if (plan.maxOutlets !== null && count > plan.maxOutlets) throw new Error('Outlet quota changed since dry run.');
        await tx.subscription.update({where:{restaurantId:move.restaurantId},data:{planId:plan.id}});
      }
    },{isolationLevel:'Serializable'});
    console.log(JSON.stringify(report,null,2));
  } finally { await prisma.$disconnect(); }
}
module.exports = { compile, CATALOG };
if (require.main === module) main().catch(error=>{console.error(error.message);process.exitCode=1;});
