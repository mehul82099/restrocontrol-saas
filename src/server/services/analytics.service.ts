import { prisma } from '../db/prisma';
import { MovementType, OrderStatus } from '@prisma/client';
import { UnitConverter } from './unit-converter';

export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

export class AnalyticsService {
  /**
   * Helper to parse date filter strings (today, yesterday, 7days, 30days, custom).
   */
  static parseDateFilter(
    filter?: string,
    customStart?: string,
    customEnd?: string
  ): DateRangeFilter {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (filter === 'yesterday') {
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return { startDate: yesterdayStart, endDate: yesterdayEnd };
    }

    if (filter === '7days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }

    if (filter === '30days') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }

    if (filter === 'custom' && customStart && customEnd) {
      return {
        startDate: new Date(new Date(customStart).setHours(0, 0, 0, 0)),
        endDate: new Date(new Date(customEnd).setHours(23, 59, 59, 999)),
      };
    }

    // Default to 'today'
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { startDate: todayStart, endDate: end };
  }

  /**
   * Core promise: Expected vs Actual Consumption Analysis.
   * Expected = Sold quantity × Recipe quantity.
   * Actual = Total inventory movements (Sales deductions + Wastage + Adjustments).
   */
  static async getExpectedVsActualConsumption(
    restaurantId: string,
    outletId: string,
    dateRange: DateRangeFilter
  ) {
    const { startDate, endDate } = dateRange;

    // 1. Get all completed/confirmed orders in the time range
    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        outletId,
        status: { in: [OrderStatus.CONFIRMED, OrderStatus.COMPLETED, OrderStatus.READY, OrderStatus.PREPARING] },
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        items: true,
      },
    });

    // 2. Fetch all recipes and ingredients
    const recipes = await prisma.recipe.findMany({
      where: { restaurantId },
      include: {
        items: { include: { ingredient: true } },
      },
    });

    const ingredients = await prisma.ingredient.findMany({
      where: { restaurantId },
      include: {
        outletInventories: { where: { outletId } },
      },
    });

    // 3. Calculate EXPECTED consumption per ingredient from sold order items
    const expectedMap = new Map<string, number>();

    for (const order of orders) {
      for (const orderItem of order.items) {
        // Find matching recipe
        const recipe =
          recipes.find((r) => r.menuItemId === orderItem.menuItemId && r.variantId === orderItem.variantId) ||
          recipes.find((r) => r.menuItemId === orderItem.menuItemId && !r.variantId);

        if (!recipe) continue;

        const yieldDivisor = recipe.yieldQuantity > 0 ? recipe.yieldQuantity : 1;

        for (const recipeItem of recipe.items) {
          const portionQty = (recipeItem.quantity / yieldDivisor) * orderItem.quantity;
          const wasteFactor = 1 + (recipeItem.wastePercentage || 0) / 100;
          const rawQty = portionQty * wasteFactor;

          const inStockUnit = UnitConverter.convert(
            rawQty,
            recipeItem.unit,
            recipeItem.ingredient.unit
          );

          const current = expectedMap.get(recipeItem.ingredientId) || 0;
          expectedMap.set(recipeItem.ingredientId, current + inStockUnit);
        }
      }
    }

    // 4. Calculate ACTUAL consumption from ledger movements in the same date range
    // Actual consumption consists of SALE_CONSUMPTION + WASTAGE + negative ADJUSTMENTs
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        restaurantId,
        outletId,
        createdAt: { gte: startDate, lte: endDate },
        movementType: {
          in: [
            MovementType.SALE_CONSUMPTION,
            MovementType.WASTAGE,
            MovementType.ADJUSTMENT,
            MovementType.STOCK_COUNT,
          ],
        },
      },
    });

    const actualMap = new Map<string, { totalActual: number; wastage: number; adjustments: number; salesDeduction: number }>();

    for (const mov of movements) {
      const existing = actualMap.get(mov.ingredientId) || {
        totalActual: 0,
        wastage: 0,
        adjustments: 0,
        salesDeduction: 0,
      };

      // Since consumption/wastage are negative quantities in the ledger, take absolute value for consumption
      const consumedQty = Math.abs(mov.quantity);

      if (mov.movementType === MovementType.SALE_CONSUMPTION) {
        existing.salesDeduction += consumedQty;
        existing.totalActual += consumedQty;
      } else if (mov.movementType === MovementType.WASTAGE) {
        existing.wastage += consumedQty;
        existing.totalActual += consumedQty;
      } else if (mov.movementType === MovementType.ADJUSTMENT || mov.movementType === MovementType.STOCK_COUNT) {
        if (mov.quantity < 0) {
          existing.adjustments += Math.abs(mov.quantity);
          existing.totalActual += Math.abs(mov.quantity);
        } else {
          // If positive adjustment, it reduces net consumption
          existing.adjustments -= mov.quantity;
          existing.totalActual = Math.max(0, existing.totalActual - mov.quantity);
        }
      }

      actualMap.set(mov.ingredientId, existing);
    }

    // 5. Build comparison report for all ingredients
    const comparison = ingredients.map((ing) => {
      const expected = Math.round((expectedMap.get(ing.id) || 0) * 1000) / 1000;
      const actualData = actualMap.get(ing.id) || {
        totalActual: 0,
        wastage: 0,
        adjustments: 0,
        salesDeduction: 0,
      };
      const actual = Math.round(actualData.totalActual * 1000) / 1000;
      const variance = Math.round((actual - expected) * 1000) / 1000;
      const variancePercent = expected > 0 ? Math.round((variance / expected) * 1000) / 10 : 0;
      const varianceCost = Math.round(variance * ing.costPerUnit * 100) / 100;

      // Identify operational explanations without labeling as theft
      const explanations: string[] = [];
      if (variance > 0) {
        if (actualData.wastage > 0) explanations.push(`Recorded wastage of ${actualData.wastage.toFixed(2)} ${ing.unit}`);
        if (actualData.adjustments > 0) explanations.push(`Stock adjustment of ${actualData.adjustments.toFixed(2)} ${ing.unit}`);
        if (Math.abs(actualData.salesDeduction - expected) > 0.01) {
          explanations.push('Recipe portion variance or non-standard portioning');
        } else {
          explanations.push('Portion size variance or preparation excess');
        }
      } else if (variance < 0) {
        explanations.push('Under-portioning, recipe substitution, or unrecorded sales');
      } else {
        explanations.push('Exact match with recipe specification');
      }

      return {
        ingredientId: ing.id,
        ingredientName: ing.name,
        unit: ing.unit,
        costPerUnit: ing.costPerUnit,
        expected,
        actual,
        salesDeduction: Math.round(actualData.salesDeduction * 1000) / 1000,
        wastage: Math.round(actualData.wastage * 1000) / 1000,
        adjustments: Math.round(actualData.adjustments * 1000) / 1000,
        variance,
        variancePercent,
        varianceCost,
        status: Math.abs(variancePercent) > 15 ? 'HIGH_VARIANCE' : Math.abs(variancePercent) > 5 ? 'MODERATE_VARIANCE' : 'ACCEPTABLE',
        explanations,
      };
    });

    // Filter to only ingredients that had expected sales or actual movements
    const activeComparison = comparison.filter((c) => c.expected > 0 || c.actual > 0);

    return {
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      totalIngredientsTracked: activeComparison.length,
      highVarianceCount: activeComparison.filter((c) => c.status === 'HIGH_VARIANCE').length,
      items: activeComparison,
    };
  }

  /**
   * Food Costing Analysis for all menu items.
   * Shows Selling Price, Recipe Cost, Food Cost %, and Gross Contribution.
   */
  static async getFoodCostAnalysis(restaurantId: string) {
    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId, isAvailable: true },
      include: {
        category: true,
        variants: true,
        recipes: {
          include: {
            items: {
              include: { ingredient: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const results = [];

    for (const item of menuItems) {
      const primaryRecipe = item.recipes[0];
      let recipeCost = 0;

      if (primaryRecipe && primaryRecipe.items.length > 0) {
        const yieldDivisor = primaryRecipe.yieldQuantity > 0 ? primaryRecipe.yieldQuantity : 1;
        for (const rItem of primaryRecipe.items) {
          const inStockUnit = UnitConverter.convert(
            rItem.quantity,
            rItem.unit,
            rItem.ingredient.unit
          );
          const effectivePortion = (inStockUnit / yieldDivisor) * (1 + (rItem.wastePercentage || 0) / 100);
          recipeCost += effectivePortion * rItem.ingredient.costPerUnit;
        }
      }

      recipeCost = Math.round(recipeCost * 100) / 100;
      const sellingPrice = item.basePrice;
      const grossContribution = Math.round((sellingPrice - recipeCost) * 100) / 100;
      const foodCostPercentage = sellingPrice > 0 ? Math.round((recipeCost / sellingPrice) * 1000) / 10 : 0;

      results.push({
        id: item.id,
        name: item.name,
        category: item.category.name,
        sellingPrice,
        recipeCost,
        foodCostPercentage,
        grossContribution,
        marginStatus: foodCostPercentage > 35 ? 'HIGH_COST' : foodCostPercentage < 25 ? 'EXCELLENT_MARGIN' : 'HEALTHY_MARGIN',
        hasRecipe: !!primaryRecipe,
      });
    }

    return results;
  }

  /**
   * Main Owner / Manager Dashboard Metrics with Date Filters.
   */
  static async getDashboardMetrics(
    restaurantId: string,
    outletId: string,
    filterString = 'today',
    customStart?: string,
    customEnd?: string
  ) {
    const dateRange = this.parseDateFilter(filterString, customStart, customEnd);
    const { startDate, endDate } = dateRange;

    // 1. Sales & Orders
    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        outletId,
        createdAt: { gte: startDate, lte: endDate },
        status: { notIn: [OrderStatus.CANCELLED] },
      },
      include: {
        items: true,
      },
    });

    const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const ordersCount = orders.length;
    const averageOrderValue = ordersCount > 0 ? Math.round((totalSales / ordersCount) * 100) / 100 : 0;

    // 2. Wastage Summary
    const wastages = await prisma.wastage.findMany({
      where: {
        restaurantId,
        outletId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });
    const totalWastageCost = wastages.reduce((sum, w) => sum + w.totalCost, 0);

    // 3. Low-Stock Ingredients
    const outletInventories = await prisma.outletInventory.findMany({
      where: { restaurantId, outletId },
      include: { ingredient: true },
    });

    const lowStockItems = outletInventories
      .filter((i) => i.currentStock <= i.minimumStock)
      .map((i) => ({
        id: i.id,
        ingredientName: i.ingredient.name,
        currentStock: Math.round(i.currentStock * 100) / 100,
        minimumStock: i.minimumStock,
        unit: i.ingredient.unit,
        isZero: i.currentStock <= 0,
      }));

    // 4. Expected vs Actual Variance Summary
    const varianceData = await this.getExpectedVsActualConsumption(restaurantId, outletId, dateRange);

    // 5. Food Cost & Gross Contribution calculation
    const foodCostItems = await this.getFoodCostAnalysis(restaurantId);
    let totalEstimatedFoodCost = 0;

    for (const order of orders) {
      for (const item of order.items) {
        const fcItem = foodCostItems.find((f) => f.id === item.menuItemId);
        if (fcItem) {
          totalEstimatedFoodCost += fcItem.recipeCost * item.quantity;
        }
      }
    }

    const overallFoodCostPercent = totalSales > 0 ? Math.round((totalEstimatedFoodCost / totalSales) * 1000) / 10 : 30;
    const overallGrossContribution = Math.round((totalSales - totalEstimatedFoodCost) * 100) / 100;

    // 6. Top-selling items
    const itemSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const existing = itemSalesMap.get(item.menuItemId) || { name: item.name, quantity: 0, revenue: 0 };
        existing.quantity += item.quantity;
        existing.revenue += item.totalPrice;
        itemSalesMap.set(item.menuItemId, existing);
      }
    }
    const topSellingItems = Array.from(itemSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // 7. Low-margin items
    const lowMarginItems = foodCostItems
      .filter((i) => i.hasRecipe)
      .sort((a, b) => b.foodCostPercentage - a.foodCostPercentage)
      .slice(0, 5);

    // 8. Recent Purchases
    const recentPurchases = await prisma.purchaseOrder.findMany({
      where: { restaurantId, outletId },
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      dateRange: {
        filter: filterString,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalSales: Math.round(totalSales * 100) / 100,
        ordersCount,
        averageOrderValue,
        overallFoodCostPercent,
        overallGrossContribution,
        totalWastageCost: Math.round(totalWastageCost * 100) / 100,
        lowStockCount: lowStockItems.length,
      },
      lowStockItems,
      varianceSummary: {
        totalTracked: varianceData.totalIngredientsTracked,
        highVarianceCount: varianceData.highVarianceCount,
        topVariances: varianceData.items.slice(0, 5),
      },
      topSellingItems,
      lowMarginItems,
      recentPurchases: recentPurchases.map((p) => ({
        id: p.id,
        poNumber: p.poNumber,
        supplierName: p.supplier.name,
        totalAmount: p.totalAmount,
        status: p.status,
        createdAt: p.createdAt,
      })),
    };
  }
}
