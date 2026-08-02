import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma.js";
import { sessionExpiresAt, cleanupExpiredSessions } from "../lib/db-helpers.js";

export async function createSession(input?: {
  id?: string;
  categoryId?: string;
}) {
  await cleanupExpiredSessions();

  const sessionId = input?.id?.trim() || uuidv4();

  if (input?.categoryId) {
    const category = await prisma.chatCategory.findFirst({
      where: { id: input.categoryId, enabled: true },
    });
    if (!category) {
      throw new SessionError("Invalid category", 400);
    }
  }

  const existing = await prisma.session.findUnique({ where: { id: sessionId } });
  if (existing && existing.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: sessionId } });
  }

  const session = await prisma.session.upsert({
    where: { id: sessionId },
    update: {
      ...(input?.categoryId ? { categoryId: input.categoryId } : {}),
      expiresAt: sessionExpiresAt(),
    },
    create: {
      id: sessionId,
      categoryId: input?.categoryId ?? null,
      expiresAt: sessionExpiresAt(),
    },
    include: {
      category: { select: { id: true, slug: true, label: true } },
    },
  });

  if (session.expiresAt <= new Date()) {
    throw new SessionError("Session expired", 410);
  }

  return session;
}

export async function getSession(sessionId: string) {
  await cleanupExpiredSessions();

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      category: { select: { id: true, slug: true, label: true } },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: sessionId } });
    return null;
  }

  return session;
}

export async function setSessionCategory(sessionId: string, categoryId: string) {
  const session = await getSession(sessionId);
  if (!session) {
    throw new SessionError("Session not found or expired", 404);
  }

  if (session.escalated) {
    throw new SessionError("Session has been escalated", 409);
  }

  const category = await prisma.chatCategory.findFirst({
    where: { id: categoryId, enabled: true },
  });
  if (!category) {
    throw new SessionError("Invalid category", 400);
  }

  return prisma.session.update({
    where: { id: sessionId },
    data: { categoryId },
    include: {
      category: { select: { id: true, slug: true, label: true } },
    },
  });
}

export class SessionError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "SessionError";
  }
}
