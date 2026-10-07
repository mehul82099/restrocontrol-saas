import { protectRead } from '@/server/services/api-validation';
import { protectMutation } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import bcrypt from 'bcryptjs';
import { SubscriptionService } from '@/server/services/subscription.service';
import { AuditService } from '@/server/services/audit.service';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:users');
  if (errorResponse || !auth) return errorResponse;

  const users = await prisma.user.findMany({
    where: { restaurantId: auth.restaurantId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, users });
}

async function handlePOST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:users');
  if (errorResponse || !auth) return errorResponse;

  const check = await SubscriptionService.canPerformAction(auth.restaurantId, 'ADD_USER');
  if (!check.allowed) {
    return NextResponse.json({ success: false, error: check.reason }, { status: 403 });
  }

  const data = await req.json();
  if (typeof data.password !== 'string' || data.password.length < 12 || data.password.length > 72) return NextResponse.json({success: false, error: 'Use a password of 12 to 72 characters.'}, {status: 400});
  if (!['OWNER','MANAGER','CASHIER','KITCHEN_STAFF','INVENTORY_MANAGER'].includes(data.role) || (auth.user.role !== 'OWNER' && !['CASHIER','KITCHEN_STAFF','INVENTORY_MANAGER'].includes(data.role))) return NextResponse.json({success: false, error: 'Role assignment denied.'}, {status: 403});
  if (typeof data.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return NextResponse.json({success: false, error: 'Invalid email.'}, {status: 400});
  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      restaurantId: auth.restaurantId,
      email: data.email.toLowerCase().trim(),
      name: data.name,
      role: data.role,
      phone: data.phone,
      passwordHash,
    },
  });

  // Assign to default outlet
  const defaultOutlet = await prisma.outlet.findFirst({
    where: { restaurantId: auth.restaurantId, isDefault: true },
  });
  if (defaultOutlet) {
    await prisma.userOutlet.create({
      data: {
        userId: user.id,
        outletId: defaultOutlet.id,
      },
    });
  }

  await AuditService.log({
    restaurantId: auth.restaurantId,
    userId: auth.user.userId,
    action: 'USER_CREATE',
    entity: 'User',
    entityId: user.id,
    after: { email: user.email, name: user.name, role: user.role },
  });

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
    },
  });
}

export const POST = protectMutation(handlePOST);

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
