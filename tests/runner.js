const path = require('path');
const { execSync } = require('child_process');

const testFiles = [
  { id: 1, name: 'Recipe Calculation', file: '01_recipe_calculation.test.js' },
  { id: 2, name: 'Inventory Deduction', file: '02_inventory_deduction.test.js' },
  { id: 3, name: 'Multiple Quantities', file: '03_multiple_quantities.test.js' },
  { id: 4, name: 'Order Cancellation', file: '04_order_cancellation.test.js' },
  { id: 5, name: 'Refund Handling', file: '05_refund_handling.test.js' },
  { id: 6, name: 'Purchase Receiving', file: '06_purchase_receiving.test.js' },
  { id: 7, name: 'Wastage Workflow', file: '07_wastage_workflow.test.js' },
  { id: 8, name: 'Stock Count Workflow', file: '08_stock_count_workflow.test.js' },
  { id: 9, name: 'Expected vs Actual Calculation', file: '09_expected_vs_actual.test.js' },
  { id: 10, name: 'Tenant Isolation', file: '10_tenant_isolation.test.js' },
  { id: 11, name: 'Role Permissions Matrix', file: '11_role_permissions.test.js' },
  { id: 12, name: 'Duplicate Order / Idempotency', file: '12_idempotency_protection.test.js' },
];

console.log('================================================================');
console.log('   RESTROCONTROL AUTOMATED TEST SUITE (12 CORE LOGIC MODULES)   ');
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;
const results = [];

for (const t of testFiles) {
  process.stdout.write(`Running [${t.id.toString().padStart(2, '0')}/12] ${t.name}... `);
  const start = Date.now();
  try {
    const filePath = path.join(__dirname, t.file);
    execSync(`node --test "${filePath}"`, {
      stdio: 'pipe',
      timeout: 30000,
      env: process.env,
    });
    const duration = Date.now() - start;
    console.log(`✅ PASSED (${duration}ms)`);
    passedCount++;
    results.push({ ...t, status: 'PASSED', duration });
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`❌ FAILED (${duration}ms)`);
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    failedCount++;
    results.push({ ...t, status: 'FAILED', duration, error: err.message });
  }
}

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of ${testFiles.length} TOTAL`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 ALL 12 BUSINESS LOGIC TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}
