const test = require('node:test');
const assert = require('node:assert');
const { getDemoContext, prisma, StockCountService } = require('./test-helper');

test('8. Stock Count Workflow: records physical count, calculates variance, and applies STOCK_COUNT ledger adjustment', async () => {
  const { restaurant, outlet, owner, inventoryMgr } = await getDemoContext();

  const rice = await prisma.ingredient.findFirst({ where: { restaurantId: restaurant.id, name: 'Rice' } });

  const initialStock = (
    await prisma.outletInventory.findUnique({
      where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: rice.id } },
    })
  ).currentStock;

  // Perform audit: physical stock is 1.5 KG less than system stock
  const physicalQty = Math.round((initialStock - 1.5) * 100) / 100;

  const result = await StockCountService.submitStockCount({
    restaurantId: restaurant.id,
    outletId: outlet.id,
    conductedByUserId: inventoryMgr.id,
    notes: 'Monthly bulk grains audit',
    autoApprove: false,
    items: [
      {
        ingredientId: rice.id,
        physicalStock: physicalQty,
        reason: 'Spillage and measurement loss in storage bin',
      },
    ],
  });

  assert.ok(result.stockCount.id, 'Stock count record created');
  assert.strictEqual(result.items[0].variance, -1.5, 'Variance must be -1.5 KG');

  // Manager approves audit
  const approved = await StockCountService.approveStockCount(
    restaurant.id,
    result.stockCount.id,
    owner.id,
    true
  );

  assert.strictEqual(approved.status, 'APPROVED');

  // Check STOCK_COUNT movement in ledger
  const movement = await prisma.inventoryMovement.findFirst({
    where: {
      referenceId: result.stockCount.id,
      movementType: 'STOCK_COUNT',
      ingredientId: rice.id,
    },
  });

  assert.ok(movement, 'STOCK_COUNT adjustment movement must exist');
  assert.strictEqual(movement.quantity, -1.5, 'Adjustment quantity must be -1.5');

  // Check outlet inventory now equals physicalStock exactly
  const updatedStock = (
    await prisma.outletInventory.findUnique({
      where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: rice.id } },
    })
  ).currentStock;

  assert.strictEqual(updatedStock, physicalQty, 'System stock must now match physical audit count exactly');
});
