const test = require('node:test');
const assert = require('node:assert');
const { getDemoContext, prisma, OrderService } = require('./test-helper');

test('2. Inventory Deduction: automatically creates SALE_CONSUMPTION ledger movement', async () => {
  const { restaurant, outlet } = await getDemoContext();

  const paneerItem = await prisma.menuItem.findFirst({
    where: { restaurantId: restaurant.id, name: 'Paneer Butter Masala' },
  });
  assert.ok(paneerItem, 'Paneer Butter Masala must exist');

  const paneerIng = await prisma.ingredient.findFirst({
    where: { restaurantId: restaurant.id, name: 'Paneer' },
  });
  assert.ok(paneerIng, 'Paneer ingredient must exist');

  const initialStock = (
    await prisma.outletInventory.findUnique({
      where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: paneerIng.id } },
    })
  ).currentStock;

  const result = await OrderService.createOrder({
    restaurantId: restaurant.id,
    outletId: outlet.id,
    orderType: 'TAKEAWAY',
    subtotal: paneerItem.basePrice,
    totalAmount: paneerItem.basePrice,
    items: [
      {
        menuItemId: paneerItem.id,
        name: paneerItem.name,
        quantity: 1,
        unitPrice: paneerItem.basePrice,
        totalPrice: paneerItem.basePrice,
      },
    ],
  });

  assert.ok(result.order, 'Order must be created');

  // Verify movement
  const movement = await prisma.inventoryMovement.findFirst({
    where: {
      referenceId: result.order.id,
      ingredientId: paneerIng.id,
      movementType: 'SALE_CONSUMPTION',
    },
  });

  assert.ok(movement, 'Must create SALE_CONSUMPTION movement');
  assert.ok(movement.quantity < 0, 'Movement quantity must be negative deduction');

  // Verify stock updated
  const updatedStock = (
    await prisma.outletInventory.findUnique({
      where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: paneerIng.id } },
    })
  ).currentStock;

  const expectedStock = Math.round((initialStock + movement.quantity) * 1000) / 1000;
  assert.strictEqual(updatedStock, expectedStock, 'Outlet stock must be reduced by exact movement quantity');
});
