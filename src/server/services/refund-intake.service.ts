export class RefundInputError extends Error {}
import { prisma } from '../db/prisma';

export function isRefundAdmin(userId: string) {
  return (process.env.REFUND_ADMIN_USER_IDS || '').split(',').map(x => x.trim()).filter(Boolean).includes(userId);
}
export function parseRefundInput(body: unknown) {
  if (!body || typeof body !== 'object') throw new RefundInputError('Invalid form.');
  const source = body as Record<string, unknown>;
  const data: Record<string, string> = {};
  for (const [key, min, max] of [['restaurant', 1, 160], ['email', 3, 254], ['paymentReference', 1, 160], ['refundReason', 10, 2000], ['serviceFeedback', 10, 2000]] as const) {
    const value = typeof source[key] === 'string' ? source[key].trim() : '';
    if (value.length < min || value.length > max) throw new RefundInputError('Complete every field within the stated limits.');
    data[key] = value;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new RefundInputError('Enter a valid registered email.');
  return data;
}
export async function saveRefundRequest(restaurantId: string, userId: string, email: string, body: unknown) {
  const data = parseRefundInput(body);
  if (data.email.toLowerCase() !== email.toLowerCase()) throw new RefundInputError('Use your signed-in registered email.');
  const existing = await prisma.refundRequest.findUnique({where:{restaurantId_paymentReference:{restaurantId,paymentReference:data.paymentReference}}});
  if (existing) return existing;
  if (await prisma.refundRequest.count({where:{restaurantId,submittedAt:{gte:new Date(Date.now()-86400000)}}}) >= 5) throw new RefundInputError('Daily request limit reached. Contact support.');
  const submittedAt = new Date();
  // Unique constraint makes retry safe. Never change the original submittedAt/dueAt.
  return prisma.refundRequest.upsert({where:{restaurantId_paymentReference:{restaurantId,paymentReference:data.paymentReference}},update:{},create:{restaurantId,submittedById:userId,restaurantName:data.restaurant,email:data.email,paymentReference:data.paymentReference,refundReason:data.refundReason,serviceFeedback:data.serviceFeedback,submittedAt,refundDueAt:new Date(submittedAt.getTime()+86400000)}});
}
