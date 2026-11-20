import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Cache on globalThis in every environment so a warm serverless instance (and dev hot reload)
// reuses one client and its connection pool instead of opening new connections.
globalForPrisma.prisma = prisma;
