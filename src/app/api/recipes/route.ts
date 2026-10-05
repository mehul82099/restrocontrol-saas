import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { RecipeEngineService } from '@/server/services/recipe-engine.service';
import { AuditService } from '@/server/services/audit.service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const url = new URL(req.url);
  const menuItemId = url.searchParams.get('menuItemId');

  const recipes = await prisma.recipe.findMany({
    where: {
      restaurantId: auth.restaurantId,
      ...(menuItemId ? { menuItemId } : {}),
    },
    include: {
      menuItem: { include: { category: true } },
      variant: true,
      items: {
        include: { ingredient: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate live recipe costs for each recipe
  const enriched = await Promise.all(
    recipes.map(async (recipe) => {
      const costing = await RecipeEngineService.calculateRecipeCost(
        auth.restaurantId,
        recipe.menuItemId,
        recipe.variantId
      );
      const sellingPrice = recipe.variant ? recipe.variant.price : recipe.menuItem.basePrice;
      const foodCostPercentage = sellingPrice > 0 ? Math.round((costing.totalCost / sellingPrice) * 1000) / 10 : 0;
      const grossContribution = Math.round((sellingPrice - costing.totalCost) * 100) / 100;

      return {
        ...recipe,
        calculatedCost: costing.totalCost,
        sellingPrice,
        foodCostPercentage,
        grossContribution,
      };
    })
  );

  return NextResponse.json({ success: true, recipes: enriched });
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:recipes');
  if (errorResponse || !auth) return errorResponse;

  const data = await req.json();

  const recipe = await prisma.recipe.create({
    data: {
      restaurantId: auth.restaurantId,
      menuItemId: data.menuItemId,
      variantId: data.variantId || null,
      name: data.name,
      yieldQuantity: parseFloat(data.yieldQuantity || 1),
      yieldUnit: data.yieldUnit || 'PORTION',
      prepTimeMinutes: parseInt(data.prepTimeMinutes || 15),
      preparationNotes: data.preparationNotes,
      items: {
        create: data.items.map((item: any) => ({
          ingredientId: item.ingredientId,
          quantity: parseFloat(item.quantity),
          unit: item.unit ? item.unit.toUpperCase().trim() : 'G',
          wastePercentage: parseFloat(item.wastePercentage || 0),
          notes: item.notes,
        })),
      },
    },
    include: {
      items: { include: { ingredient: true } },
    },
  });

  await AuditService.log({
    restaurantId: auth.restaurantId,
    userId: auth.user.userId,
    action: 'RECIPE_CREATE',
    entity: 'Recipe',
    entityId: recipe.id,
    after: { name: recipe.name, menuItemId: recipe.menuItemId, itemsCount: recipe.items.length },
  });

  return NextResponse.json({ success: true, recipe });
}
