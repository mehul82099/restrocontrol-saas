import { protectRead } from '@/server/services/api-validation';
import { protectMutation } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { NotificationService } from '@/server/services/notification.service';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const notifications = await NotificationService.getNotifications(auth.restaurantId, auth.outletId);
  return NextResponse.json({ success: true, notifications });
}

async function handlePOST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const data = await req.json();
  if (data.action === 'mark_all_read') {
    await NotificationService.markAllAsRead(auth.restaurantId, auth.outletId);
  } else if (data.id) {
    await NotificationService.markAsRead(auth.restaurantId, data.id, auth.outletId);
  }

  return NextResponse.json({ success: true, message: 'Notification marked as read.' });
}

export const POST = protectMutation(handlePOST);

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
