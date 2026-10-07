import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';
export function finiteNumber(value: unknown, name: string, min = 0, max = 1e9): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
}
export async function assertTenantReference(model: string, id: unknown, restaurantId: string, db: any = prisma, outletId?: string) {
  if (typeof id !== 'string' || !id || id.length > 128) throw new Error(`Invalid ${model} reference`);
  const row = await db[model].findFirst({where: {id, restaurantId, ...(outletId ? {outletId} : {})}});
  if (!row) throw new Error(`Invalid ${model} reference`);
  return row;
}
export const serializable = {isolationLevel: Prisma.TransactionIsolationLevel.Serializable};
