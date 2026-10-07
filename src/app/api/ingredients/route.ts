import { protectRead } from '@/server/services/api-validation';
import { protectMutation } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/audit.service';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'view:inventory');
  if (errorResponse || !auth) return errorResponse;

  const ingredients = await prisma.ingredient.findMany({
    where: { restaurantId: auth.restaurantId },
    include: {
      category: true,
      preferredSupplier: true,
      outletInventories: {
        where: { outletId: auth.outletId },
      },
    },
    orderBy: { name: 'asc' },
  });

  const formatted = ingredients.map((ing) => {
    const outletStock = ing.outletInventories[0]?.currentStock ?? 0;
    return {
      id: ing.id,
      name: ing.name,
      sku: ing.sku,
      unit: ing.unit,
      costPerUnit: ing.costPerUnit,
      minimumStock: ing.minimumStock,
      reorderLevel: ing.reorderLevel,
      currentStock: outletStock,
      category: ing.category?.name || 'Uncategorized',
      categoryId: ing.categoryId,
      preferredSupplier: ing.preferredSupplier?.name || 'None',
      preferredSupplierId: ing.preferredSupplierId,
    };
  });

  return NextResponse.json({ success: true, ingredients: formatted });
}

async function handlePOST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:ingredients');
  if (errorResponse || !auth) return errorResponse;

  const data = await req.json();

  const ingredient = await prisma.ingredient.create({
    data: {
      restaurantId: auth.restaurantId,
      categoryId: data.categoryId || null,
      name: data.name,
      sku: data.sku,
      unit: data.unit ? data.unit.toUpperCase().trim() : 'KG',
      costPerUnit: parseFloat(data.costPerUnit || 0),
      minimumStock: parseFloat(data.minimumStock || 5),
      reorderLevel: parseFloat(data.reorderLevel || 10),
      preferredSupplierId: data.preferredSupplierId || null,
    },
  });

  // Create initial outlet inventory entries for all outlets of this restaurant
  const outlets = await prisma.outlet.findMany({
    where: { restaurantId: auth.restaurantId },
  });

  for (const outlet of outlets) {
    await prisma.outletInventory.create({
      data: {
        restaurantId: auth.restaurantId,
        outletId: outlet.id,
        ingredientId: ingredient.id,
        currentStock: 0,
        minimumStock: ingredient.minimumStock,
        reorderLevel: ingredient.reorderLevel,
      },
    });
  }

  await AuditService.log({
    restaurantId: auth.restaurantId,
    userId: auth.user.userId,
    action: 'INGREDIENT_CREATE',
    entity: 'Ingredient',
    entityId: ingredient.id,
    after: ingredient,
  });

  return NextResponse.json({ success: true, ingredient });
}

export const POST = protectMutation(handlePOST);

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
