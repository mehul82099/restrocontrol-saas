import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/audit.service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const url = new URL(req.url);
  const categoryId = url.searchParams.get('categoryId');

  const items = await prisma.menuItem.findMany({
    where: {
      restaurantId: auth.restaurantId,
      ...(categoryId ? { categoryId } : {}),
    },
    include: {
      category: true,
      variants: true,
      addons: true,
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

  return NextResponse.json({ success: true, items });
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:menu');
  if (errorResponse || !auth) return errorResponse;

  const data = await req.json();

  const menuItem = await prisma.menuItem.create({
    data: {
      restaurantId: auth.restaurantId,
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      shortCode: data.shortCode,
      basePrice: parseFloat(data.basePrice),
      isVeg: data.isVeg !== undefined ? data.isVeg : true,
      taxRate: data.taxRate !== undefined ? parseFloat(data.taxRate) : 5.0,
      variants: data.variants
        ? {
            create: data.variants.map((v: any) => ({
              name: v.name,
              price: parseFloat(v.price),
              sku: v.sku,
            })),
          }
        : undefined,
      addons: data.addons
        ? {
            create: data.addons.map((a: any) => ({
              name: a.name,
              price: parseFloat(a.price),
            })),
          }
        : undefined,
    },
    include: {
      variants: true,
      addons: true,
    },
  });

  await AuditService.log({
    restaurantId: auth.restaurantId,
    userId: auth.user.userId,
    action: 'MENU_ITEM_CREATE',
    entity: 'MenuItem',
    entityId: menuItem.id,
    after: menuItem,
  });

  return NextResponse.json({ success: true, menuItem });
}
