import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { OrderService } from '@/server/services/order.service';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { auth, errorResponse } = await authenticateRequest(req, 'refund:order');
  if (errorResponse || !auth) return errorResponse;

  try {
    const data = await req.json();
    const refundAmount = parseFloat(data.amount);

    const updated = await OrderService.refundOrder(
      auth.restaurantId,
      params.id,
      refundAmount,
      auth.user.userId,
      data.reason
    );

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to refund order.' },
      { status: 400 }
    );
  }
}
