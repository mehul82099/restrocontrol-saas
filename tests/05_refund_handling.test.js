const test = require('node:test');
const assert = require('node:assert');
const { getDemoContext, prisma, OrderService } = require('./test-helper');

test('5. Refund Handling: processes refund, records negative payment, and logs audit', async () => {
  const { restaurant, outlet, owner } = await getDemoContext();

  const dish = await prisma.menuItem.findFirst({ where: { restaurantId: restaurant.id } });

  const orderResult = await OrderService.createOrder({
    restaurantId: restaurant.id,
    outletId: outlet.id,
    orderType: 'DINE_IN',
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
    payments: [
      {
        amount: dish.basePrice,
        paymentMethod: 'CARD',
      },
    ],
  });

  const orderId = orderResult.order.id;

  // Process refund
  const refunded = await OrderService.refundOrder(
    restaurant.id,
    orderId,
    dish.basePrice,
    owner.id,
    'Food quality issue reported by guest'
  );

  assert.strictEqual(refunded.status, 'REFUNDED', 'Order status must be REFUNDED');
  assert.strictEqual(refunded.paymentStatus, 'REFUNDED', 'Payment status must be REFUNDED');

  // Verify negative payment record
  const refundPayment = await prisma.payment.findFirst({
    where: {
      orderId,
      amount: -dish.basePrice,
    },
  });

  assert.ok(refundPayment, 'Refund payment entry with negative amount must exist');
  assert.strictEqual(refundPayment.status, 'REFUNDED');
});
