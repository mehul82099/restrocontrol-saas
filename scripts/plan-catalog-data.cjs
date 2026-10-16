const catalog = require('../src/lib/plan-catalog.json');
function catalogueRows() {
  return catalog.map(plan => ({code:plan.code,name:plan.name,priceMonthly:plan.price,priceYearly:null,maxOutlets:plan.maxOutlets,maxUsers:plan.maxUsers,maxOrdersPerMonth:plan.maxOrdersPerMonth,isAvailable:!plan.upcoming,hasAdvancedReports:!plan.upcoming,hasAiFeatures:false,features:JSON.stringify([plan.description,...(plan.upcoming?['Upcoming - unavailable']:['POS, inventory, recipes, purchases, stock audits and reports'])])}));
}
module.exports = { catalogueRows };
