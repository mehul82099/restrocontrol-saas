import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { OrderService, CreateOrderInput } from '@/server/services/order.service';
import { SubscriptionService } from '@/server/services/subscription.service';

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'access:pos');
  if (errorResponse || !auth) return errorResponse;

  const check = await SubscriptionService.canPerformAction(auth.restaurantId, 'CREATE_ORDER');
  if (!check.allowed) {
    return NextResponse.json({ success: false, error: check.reason }, { status: 403 });
  }

  try {
    const data: Partial<CreateOrderInput> = await req.json();

    const orderResult = await OrderService.createOrder({
      ...data,
      restaurantId: auth.restaurantId,
      outletId: auth.outletId,
      cashierId: auth.user.userId,
    } as CreateOrderInput);

    return NextResponse.json({
      success: true,
      ...orderResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Checkout failed.' },
      { status: 400 }
    );
  }
}
