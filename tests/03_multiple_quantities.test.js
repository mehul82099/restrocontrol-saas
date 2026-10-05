const test = require('node:test');
const assert = require('node:assert');
const { getDemoContext, prisma, OrderService, RecipeEngineService } = require('./test-helper');

test('3. Multiple Quantities: recipe consumption scales linearly with item quantity', async () => {
  const { restaurant, outlet } = await getDemoContext();

  const dish = await prisma.menuItem.findFirst({
    where: { restaurantId: restaurant.id, name: 'Chicken Biryani' },
    include: { recipes: { include: { items: { include: { ingredient: true } } } } },
  });
  assert.ok(dish, 'Chicken Biryani must exist');

  const chickenRecipeItem = dish.recipes[0].items.find((i) => i.ingredient.name === 'Chicken');
  assert.ok(chickenRecipeItem, 'Recipe must contain chicken');

  // Single portion expected consumption in KG: 250g chicken = 0.25 KG
  const singlePortionKG = chickenRecipeItem.quantity / 1000;
  const orderQty = 4;

  const orderResult = await OrderService.createOrder({
    restaurantId: restaurant.id,
    outletId: outlet.id,
    orderType: 'DINE_IN',
    subtotal: dish.basePrice * orderQty,
    totalAmount: dish.basePrice * orderQty,
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
      ingredientId: chickenRecipeItem.ingredientId,
    },
  });

  assert.ok(movement, 'Movement for chicken must exist');
  const expectedDeduction = -1 * (singlePortionKG * orderQty);
  assert.strictEqual(
    Math.round(movement.quantity * 1000) / 1000,
    expectedDeduction,
    `Movement quantity should be exactly ${expectedDeduction} KG for 4 portions`
  );
});
