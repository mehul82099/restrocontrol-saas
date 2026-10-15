import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { protectRead, protectMutation } from '@/server/services/api-validation';
import { OrderService } from '@/server/services/order.service';
import { SubscriptionService } from '@/server/services/subscription.service';
export const dynamic = 'force-dynamic';
export const GET = protectRead(async (req: NextRequest) => {
  const {auth, errorResponse} = await authenticateRequest(req, 'access:waiter');
  if (!auth || errorResponse) return errorResponse;
  const tickets = await prisma.kitchenOrder.findMany({where: {restaurantId: auth.restaurantId, outletId: auth.outletId, status: 'READY', order: {status: {notIn: ['CANCELLED', 'REFUNDED']}}}, select: {id: true, kotNumber: true, updatedAt: true, order: {select: {orderNumber: true, orderType: true, table: {select: {tableNumber: true}}}}, items: {select: {quantity: true, orderItem: {select: {name: true, notes: true}}}}}, orderBy: {updatedAt: 'asc'}});
  return NextResponse.json({success: true, tickets});
});
export const POST = protectMutation(async (req: NextRequest) => {
  const {auth, errorResponse} = await authenticateRequest(req, 'access:waiter');
  if (!auth || errorResponse) return errorResponse;
  const check = await SubscriptionService.canPerformAction(auth.restaurantId, 'CREATE_ORDER');
  if (!check.allowed) return NextResponse.json({success: false}, {status: 403});
  const data = await req.json();
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 100 || !['DINE_IN', 'TAKEAWAY'].includes(data.orderType) || typeof data.idempotencyKey !== 'string' || !data.idempotencyKey.startsWith(`WAITER-${auth.user.userId}-`) || data.idempotencyKey.length > 200) throw new Error('Invalid order');
  if (data.orderType === 'DINE_IN' && !data.tableId) throw new Error('Select a table');
  // Do not accept payment/refund/discount capabilities through this limited order-entry endpoint.
  if (data.payments?.length || data.customerId || data.discountAmount || data.deliveryFee || data.tipAmount) throw new Error('Unsupported waiter action');
  let subtotal = 0, rawTax = 0;
  const items = [];
  const ids = new Set<string>();
  for (const input of data.items) {
    if (ids.has(input.menuItemId) || !Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100 || input.variantId || input.addons?.length) throw new Error('Invalid item');
    ids.add(input.menuItemId);
    const menu = await prisma.menuItem.findFirst({where: {id: input.menuItemId, restaurantId: auth.restaurantId, isAvailable: true}});
    if (!menu) throw new Error('Item unavailable');
    const unitPrice = Math.round(menu.basePrice * 100) / 100;
    const totalPrice = Math.round(unitPrice * input.quantity * 100) / 100;
    subtotal += totalPrice; rawTax += totalPrice * menu.taxRate / 100;
    items.push({menuItemId: menu.id, name: menu.name, quantity: input.quantity, unitPrice, totalPrice, notes: typeof input.notes === 'string' ? input.notes.slice(0,500) : undefined});
  }
  subtotal = Math.round(subtotal * 100) / 100;
  const tax = Math.round(rawTax * 100) / 100;
  const result = await OrderService.createOrder({restaurantId: auth.restaurantId, outletId: auth.outletId, cashierId: auth.user.userId, idempotencyKey: data.idempotencyKey, orderType: data.orderType, tableId: data.orderType === 'DINE_IN' ? data.tableId : null, items, subtotal, taxAmount: tax, totalAmount: Math.round((subtotal + tax) * 100) / 100, payments: []});
  return NextResponse.json({success: true, orderNumber: result.order.orderNumber, isDuplicate: result.isDuplicate});
});
