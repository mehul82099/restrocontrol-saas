const path = require('path');
const jiti = require('jiti')(path.resolve(__dirname, 'test-helper.js'));

const { prisma } = jiti('../src/server/db/prisma');
const { OrderService } = jiti('../src/server/services/order.service');
const { RecipeEngineService } = jiti('../src/server/services/recipe-engine.service');
const { InventoryService } = jiti('../src/server/services/inventory.service');
const { PurchaseService } = jiti('../src/server/services/purchase.service');
const { WastageService } = jiti('../src/server/services/wastage.service');
const { StockCountService } = jiti('../src/server/services/stock-count.service');
const { AnalyticsService } = jiti('../src/server/services/analytics.service');
const { hasPermission, ROLE_PERMISSIONS } = jiti('../src/server/auth/permissions');

async function getDemoContext() {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: 'demo-kitchen' } });
  const outlet = await prisma.outlet.findFirst({ where: { restaurantId: restaurant.id, isDefault: true } });
  const owner = await prisma.user.findFirst({ where: { restaurantId: restaurant.id, role: 'OWNER' } });
  const cashier = await prisma.user.findFirst({ where: { restaurantId: restaurant.id, role: 'CASHIER' } });
  const kitchen = await prisma.user.findFirst({ where: { restaurantId: restaurant.id, role: 'KITCHEN_STAFF' } });
  const inventoryMgr = await prisma.user.findFirst({ where: { restaurantId: restaurant.id, role: 'INVENTORY_MANAGER' } });

  return {
    restaurant,
    outlet,
    owner,
    cashier,
    kitchen,
    inventoryMgr,
  };
}

module.exports = {
  prisma,
  OrderService,
  RecipeEngineService,
  InventoryService,
  PurchaseService,
  WastageService,
  StockCountService,
  AnalyticsService,
  hasPermission,
  ROLE_PERMISSIONS,
  getDemoContext,
};
