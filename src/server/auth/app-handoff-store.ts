// Postgres-backed handoff store. consume() is ONE atomic UPDATE keyed on
// codeHash + verifierChallenge + unused + unexpired, so exactly one concurrent
// exchange can win and a failed verifier consumes nothing.
import { prisma } from '@/server/db/prisma';
import type { HandoffStore, HandoffRecord } from '@/server/auth/app-handoff';

export const prismaHandoffStore: HandoffStore = {
  async insert(rec: HandoffRecord) {
    await prisma.$executeRaw`
      INSERT INTO "AuthHandoffCode" ("codeHash", "verifierChallenge", "userId", "createdAt", "expiresAt")
      VALUES (${rec.codeHash}, ${rec.verifierChallenge}, ${rec.userId}, ${rec.createdAt}, ${rec.expiresAt})`;
  },
  async consume(codeHash, verifierChallenge, now) {
    const rows = await prisma.$queryRaw<HandoffRecord[]>`
      UPDATE "AuthHandoffCode"
      SET "usedAt" = ${now}
      WHERE "codeHash" = ${codeHash}
        AND "verifierChallenge" = ${verifierChallenge}
        AND "usedAt" IS NULL
        AND "expiresAt" > ${now}
      RETURNING "codeHash", "verifierChallenge", "userId", "createdAt", "expiresAt", "usedAt"`;
    return rows.length === 1 ? rows[0] : null;
  },
  async deleteExpired(now) {
    return prisma.$executeRaw`DELETE FROM "AuthHandoffCode" WHERE "expiresAt" < ${now}`;
  },
};
