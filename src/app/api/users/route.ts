import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import bcrypt from 'bcryptjs';
import { SubscriptionService } from '@/server/services/subscription.service';
import { AuditService } from '@/server/services/audit.service';

export async function GET(req: NextRequest) {
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

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:users');
  if (errorResponse || !auth) return errorResponse;

  const check = await SubscriptionService.canPerformAction(auth.restaurantId, 'ADD_USER');
  if (!check.allowed) {
    return NextResponse.json({ success: false, error: check.reason }, { status: 403 });
  }

  const data = await req.json();
  const passwordHash = await bcrypt.hash(data.password || 'Welcome123!', 10);

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
