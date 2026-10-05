const test = require('node:test');
const assert = require('node:assert');
const { getDemoContext, prisma, OrderService } = require('./test-helper');

test('12. Idempotency Protection: retried order submission prevents duplicate billing and deductions', async () => {
  const { restaurant, outlet } = await getDemoContext();

  const dish = await prisma.menuItem.findFirst({ where: { restaurantId: restaurant.id } });
  const idempotencyKey = `IDEMP-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const orderPayload = {
    restaurantId: restaurant.id,
    outletId: outlet.id,
    orderType: 'TAKEAWAY',
    subtotal: dish.basePrice,
    totalAmount: dish.basePrice,
    idempotencyKey,
    items: [
      {
        menuItemId: dish.id,
        name: dish.name,
        quantity: 1,
        unitPrice: dish.basePrice,
        totalPrice: dish.basePrice,
      },
    ],
  };

  // 1st Attempt: Should create order and deduct inventory
  const firstAttempt = await OrderService.createOrder(orderPayload);
  assert.ok(firstAttempt.order.id, 'First attempt must create order');
  assert.strictEqual(firstAttempt.isDuplicate, undefined, 'First attempt should not be flagged duplicate');

  const initialMovementsCount = await prisma.inventoryMovement.count({
    where: { referenceId: firstAttempt.order.id },
  });
  assert.ok(initialMovementsCount > 0, 'First attempt must record inventory movements');

  const ordersCountBefore = await prisma.order.count({
    where: { restaurantId: restaurant.id, idempotencyKey },
  });
  assert.strictEqual(ordersCountBefore, 1, 'Only 1 order record must exist for this key');

  // 2nd Attempt: Identical retry with same idempotency key
  const secondAttempt = await OrderService.createOrder(orderPayload);

  // Assertions:
  assert.strictEqual(secondAttempt.isDuplicate, true, 'Second attempt must be flagged as duplicate');
  assert.strictEqual(secondAttempt.order.id, firstAttempt.order.id, 'Must return the exact same order ID');

  const ordersCountAfter = await prisma.order.count({
    where: { restaurantId: restaurant.id, idempotencyKey },
  });
  assert.strictEqual(ordersCountAfter, 1, 'Still only 1 order record must exist (no duplicate created)');

  const finalMovementsCount = await prisma.inventoryMovement.count({
    where: { referenceId: firstAttempt.order.id },
  });
  assert.strictEqual(
    finalMovementsCount,
    initialMovementsCount,
    'No additional inventory movements should be recorded on duplicate retry'
  );
});
