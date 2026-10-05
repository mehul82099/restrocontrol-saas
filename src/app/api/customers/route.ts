import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const url = new URL(req.url);
  const search = url.searchParams.get('q');

  const customers = await prisma.customer.findMany({
    where: {
      restaurantId: auth.restaurantId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { orders: true } },
    },
    orderBy: { totalSpend: 'desc' },
  });

  return NextResponse.json({ success: true, customers });
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const data = await req.json();
  const customer = await prisma.customer.upsert({
    where: {
      restaurantId_phone: {
        restaurantId: auth.restaurantId,
        phone: data.phone,
      },
    },
    create: {
      restaurantId: auth.restaurantId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
    },
    update: {
      name: data.name,
      email: data.email,
      address: data.address,
    },
  });

  return NextResponse.json({ success: true, customer });
}
