if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) throw new Error('Tests require an isolated local database; refusing remote database');
const path = require('path');
const assert = require('node:assert');
const jiti = require('jiti')(path.resolve(__dirname, 'test-helper.js'));

const { prisma } = jiti('../src/server/db/prisma');
const { cache } = jiti('../src/server/cache/redis');
const { OrderService } = jiti('../src/server/services/order.service');
const { RecipeEngineService } = jiti('../src/server/services/recipe-engine.service');
const { InventoryService } = jiti('../src/server/services/inventory.service');
const { PurchaseService } = jiti('../src/server/services/purchase.service');
const { WastageService } = jiti('../src/server/services/wastage.service');
const { StockCountService } = jiti('../src/server/services/stock-count.service');
const { AnalyticsService } = jiti('../src/server/services/analytics.service');
const { hasPermission } = jiti('../src/server/auth/permissions');
const { UnitConverter } = jiti('../src/server/services/unit-converter');

async function runSuite() {
  console.log('================================================================');
  console.log('   RESTROCONTROL AUTOMATED TEST SUITE: 12 CORE LOGIC MODULES    ');
  console.log('================================================================\n');

  const restaurant = await prisma.restaurant.findUnique({ where: { slug: 'demo-kitchen' } });
  const outlet = await prisma.outlet.findFirst({ where: { restaurantId: restaurant.id, isDefault: true } });
  const owner = await prisma.user.findFirst({ where: { restaurantId: restaurant.id, role: 'OWNER' } });
  const inventoryMgr = await prisma.user.findFirst({ where: { restaurantId: restaurant.id, role: 'INVENTORY_MANAGER' } });

  const passedTests = [];
  const failedTests = [];

  async function step(num, title, fn) {
    const label = `[${num.toString().padStart(2, '0')}/12] ${title}`;
    process.stdout.write(`Testing ${label}... `);
    const start = Date.now();
    try {
      await fn();
      const elapsed = Date.now() - start;
      console.log(`✅ PASSED (${elapsed}ms)`);
      passedTests.push({ num, title, elapsed });
    } catch (err) {
      const elapsed = Date.now() - start;
      console.log(`❌ FAILED (${elapsed}ms)`);
      console.error('   Error:', err.message);
      failedTests.push({ num, title, elapsed, error: err.message });
    }
  }

  // TEST 1: Recipe Calculation
  await step(1, 'Recipe Calculation', async () => {
    const biryani = await prisma.menuItem.findFirst({
      where: { restaurantId: restaurant.id, name: 'Chicken Biryani' },
      include: { recipes: { include: { items: { include: { ingredient: true } } } } },
    });
    assert.ok(biryani && biryani.recipes.length > 0, 'Chicken Biryani recipe must exist');
    const recipe = biryani.recipes[0];
    const chickenItem = recipe.items.find((i) => i.ingredient.name === 'Chicken');
    assert.strictEqual(chickenItem.quantity, 250);
    assert.strictEqual(chickenItem.unit, 'G');

    const converted = UnitConverter.convert(250, 'G', 'KG');
    assert.strictEqual(converted, 0.25);

    const costing = await RecipeEngineService.calculateRecipeCost(restaurant.id, biryani.id);
    assert.ok(costing.totalCost > 0);
    assert.ok(costing.items.length >= 4);
  });

  // TEST 2: Inventory Deduction
  await step(2, 'Inventory Deduction', async () => {
    const dish = await prisma.menuItem.findFirst({
      where: { restaurantId: restaurant.id, name: 'Paneer Butter Masala' },
    });
    const paneer = await prisma.ingredient.findFirst({
      where: { restaurantId: restaurant.id, name: 'Paneer' },
    });

    const initialStock = (
      await prisma.outletInventory.findUnique({
        where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: paneer.id } },
      })
    ).currentStock;

    const orderResult = await OrderService.createOrder({
      restaurantId: restaurant.id,
      outletId: outlet.id,
      orderType: 'TAKEAWAY',
      subtotal: dish.basePrice,
      totalAmount: Math.round(dish.basePrice * (1 + dish.taxRate / 100) * 100) / 100,
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

    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        referenceId: orderResult.order.id,
        ingredientId: paneer.id,
        movementType: 'SALE_CONSUMPTION',
      },
    });

    assert.ok(movement, 'Must create SALE_CONSUMPTION movement');
    assert.ok(movement.quantity < 0, 'Movement quantity must be negative');

    const updatedStock = (
      await prisma.outletInventory.findUnique({
        where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: paneer.id } },
      })
    ).currentStock;

    assert.strictEqual(
      updatedStock,
      Math.round((initialStock + movement.quantity) * 1000) / 1000
    );
  });

  // TEST 3: Multiple Quantities
  await step(3, 'Multiple Quantities', async () => {
    const dish = await prisma.menuItem.findFirst({
      where: { restaurantId: restaurant.id, name: 'Chicken Biryani' },
      include: { recipes: { include: { items: { include: { ingredient: true } } } } },
    });
    const chickenItem = dish.recipes[0].items.find((i) => i.ingredient.name === 'Chicken');
    const singlePortionKG = chickenItem.quantity / 1000;
    const orderQty = 4;

    const orderResult = await OrderService.createOrder({
      restaurantId: restaurant.id,
      outletId: outlet.id,
      orderType: 'DINE_IN',
      subtotal: dish.basePrice * orderQty,
      totalAmount: Math.round(dish.basePrice * orderQty * (1 + dish.taxRate / 100) * 100) / 100,
      items: [
        {
          menuItemId: dish.id,
          name: dish.name,
          quantity: orderQty,
          unitPrice: dish.basePrice,
          totalPrice: dish.basePrice * orderQty,
        },
      ],
    });

    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        referenceId: orderResult.order.id,
        ingredientId: chickenItem.ingredientId,
      },
    });

    const expectedDeduction = -1 * (singlePortionKG * orderQty);
    assert.strictEqual(Math.round(movement.quantity * 1000) / 1000, expectedDeduction);
  });

  // TEST 4: Order Cancellation
  await step(4, 'Order Cancellation', async () => {
    const dish = await prisma.menuItem.findFirst({ where: { restaurantId: restaurant.id } });
    const orderResult = await OrderService.createOrder({
      restaurantId: restaurant.id,
      outletId: outlet.id,
      orderType: 'TAKEAWAY',
      subtotal: dish.basePrice,
      totalAmount: Math.round(dish.basePrice * (1 + dish.taxRate / 100) * 100) / 100,
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

    const cancelledOrder = await OrderService.cancelOrder(
      restaurant.id,
      orderResult.order.id,
      owner.id,
      'Test cancellation',
      true
    );

    assert.strictEqual(cancelledOrder.status, 'CANCELLED');
    const reverseMovements = await prisma.inventoryMovement.findMany({
      where: {
        referenceId: orderResult.order.id,
        referenceType: 'ORDER_CANCELLATION',
        movementType: 'ADJUSTMENT',
      },
    });
    assert.ok(reverseMovements.length > 0 && reverseMovements[0].quantity > 0);
  });

  // TEST 5: Refund Handling
  await step(5, 'Refund Handling', async () => {
    const dish = await prisma.menuItem.findFirst({ where: { restaurantId: restaurant.id } });
    const orderResult = await OrderService.createOrder({
      restaurantId: restaurant.id,
      outletId: outlet.id,
      orderType: 'DINE_IN',
      subtotal: dish.basePrice,
      totalAmount: Math.round(dish.basePrice * (1 + dish.taxRate / 100) * 100) / 100,
      items: [
        {
          menuItemId: dish.id,
          name: dish.name,
          quantity: 1,
          unitPrice: dish.basePrice,
          totalPrice: dish.basePrice,
        },
      ],
      payments: [{ amount: dish.basePrice, paymentMethod: 'CARD' }],
    });

    const refunded = await OrderService.refundOrder(
      restaurant.id,
      orderResult.order.id,
      dish.basePrice,
      owner.id,
      'Customer dissatisfied'
    );

    assert.strictEqual(refunded.status, 'REFUNDED');
    assert.strictEqual(refunded.paymentStatus, 'REFUNDED');

    const refundPayment = await prisma.payment.findFirst({
      where: { orderId: orderResult.order.id, amount: -dish.basePrice },
    });
    assert.ok(refundPayment && refundPayment.status === 'REFUNDED');
  });

  // TEST 6: Purchase Receiving
  await step(6, 'Purchase Receiving', async () => {
    const supplier = await prisma.supplier.findFirst({ where: { restaurantId: restaurant.id } });
    const tomato = await prisma.ingredient.findFirst({ where: { restaurantId: restaurant.id, name: 'Tomato' } });

    const initialStock = (
      await prisma.outletInventory.findUnique({
        where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: tomato.id } },
      })
    ).currentStock;

    const poQty = 20;
    const po = await PurchaseService.createPO({
      restaurantId: restaurant.id,
      outletId: outlet.id,
      supplierId: supplier.id,
      items: [{ ingredientId: tomato.id, quantity: poQty, unit: 'KG', unitPrice: 40 }],
      createdByUserId: owner.id,
    });

    const received = await PurchaseService.receiveGoods(
      restaurant.id,
      po.id,
      owner.id,
      'INV-TEST-RECEIVE-1'
    );

    assert.strictEqual(received.purchaseOrder.status, 'RECEIVED');
    const movement = await prisma.inventoryMovement.findFirst({
      where: { referenceId: received.goodsReceipt.id, movementType: 'PURCHASE', ingredientId: tomato.id },
    });
    assert.ok(movement && movement.quantity === poQty);

    const updatedStock = (
      await prisma.outletInventory.findUnique({
        where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: tomato.id } },
      })
    ).currentStock;
    assert.strictEqual(updatedStock, initialStock + poQty);
  });

  // TEST 7: Wastage Workflow
  await step(7, 'Wastage Workflow', async () => {
    const onion = await prisma.ingredient.findFirst({ where: { restaurantId: restaurant.id, name: 'Onion' } });
    const initialStock = (
      await prisma.outletInventory.findUnique({
        where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: onion.id } },
      })
    ).currentStock;

    const wastageQty = 20;
    const wastage = await WastageService.recordWastage({
      restaurantId: restaurant.id,
      outletId: outlet.id,
      ingredientId: onion.id,
      quantity: wastageQty,
      unit: 'KG',
      reason: 'SPOILED',
      reportedByUserId: inventoryMgr.id,
      autoApproveThreshold: 100, // force approval requirement (> 100)
    });

    assert.strictEqual(wastage.status, 'PENDING_APPROVAL');
    const approved = await WastageService.approveWastage(restaurant.id, wastage.id, owner.id, true);
    assert.strictEqual(approved.status, 'APPROVED');

    const movement = await prisma.inventoryMovement.findFirst({
      where: { referenceId: wastage.id, movementType: 'WASTAGE', ingredientId: onion.id },
    });
    assert.ok(movement && movement.quantity === -wastageQty);

    const updatedStock = (
      await prisma.outletInventory.findUnique({
        where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: onion.id } },
      })
    ).currentStock;
    assert.ok(Math.abs(updatedStock - (initialStock - wastageQty)) < 0.000001);
  });

  // TEST 8: Stock Count Workflow
  await step(8, 'Stock Count Workflow', async () => {
    const rice = await prisma.ingredient.findFirst({ where: { restaurantId: restaurant.id, name: 'Rice' } });
    const initialStock = (
      await prisma.outletInventory.findUnique({
        where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: rice.id } },
      })
    ).currentStock;

    const physicalQty = Math.round((initialStock - 1.5) * 100) / 100;
    const result = await StockCountService.submitStockCount({
      restaurantId: restaurant.id,
      outletId: outlet.id,
      conductedByUserId: inventoryMgr.id,
      autoApprove: false,
      items: [{ ingredientId: rice.id, physicalStock: physicalQty, reason: 'Physical audit variance' }],
    });

    assert.strictEqual(result.items[0].variance, -1.5);
    const approved = await StockCountService.approveStockCount(restaurant.id, result.stockCount.id, owner.id, true);
    assert.strictEqual(approved.status, 'APPROVED');

    const movement = await prisma.inventoryMovement.findFirst({
      where: { referenceId: result.stockCount.id, movementType: 'STOCK_COUNT', ingredientId: rice.id },
    });
    assert.ok(movement && movement.quantity === -1.5);

    const updatedStock = (
      await prisma.outletInventory.findUnique({
        where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: rice.id } },
      })
    ).currentStock;
    assert.strictEqual(Math.round(updatedStock * 100) / 100, Math.round(physicalQty * 100) / 100);
  });

  // TEST 9: Expected vs Actual Calculation
  await step(9, 'Expected vs Actual Calculation', async () => {
    const report = await AnalyticsService.getExpectedVsActualConsumption(restaurant.id, outlet.id, {
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 3600000),
    });

    assert.ok(report.items && report.items.length > 0);
    for (const item of report.items) {
      assert.ok(typeof item.expected === 'number');
      assert.ok(typeof item.actual === 'number');
      assert.ok(typeof item.variance === 'number');
      assert.ok(typeof item.variancePercent === 'number');
      assert.ok(Array.isArray(item.explanations));
      assert.strictEqual(item.variance, Math.round((item.actual - item.expected) * 1000) / 1000);
    }
  });

  // TEST 10: Tenant Isolation
  await step(10, 'Tenant Isolation', async () => {
    const restB = await prisma.restaurant.upsert({
      where: { slug: 'tenant-b-bistro' },
      create: { name: 'Tenant B Bistro', slug: 'tenant-b-bistro' },
      update: {},
    });
    const outletB = await prisma.outlet.upsert({
      where: { restaurantId_code: { restaurantId: restB.id, code: 'TB-1' } },
      create: { restaurantId: restB.id, name: 'TB-1', code: 'TB-1', isDefault: true },
      update: {},
    });

    const orderB = await prisma.order.create({
      data: {
        restaurantId: restB.id,
        outletId: outletB.id,
        orderNumber: 'TB-ORD-01',
        orderType: 'DINE_IN',
        status: 'CONFIRMED',
        subtotal: 500,
        totalAmount: 500,
      },
    });

    const ordersA = await prisma.order.findMany({
      where: { restaurantId: restaurant.id, id: orderB.id },
    });
    assert.strictEqual(ordersA.length, 0);

    await assert.rejects(
      async () => {
        await OrderService.cancelOrder(restaurant.id, orderB.id, owner.id, 'Malicious cancel');
      },
      /Order not found or tenant mismatch/i
    );

    await prisma.order.delete({ where: { id: orderB.id } });
  });

  // TEST 11: Role Permissions Matrix
  await step(11, 'Role Permissions Matrix', () => {
    assert.strictEqual(hasPermission('OWNER', 'manage:restaurant'), true);
    assert.strictEqual(hasPermission('OWNER', 'manage:subscription'), true);
    assert.strictEqual(hasPermission('MANAGER', 'access:pos'), true);
    assert.strictEqual(hasPermission('MANAGER', 'manage:recipes'), true);
    assert.strictEqual(hasPermission('MANAGER', 'manage:restaurant'), false);
    assert.strictEqual(hasPermission('CASHIER', 'access:pos'), true);
    assert.strictEqual(hasPermission('CASHIER', 'manage:recipes'), false);
    assert.strictEqual(hasPermission('KITCHEN_STAFF', 'access:kot'), true);
    assert.strictEqual(hasPermission('KITCHEN_STAFF', 'access:pos'), false);
    assert.strictEqual(hasPermission('INVENTORY_MANAGER', 'manage:inventory'), true);
    assert.strictEqual(hasPermission('INVENTORY_MANAGER', 'access:pos'), false);
  });

  // TEST 12: Duplicate Order / Idempotency Protection
  await step(12, 'Duplicate Order / Idempotency Protection', async () => {
    const dish = await prisma.menuItem.findFirst({ where: { restaurantId: restaurant.id } });
    const idempotencyKey = `IDEMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const payload = {
      restaurantId: restaurant.id,
      outletId: outlet.id,
      orderType: 'TAKEAWAY',
      subtotal: dish.basePrice,
      totalAmount: Math.round(dish.basePrice * (1 + dish.taxRate / 100) * 100) / 100,
      idempotencyKey,
      items: [
        { menuItemId: dish.id, name: dish.name, quantity: 1, unitPrice: dish.basePrice, totalPrice: dish.basePrice },
      ],
    };

    const first = await OrderService.createOrder(payload);
    assert.ok(first.order.id);
    assert.strictEqual(first.isDuplicate, false);

    const movements1 = await prisma.inventoryMovement.count({ where: { referenceId: first.order.id } });

    // Second Attempt
    const second = await OrderService.createOrder(payload);
    assert.strictEqual(second.isDuplicate, true);
    assert.strictEqual(second.order.id, first.order.id);

    const countOrders = await prisma.order.count({ where: { restaurantId: restaurant.id, idempotencyKey } });
    assert.strictEqual(countOrders, 1);

    const movements2 = await prisma.inventoryMovement.count({ where: { referenceId: first.order.id } });
    assert.strictEqual(movements2, movements1, 'No duplicate movements allowed on idempotent retry');
  });

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests.length} PASSED, ${failedTests.length} FAILED out of 12 TOTAL`);
  console.log('================================================================');

  await prisma.$disconnect();
  await cache.disconnect();

  if (failedTests.length > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 12 BUSINESS LOGIC TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal suite runner error:', err);
  process.exit(1);
});
