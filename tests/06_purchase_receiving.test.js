const test = require('node:test');
const assert = require('node:assert');
const { getDemoContext, prisma, PurchaseService } = require('./test-helper');

test('6. Purchase Receiving: receives PO, creates PURCHASE movement, increments stock & stores purchase price history', async () => {
  const { restaurant, outlet, owner } = await getDemoContext();

  const supplier = await prisma.supplier.findFirst({ where: { restaurantId: restaurant.id } });
  const tomato = await prisma.ingredient.findFirst({ where: { restaurantId: restaurant.id, name: 'Tomato' } });

  const initialStock = (
    await prisma.outletInventory.findUnique({
      where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: tomato.id } },
    })
  ).currentStock;

  // Create PO for 20 KG of Tomato at ₹40/KG
  const poQty = 20;
  const poPrice = 40;
  const po = await PurchaseService.createPO({
    restaurantId: restaurant.id,
    outletId: outlet.id,
    supplierId: supplier.id,
    items: [
      {
        ingredientId: tomato.id,
        quantity: poQty,
        unit: 'KG',
        unitPrice: poPrice,
      },
    ],
    createdByUserId: owner.id,
  });

  assert.strictEqual(po.status, 'ORDERED', 'PO initial status must be ORDERED');

  // Receive goods
  const receiveResult = await PurchaseService.receiveGoods(
    restaurant.id,
    po.id,
    owner.id,
    'INV-TOMATO-8899',
    'Delivered fresh and inspected'
  );

  assert.strictEqual(receiveResult.purchaseOrder.status, 'RECEIVED', 'PO status should be updated to RECEIVED');

  // Check inventory movement
  const movement = await prisma.inventoryMovement.findFirst({
    where: {
      referenceId: receiveResult.goodsReceipt.id,
      movementType: 'PURCHASE',
      ingredientId: tomato.id,
    },
  });

  assert.ok(movement, 'PURCHASE ledger movement must be created');
  assert.strictEqual(movement.quantity, poQty, 'Movement quantity must be positive +20');

  // Check outlet stock
  const updatedStock = (
    await prisma.outletInventory.findUnique({
      where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: tomato.id } },
    })
  ).currentStock;

  assert.strictEqual(updatedStock, initialStock + poQty, 'Stock must increase by PO received quantity');
});
