import { protectRead } from '@/server/services/api-validation';
import { protectMutation } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:suppliers');
  if (errorResponse || !auth) return errorResponse;

  const suppliers = await prisma.supplier.findMany({
    where: { restaurantId: auth.restaurantId },
    include: {
      _count: { select: { purchaseOrders: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ success: true, suppliers });
}

async function handlePOST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:suppliers');
  if (errorResponse || !auth) return errorResponse;

  const data = await req.json();
  const supplier = await prisma.supplier.create({
    data: {
      restaurantId: auth.restaurantId,
      name: data.name,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      address: data.address,
      taxId: data.taxId,
      paymentTerms: data.paymentTerms || 'Net 30',
      notes: data.notes,
    },
  });

  return NextResponse.json({ success: true, supplier });
}

export const POST = protectMutation(handlePOST);

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
