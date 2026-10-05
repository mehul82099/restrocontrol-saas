const test = require('node:test');
const assert = require('node:assert');
const { getDemoContext, prisma, WastageService } = require('./test-helper');

test('7. Wastage Workflow: logs kitchen wastage, handles approval, and creates WASTAGE movement', async () => {
  const { restaurant, outlet, owner, inventoryMgr } = await getDemoContext();

  const onion = await prisma.ingredient.findFirst({ where: { restaurantId: restaurant.id, name: 'Onion' } });

  const initialStock = (
    await prisma.outletInventory.findUnique({
      where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: onion.id } },
    })
  ).currentStock;

  // Record 20 KG of Onion wastage (> 500 threshold to require approval)
  const wastageQty = 20;
  const wastage = await WastageService.recordWastage({
    restaurantId: restaurant.id,
    outletId: outlet.id,
    ingredientId: onion.id,
    quantity: wastageQty,
    unit: 'KG',
    reason: 'SPOILED',
    notes: 'Rain water leak in pantry',
    reportedByUserId: inventoryMgr.id,
  });

  assert.ok(wastage.id, 'Wastage record must be created');
  assert.strictEqual(wastage.status, 'PENDING', 'High wastage must be PENDING manager sign-off');

  // Manager approves wastage
  const approved = await WastageService.approveWastage(
    restaurant.id,
    wastage.id,
    owner.id,
    true
  );

  assert.strictEqual(approved.status, 'APPROVED', 'Wastage status must be APPROVED');

  // Verify WASTAGE ledger movement
  const movement = await prisma.inventoryMovement.findFirst({
    where: {
      referenceId: wastage.id,
      movementType: 'WASTAGE',
      ingredientId: onion.id,
    },
  });

  assert.ok(movement, 'Must create WASTAGE ledger movement');
  assert.strictEqual(movement.quantity, -wastageQty, 'Wastage movement quantity must be negative');

  // Check outlet stock reduced
  const updatedStock = (
    await prisma.outletInventory.findUnique({
      where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: onion.id } },
    })
  ).currentStock;

  assert.strictEqual(updatedStock, initialStock - wastageQty, 'Outlet stock must be reduced by wastage quantity');
});
