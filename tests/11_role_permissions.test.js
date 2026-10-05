const test = require('node:test');
const assert = require('node:assert');
const { hasPermission } = require('./test-helper');

test('11. Role Permissions: validates authorization matrix across all 5 roles', () => {
  // OWNER has full access
  assert.strictEqual(hasPermission('OWNER', 'manage:restaurant'), true, 'Owner has manage:restaurant');
  assert.strictEqual(hasPermission('OWNER', 'manage:subscription'), true, 'Owner has manage:subscription');
  assert.strictEqual(hasPermission('OWNER', 'access:pos'), true, 'Owner has access:pos');
  assert.strictEqual(hasPermission('OWNER', 'access:kot'), true, 'Owner has access:kot');
  assert.strictEqual(hasPermission('OWNER', 'approve:wastage'), true, 'Owner has approve:wastage');

  // MANAGER
  assert.strictEqual(hasPermission('MANAGER', 'access:pos'), true, 'Manager has access:pos');
  assert.strictEqual(hasPermission('MANAGER', 'manage:recipes'), true, 'Manager can manage recipes');
  assert.strictEqual(hasPermission('MANAGER', 'approve:wastage'), true, 'Manager can approve wastage');
  assert.strictEqual(hasPermission('MANAGER', 'manage:restaurant'), false, 'Manager cannot manage restaurant settings');
  assert.strictEqual(hasPermission('MANAGER', 'manage:subscription'), false, 'Manager cannot manage subscription');

  // CASHIER
  assert.strictEqual(hasPermission('CASHIER', 'access:pos'), true, 'Cashier can access POS');
  assert.strictEqual(hasPermission('CASHIER', 'manage:orders'), true, 'Cashier can manage orders');
  assert.strictEqual(hasPermission('CASHIER', 'manage:recipes'), false, 'Cashier CANNOT manage recipes');
  assert.strictEqual(hasPermission('CASHIER', 'manage:inventory'), false, 'Cashier CANNOT modify inventory master');
  assert.strictEqual(hasPermission('CASHIER', 'approve:wastage'), false, 'Cashier CANNOT approve wastage');

  // KITCHEN STAFF
  assert.strictEqual(hasPermission('KITCHEN_STAFF', 'access:kot'), true, 'Kitchen staff can access KOT/KDS');
  assert.strictEqual(hasPermission('KITCHEN_STAFF', 'update:kot_status'), true, 'Kitchen staff can update KOT status');
  assert.strictEqual(hasPermission('KITCHEN_STAFF', 'access:pos'), false, 'Kitchen staff CANNOT access POS checkout');
  assert.strictEqual(hasPermission('KITCHEN_STAFF', 'view:reports'), false, 'Kitchen staff CANNOT view sales reports');

  // INVENTORY MANAGER
  assert.strictEqual(hasPermission('INVENTORY_MANAGER', 'manage:inventory'), true, 'Inventory Manager manages inventory');
  assert.strictEqual(hasPermission('INVENTORY_MANAGER', 'manage:purchases'), true, 'Inventory Manager manages purchases');
  assert.strictEqual(hasPermission('INVENTORY_MANAGER', 'manage:wastage'), true, 'Inventory Manager logs wastage');
  assert.strictEqual(hasPermission('INVENTORY_MANAGER', 'access:pos'), false, 'Inventory Manager CANNOT access POS billing');
  assert.strictEqual(hasPermission('INVENTORY_MANAGER', 'manage:subscription'), false, 'Inventory Manager CANNOT manage subscriptions');
});
