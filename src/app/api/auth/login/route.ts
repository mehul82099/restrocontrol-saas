import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/server/auth/jwt';
import { AuditService } from '@/server/services/audit.service';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() },
      include: {
        restaurant: true,
        userOutlets: {
          include: { outlet: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const defaultOutlet =
      user.userOutlets.find((uo) => uo.outlet.isDefault)?.outlet ||
      user.userOutlets[0]?.outlet ||
      (await prisma.outlet.findFirst({
        where: { restaurantId: user.restaurantId, isDefault: true },
      }));

    const token = signToken({
      userId: user.id,
      restaurantId: user.restaurantId,
      role: user.role,
      email: user.email,
      name: user.name,
      outletId: defaultOutlet?.id,
    });

    await AuditService.log({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent'),
    });

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        restaurantId: user.restaurantId,
        restaurantName: user.restaurant.name,
        currency: user.restaurant.currency,
        currencySymbol: user.restaurant.currencySymbol,
        outletId: defaultOutlet?.id,
        outletName: defaultOutlet?.name,
      },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Login failed.' },
      { status: 500 }
    );
  }
}
