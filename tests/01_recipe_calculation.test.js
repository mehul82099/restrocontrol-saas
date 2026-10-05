const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const jiti = require('jiti')(path.resolve(__dirname, 'test-helper.js'));

const { RecipeEngineService } = jiti('../src/server/services/recipe-engine.service');
const { UnitConverter } = jiti('../src/server/services/unit-converter');
const { prisma } = jiti('../src/server/db/prisma');

test('1. Recipe Calculation: computes raw ingredient proportions accurately', async (t) => {
  const rest = await prisma.restaurant.findUnique({ where: { slug: 'demo-kitchen' } });
  assert.ok(rest, 'Demo restaurant must exist');

  const biryani = await prisma.menuItem.findFirst({
    where: { restaurantId: rest.id, name: 'Chicken Biryani' },
    include: { recipes: { include: { items: { include: { ingredient: true } } } } },
  });
  assert.ok(biryani, 'Chicken Biryani must exist');
  assert.ok(biryani.recipes.length > 0, 'Chicken Biryani must have a recipe mapped');

  const recipe = biryani.recipes[0];
  const chickenItem = recipe.items.find((i) => i.ingredient.name === 'Chicken');
  assert.ok(chickenItem, 'Recipe must have chicken item');
  assert.strictEqual(chickenItem.quantity, 250, 'Chicken quantity per portion should be 250g');
  assert.strictEqual(chickenItem.unit, 'G', 'Unit should be G');

  // Test UnitConverter
  const converted = UnitConverter.convert(250, 'G', 'KG');
  assert.strictEqual(converted, 0.25, '250 G must equal 0.25 KG');

  // Test Recipe Cost Calculation
  const costing = await RecipeEngineService.calculateRecipeCost(rest.id, biryani.id);
  assert.ok(costing.totalCost > 0, 'Calculated recipe cost must be greater than 0');
  assert.ok(costing.items.length >= 4, 'Recipe must have at least 4 ingredient cost components');
});
