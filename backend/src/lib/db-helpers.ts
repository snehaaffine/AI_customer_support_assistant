import { prisma } from "./prisma.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function sessionExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + SESSION_TTL_MS);
}

/** Delete sessions (and cascaded messages/escalations) past their 24-hour TTL. */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

/** Clear all cached responses — called when admin updates the system prompt. */
export async function clearResponseCache(): Promise<number> {
  const result = await prisma.responseCache.deleteMany();
  return result.count;
}

export async function getSystemConfig() {
  const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
  if (!config) {
    throw new Error("System config not seeded — run npm run db:seed");
  }
  return config;
}

export async function getEnabledCategories() {
  return prisma.chatCategory.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getEnabledEscalationRules() {
  return prisma.escalationRule.findMany({
    where: { enabled: true },
    orderBy: { priority: "desc" },
  });
}
