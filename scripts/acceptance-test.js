const jiti = require('jiti')(__filename);
const { OrderService } = jiti('../src/server/services/order.service');
const { AnalyticsService } = jiti('../src/server/services/analytics.service');
const { prisma } = jiti('../src/server/db/prisma');

async function runAcceptanceTest() {
  console.log('=== RUNNING RESTROCONTROL ACCEPTANCE TEST ===');

  const rest = await prisma.restaurant.findUnique({ where: { slug: 'demo-kitchen' } });
  const outlet = await prisma.outlet.findFirst({ where: { restaurantId: rest.id, isDefault: true } });
  const biryani = await prisma.menuItem.findFirst({ where: { restaurantId: rest.id, name: 'Chicken Biryani' } });
  const chicken = await prisma.ingredient.findFirst({ where: { restaurantId: rest.id, name: 'Chicken' } });

  // Set initial stock to 50 KG as required by acceptance test
  const testStartTime = new Date();
  await prisma.ingredient.update({ where: { id: chicken.id }, data: { currentStock: 50 } });
  await prisma.outletInventory.update({
    where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: chicken.id } },
    data: { currentStock: 50 },
  });

  console.log(`Step 1: Ingredient Initial Stock -> Chicken = 50 KG`);
  console.log(`Step 2: Menu Item -> Chicken Biryani = ₹${biryani.basePrice}`);

  // 10 x Chicken Biryani
  const orderResult = await OrderService.createOrder({
    restaurantId: rest.id,
    outletId: outlet.id,
    orderType: 'DINE_IN',
    subtotal: 2500,
    totalAmount: 2500,
    items: [
      {
        menuItemId: biryani.id,
        name: biryani.name,
        quantity: 10,
        unitPrice: 250,
        totalPrice: 2500,
      },
    ],
    payments: [
      {
        amount: 2500,
        paymentMethod: 'UPI',
        transactionRef: 'UPI-ACCEPTANCE-101',
      },
    ],
  });

  console.log(`Step 3: Order Completed -> ${orderResult.order.orderNumber} (Sales: ₹${orderResult.order.totalAmount})`);

  const updatedChicken = await prisma.ingredient.findUnique({ where: { id: chicken.id } });
  const outletChicken = await prisma.outletInventory.findUnique({
    where: { outletId_ingredientId: { outletId: outlet.id, ingredientId: chicken.id } },
  });

  console.log(`Step 4: Stock Check -> Master: ${updatedChicken.currentStock} KG, Outlet: ${outletChicken.currentStock} KG`);

  // Verify Inventory Movement
  const movement = await prisma.inventoryMovement.findFirst({
    where: {
      referenceId: orderResult.order.id,
      ingredientId: chicken.id,
    },
  });

  console.log(`Step 5: Ledger Movement -> Type: ${movement.movementType}, Quantity: ${movement.quantity} ${movement.unit}`);

  // Verify Dashboard Analytics
  const varianceReport = await AnalyticsService.getExpectedVsActualConsumption(rest.id, outlet.id, {
    startDate: testStartTime,
    endDate: new Date(Date.now() + 10000),
  });

  const chickenVar = varianceReport.items.find((i) => i.ingredientName === 'Chicken');
  console.log(`Step 6: Dashboard Expected Consumption -> ${chickenVar?.expected} KG`);
  console.log(`Step 7: Dashboard Actual Consumption -> ${chickenVar?.actual} KG`);
  console.log(`Step 8: Variance -> ${chickenVar?.variance} KG (${chickenVar?.variancePercent}%)`);

  // Assertions
  const asserts = [
    { name: 'Sales == ₹2500', pass: orderResult.order.totalAmount === 2500 },
    { name: 'Inventory Movement Quantity == -2.5 KG', pass: movement.quantity === -2.5 },
    { name: 'Remaining Chicken Stock == 47.5 KG', pass: outletChicken.currentStock === 47.5 },
    { name: 'Expected Consumption == 2.5 KG', pass: chickenVar.expected === 2.5 },
    { name: 'Variance == 0 (matches recipe)', pass: chickenVar.variance === 0 },
  ];

  console.log('\n--- VERIFICATION CHECKLIST ---');
  let allPass = true;
  for (const a of asserts) {
    console.log(`${a.pass ? '✅' : '❌'} ${a.name}`);
    if (!a.pass) allPass = false;
  }

  if (allPass) {
    console.log('\n🎉 ALL ACCEPTANCE TEST CRITERIA MET PERFECTLY!');
  } else {
    console.error('\n⚠️ SOME CHECKS FAILED');
    process.exit(1);
  }
}

runAcceptanceTest()
  .catch((e) => {
    console.error('Test execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    const { cache } = jiti('../src/server/cache/redis');
    await cache.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });
