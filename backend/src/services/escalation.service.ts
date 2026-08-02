import type { ChatCategory, EscalationRule } from "@prisma/client";
import { getEnabledEscalationRules } from "../lib/db-helpers.js";

interface EscalationContext {
  message: string;
  category?: Pick<ChatCategory, "slug"> | null;
  failedAttempts?: number;
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
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
    case "EXPLICIT_REQUEST":
      return matchesKeywords(
        ctx.message,
        (config.phrases as string[] | undefined) ?? []
      );
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
