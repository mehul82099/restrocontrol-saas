const test = require('node:test');
const assert = require('node:assert');
const { getDemoContext, prisma, OrderService } = require('./test-helper');

test('4. Order Cancellation: cancels order and optionally reverses inventory consumption', async () => {
  const { restaurant, outlet, owner } = await getDemoContext();

  const dish = await prisma.menuItem.findFirst({ where: { restaurantId: restaurant.id } });

  const orderResult = await OrderService.createOrder({
    restaurantId: restaurant.id,
    outletId: outlet.id,
    orderType: 'TAKEAWAY',
    subtotal: dish.basePrice,
    totalAmount: dish.basePrice,
    items: [
      {
        menuItemId: dish.id,
        name: dish.name,
        quantity: 1,
        unitPrice: dish.basePrice,
        totalPrice: dish.basePrice,
      },
    ],
  });

  const orderId = orderResult.order.id;

  // Cancel order
  const cancelledOrder = await OrderService.cancelOrder(
    restaurant.id,
    orderId,
    owner.id,
    'Customer cancelled prior to cooking',
    true // reverseStock
  );

  assert.strictEqual(cancelledOrder.status, 'CANCELLED', 'Order status must be CANCELLED');
  assert.strictEqual(cancelledOrder.cancellationReason, 'Customer cancelled prior to cooking');

  // Verify reverse movement created
  const reverseMovements = await prisma.inventoryMovement.findMany({
    where: {
      referenceId: orderId,
      movementType: 'CANCELLED_RESTORE',
    },
  });

  assert.ok(reverseMovements.length > 0, 'Should have CANCELLED_RESTORE inventory movements');
  assert.ok(reverseMovements[0].quantity > 0, 'Reversal movement quantity must be positive (replenish)');
});
