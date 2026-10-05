import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { NotificationService } from '@/server/services/notification.service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const notifications = await NotificationService.getNotifications(auth.restaurantId);
  return NextResponse.json({ success: true, notifications });
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const data = await req.json();
  if (data.action === 'mark_all_read') {
    await NotificationService.markAllAsRead(auth.restaurantId);
  } else if (data.id) {
    await NotificationService.markAsRead(auth.restaurantId, data.id);
  }

  return NextResponse.json({ success: true, message: 'Notification marked as read.' });
}
