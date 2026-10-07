import { prisma } from '../db/prisma';
import { UnitConverter } from './unit-converter';

export interface CalculatedConsumptionItem {
  ingredientId: string;
  ingredientName: string;
  recipeUnit: string;
  rawRecipeQuantity: number;
  inventoryUnit: string;
  quantityToDeduct: number; // in ingredient's inventory unit
  costPerUnit: number;
  totalCost: number;
}

export interface OrderItemInput {
  menuItemId: string;
  variantId?: string | null;
  quantity: number;
  addons?: string[];
}

export class RecipeEngineService {
  /**
   * Calculates recipe food cost and margin for a given menu item (and optional variant).
   */
  static async calculateRecipeCost(
    restaurantId: string,
    menuItemId: string,
    variantId?: string | null
  ) {
    const recipe = await prisma.recipe.findFirst({
      where: {
        restaurantId,
        menuItemId,
        variantId: variantId || null,
      },
      include: {
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!recipe || recipe.items.length === 0) {
      return {
        recipeId: null,
        recipeName: null,
        totalCost: 0,
        items: [],
      };
    }

    let totalCost = 0;
    const items = recipe.items.map((item) => {
      // Convert recipe item quantity from recipe unit to ingredient stock unit
      const inStockUnit = UnitConverter.convert(
        item.quantity,
        item.unit,
        item.ingredient.unit
      );
      // Account for waste percentage: e.g. 5% waste -> quantity * 1.05
      const effectiveQty = inStockUnit * (1 + (item.wastePercentage || 0) / 100);
      const itemCost = effectiveQty * item.ingredient.costPerUnit / (recipe.yieldQuantity > 0 ? recipe.yieldQuantity : 1);
      totalCost += itemCost;

      return {
        ingredientId: item.ingredientId,
        ingredientName: item.ingredient.name,
        quantity: item.quantity,
        unit: item.unit,
        wastePercentage: item.wastePercentage,
        stockUnit: item.ingredient.unit,
        stockQuantity: effectiveQty,
        costPerUnit: item.ingredient.costPerUnit,
        totalCost: itemCost,
      };
    });

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      totalCost: Math.round(totalCost * 100) / 100,
      items,
    };
  }

  /**
   * Calculates total ingredient consumption for a batch of order items.
   * Aggregates common ingredients across items.
   */
  static async calculateOrderConsumption(
    restaurantId: string,
    orderItems: OrderItemInput[]
  ): Promise<CalculatedConsumptionItem[]> {
    const consumptionMap = new Map<string, CalculatedConsumptionItem>();

    for (const orderItem of orderItems) {
      // Find matching recipe: first try variant-specific recipe, fallback to item-wide recipe
      let recipe = null;
      if (orderItem.variantId) {
        recipe = await prisma.recipe.findFirst({
          where: {
            restaurantId,
            menuItemId: orderItem.menuItemId,
            variantId: orderItem.variantId,
          },
          include: {
            items: {
              include: { ingredient: true },
            },
          },
        });
      }

      if (!recipe) {
        recipe = await prisma.recipe.findFirst({
          where: {
            restaurantId,
            menuItemId: orderItem.menuItemId,
            variantId: null,
          },
          include: {
            items: {
              include: { ingredient: true },
            },
          },
        });
      }

      if (!recipe || !recipe.items || recipe.items.length === 0) {
        continue;
      }

      const yieldDivisor = recipe.yieldQuantity > 0 ? recipe.yieldQuantity : 1;

      for (const recipeItem of recipe.items) {
        const ingredient = recipeItem.ingredient;
        const portionQty = (recipeItem.quantity / yieldDivisor) * orderItem.quantity;
        const wasteFactor = 1 + (recipeItem.wastePercentage || 0) / 100;
        const rawPortion = portionQty * wasteFactor;

        // Convert to inventory unit
        const inInventoryUnit = UnitConverter.convert(
          rawPortion,
          recipeItem.unit,
          ingredient.unit
        );

        const existing = consumptionMap.get(ingredient.id);
        if (existing) {
          existing.quantityToDeduct += inInventoryUnit;
          existing.totalCost += inInventoryUnit * ingredient.costPerUnit;
        } else {
          consumptionMap.set(ingredient.id, {
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            recipeUnit: recipeItem.unit,
            rawRecipeQuantity: rawPortion,
            inventoryUnit: ingredient.unit,
            quantityToDeduct: inInventoryUnit,
            costPerUnit: ingredient.costPerUnit,
            totalCost: inInventoryUnit * ingredient.costPerUnit,
          });
        }
      }
    }

    return Array.from(consumptionMap.values()).map((item) => ({
      ...item,
      quantityToDeduct: Math.round(item.quantityToDeduct * 10000) / 10000,
      totalCost: Math.round(item.totalCost * 100) / 100,
    }));
  }
}
