import type { ChatCategory, EscalationRule } from "@prisma/client";
import { getEnabledEscalationRules } from "../lib/db-helpers.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeMessage } from "../lib/sanitize.js";
import { sendEscalationEmails } from "./email.service.js";
import { getSession } from "./session.service.js";

interface EscalationContext {
  message: string;
  category?: Pick<ChatCategory, "slug"> | null;
  failedAttempts?: number;
}

export class EscalationError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "EscalationError";
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitEscalation(params: {
  sessionId: string;
  customerEmail: string;
  message: string;
  imageFilenames: string[];
}) {
  const session = await getSession(params.sessionId);
  if (!session) {
    throw new EscalationError("Session not found or expired", 404);
  }
  if (session.escalated) {
    throw new EscalationError("Session already escalated", 409);
  }

  const customerEmail = params.customerEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(customerEmail)) {
    throw new EscalationError("Invalid email address", 400);
  }

  const message = sanitizeMessage(params.message);
  if (!message || message.length > 2000) {
    throw new EscalationError(
      "Message must be between 1 and 2000 characters",
      400
    );
  }

  const imageUrls = params.imageFilenames.map(
    (filename) => `/uploads/${filename}`
  );

  const transcript = await prisma.message.findMany({
    where: { sessionId: params.sessionId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { role: true, content: true, createdAt: true },
  });

  const escalation = await prisma.$transaction(async (tx) => {
    const created = await tx.escalation.create({
      data: {
        sessionId: params.sessionId,
        customerEmail,
        message,
        imageUrls,
      },
    });

    await tx.session.update({
      where: { id: params.sessionId },
      data: { escalated: true },
    });

    return created;
  });

  await sendEscalationEmails({
    sessionId: params.sessionId,
    customerEmail,
    customerMessage: message,
    imageFilenames: params.imageFilenames,
    transcript,
    categoryLabel: session.category?.label,
  }).catch((err) => {
    throw new EscalationError(
      err instanceof Error ? err.message : "Failed to send escalation email",
      502
    );
  });

  return escalation;
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

const HUMAN_REQUEST_PATTERNS = [
  /\b(speak|talk)\s+to\s+(a\s+)?(human|person|agent|representative|rep|someone)\b/i,
  /\b(speak|talk)\s+with\s+(a\s+)?(human|person|agent|representative|rep|someone)\b/i,
  /\b(real|live)\s+(human|person|agent)\b/i,
  /\bhuman\s+agent\b/i,
  /\bcustomer\s+service\s+(rep|representative)\b/i,
  /\bconnect\s+me\s+(to|with)\s+(a\s+)?(human|agent|representative|someone)\b/i,
  /\bget\s+me\s+(a\s+)?(human|agent|representative|someone)\b/i,
  /\b(need|want)\s+(a\s+)?(human|real\s+person|live\s+agent)\b/i,
];

function matchesExplicitHumanRequest(text: string): boolean {
  return HUMAN_REQUEST_PATTERNS.some((pattern) => pattern.test(text));
}

function checkRule(rule: EscalationRule, ctx: EscalationContext): boolean {
  const config = rule.config as Record<string, unknown>;

  switch (rule.type) {
    case "KEYWORD":
      return matchesKeywords(
        ctx.message,
        (config.keywords as string[] | undefined) ?? []
      );
    case "SENTIMENT":
      return matchesKeywords(
        ctx.message,
        (config.keywords as string[] | undefined) ?? []
      );
    case "EXPLICIT_REQUEST": {
      const phrases = (config.phrases as string[] | undefined) ?? [];
      return (
        matchesKeywords(ctx.message, phrases) ||
        matchesExplicitHumanRequest(ctx.message)
      );
    }
    case "CATEGORY":
      return ctx.category?.slug === (config.categorySlug as string | undefined);
    case "FAILED_ATTEMPTS":
      return (
        (ctx.failedAttempts ?? 0) >=
        ((config.maxAttempts as number | undefined) ?? 3)
      );
    default:
      return false;
  }
}

export async function shouldEscalate(ctx: EscalationContext): Promise<boolean> {
  const rules = await getEnabledEscalationRules();
  return rules.some((rule) => checkRule(rule, ctx));
}
