import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { clearResponseCache } from "../lib/db-helpers.js";
import { prisma } from "../lib/prisma.js";

export class AdminError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AdminError";
  }
}

export interface AdminTokenPayload {
  adminId: string;
  username: string;
}

export async function loginAdmin(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  const admin = await prisma.admin.findUnique({
    where: { username: username.trim() },
  });

  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    throw new AdminError("Invalid username or password", 401);
  }

  const token = jwt.sign(
    { adminId: admin.id, username: admin.username } satisfies AdminTokenPayload,
    env.jwtSecret,
    { expiresIn: "8h" }
  );

  return { token, username: admin.username };
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  try {
    return jwt.verify(token, env.jwtSecret) as AdminTokenPayload;
  } catch {
    throw new AdminError("Invalid or expired token", 401);
  }
}

export async function getSystemConfigAdmin() {
  const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
  if (!config) {
    throw new AdminError("System config not found", 500);
  }
  return config;
}

export async function updateSystemPrompt(systemPrompt: string) {
  const trimmed = systemPrompt.trim();
  if (!trimmed || trimmed.length > 20000) {
    throw new AdminError("System prompt must be between 1 and 20000 characters", 400);
  }

  const config = await prisma.systemConfig.update({
    where: { id: 1 },
    data: {
      systemPrompt: trimmed,
      promptVersion: { increment: 1 },
    },
  });

  await clearResponseCache();
  return config;
}

export async function listEscalationRules() {
  return prisma.escalationRule.findMany({
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });
}

export async function updateEscalationRule(
  id: string,
  data: { enabled?: boolean; priority?: number }
) {
  const rule = await prisma.escalationRule.findUnique({ where: { id } });
  if (!rule) {
    throw new AdminError("Escalation rule not found", 404);
  }

  return prisma.escalationRule.update({
    where: { id },
    data: {
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
    },
  });
}

export async function listRecentEscalations(limit = 20) {
  return prisma.escalation.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      sessionId: true,
      customerEmail: true,
      message: true,
      createdAt: true,
    },
  });
}
