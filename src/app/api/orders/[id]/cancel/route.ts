import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { OrderService } from '@/server/services/order.service';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { auth, errorResponse } = await authenticateRequest(req, 'cancel:order');
  if (errorResponse || !auth) return errorResponse;

  try {
    const data = await req.json().catch(() => ({}));
    const updated = await OrderService.cancelOrder(
      auth.restaurantId,
      params.id,
      auth.user.userId,
      data.reason,
      data.reverseStock !== undefined ? !!data.reverseStock : true
    );

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cancel order.' },
      { status: 400 }
    );
  }
}
