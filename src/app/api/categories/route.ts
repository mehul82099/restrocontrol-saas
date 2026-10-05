import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const categories = await prisma.category.findMany({
    where: { restaurantId: auth.restaurantId },
    include: {
      _count: { select: { menuItems: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json({ success: true, categories });
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:menu');
  if (errorResponse || !auth) return errorResponse;

  const data = await req.json();
  const category = await prisma.category.create({
    data: {
      restaurantId: auth.restaurantId,
      name: data.name,
      sortOrder: data.sortOrder || 0,
      color: data.color || '#10b981',
    },
  });

  return NextResponse.json({ success: true, category });
}
