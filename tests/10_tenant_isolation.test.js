const test = require('node:test');
const assert = require('node:assert');
const { getDemoContext, prisma, OrderService, InventoryService } = require('./test-helper');

test('10. Tenant Isolation: strict multi-tenant boundary prevents cross-restaurant data access or modification', async () => {
  const { restaurant: restA, outlet: outletA, owner: ownerA } = await getDemoContext();

  // Create Restaurant B
  const restB = await prisma.restaurant.upsert({
    where: { slug: 'test-isolated-bistro' },
    create: {
      name: 'Test Isolated Bistro',
      slug: 'test-isolated-bistro',
      email: 'bistro@test.com',
      phone: '+91 99999 88888',
    },
    update: {},
  });

  const outletB = await prisma.outlet.upsert({
    where: { restaurantId_code: { restaurantId: restB.id, code: 'OUT-B1' } },
    create: {
      restaurantId: restB.id,
      name: 'Bistro Downtown',
      code: 'OUT-B1',
      isDefault: true,
    },
    update: {},
  });

  // Create an order in Restaurant B
  const orderB = await prisma.order.create({
    data: {
      restaurantId: restB.id,
      outletId: outletB.id,
      orderNumber: `ORD-BISTRO-001`,
      orderType: 'DINE_IN',
      status: 'CONFIRMED',
      subtotal: 1000,
      totalAmount: 1000,
    },
  });

  // 1. Verify restaurant A cannot find Restaurant B's order when scoping by restaurantId
  const ordersForA = await prisma.order.findMany({
    where: {
      restaurantId: restA.id,
      id: orderB.id,
    },
  });
  assert.strictEqual(ordersForA.length, 0, 'Restaurant A query must never return Restaurant B order');

  // 2. Verify OrderService.cancelOrder rejects cross-tenant operation
  await assert.rejects(
    async () => {
      await OrderService.cancelOrder(
        restA.id, // passing Restaurant A ID
        orderB.id, // passing Restaurant B Order ID
        ownerA.id,
        'Cross tenant malicious cancel'
      );
    },
    /Order not found or tenant mismatch/i,
    'Attempting to cancel another tenant order must throw tenant mismatch error'
  );

  // 3. Clean up test order
  await prisma.order.delete({ where: { id: orderB.id } });
});
