import dotenv from "dotenv";

dotenv.config();

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  port: parseInt(optionalEnv("PORT", "3001"), 10),
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  databaseUrl: optionalEnv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/customer_support?schema=public"
  ),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  supportInboxEmail: optionalEnv("SUPPORT_INBOX_EMAIL", "support@yourstore.com"),
  fromEmail: optionalEnv("FROM_EMAIL", "noreply@yourstore.com"),
  adminUsername: optionalEnv("ADMIN_USERNAME", "admin"),
  adminPassword: optionalEnv("ADMIN_PASSWORD", "changeme"),
  jwtSecret: optionalEnv("JWT_SECRET", "dev-secret-change-in-production"),
  cacheSimilarityThreshold: parseFloat(
    optionalEnv("CACHE_SIMILARITY_THRESHOLD", "0.85")
  ),
  orderLockoutAttempts: parseInt(optionalEnv("ORDER_LOCKOUT_ATTEMPTS", "5"), 10),
  orderLockoutMinutes: parseInt(optionalEnv("ORDER_LOCKOUT_MINUTES", "15"), 10),
  sessionOrderFailureLimit: parseInt(
    optionalEnv("SESSION_ORDER_FAILURE_LIMIT", "5"),
    10
  ),
  isDev: optionalEnv("NODE_ENV", "development") === "development",
};

export function assertAnthropicKey(): void {
  if (!env.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set in .env");
  }
}

export function assertResendKey(): void {
  if (!env.resendApiKey) {
    throw new Error("RESEND_API_KEY is not set in .env");
  }
}
