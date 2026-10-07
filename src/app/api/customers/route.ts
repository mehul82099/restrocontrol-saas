import { protectRead } from '@/server/services/api-validation';
import { protectMutation } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'access:pos');
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

async function handlePOST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'access:pos');
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

export const POST = protectMutation(handlePOST);

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
