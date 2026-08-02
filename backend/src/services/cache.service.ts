import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { createEmbedding, toVectorLiteral } from "./embedding.service.js";

const ORDER_PATTERN =
  /\b(ord[-\s]?#?\d+|order\s*(#|number|no\.?)?\s*[:#]?\s*\w+|\b1z[a-z0-9]{16}\b)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const INVENTORY_PATTERN =
  /\b(in\s*stock|out\s*of\s*stock|available|availability|how\s+many\s+left|stock\s+level|sizes?\s+(left|available))\b/i;
const ORDER_STATUS_PATTERN =
  /\b(where('s| is) my order|track(ing)?\s+(my\s+)?order|order\s+status|shipment\s+status|delivery\s+status)\b/i;

export function shouldBypassCache(message: string): boolean {
  return (
    ORDER_PATTERN.test(message) ||
    EMAIL_PATTERN.test(message) ||
    INVENTORY_PATTERN.test(message) ||
    ORDER_STATUS_PATTERN.test(message)
  );
}

export function isCacheableAnswer(answer: string): boolean {
  return !(
    ORDER_PATTERN.test(answer) ||
    EMAIL_PATTERN.test(answer) ||
    /\b(order\s+#?\w{3,}|tracking\s+(number|#)|shipped\s+on|delivered\s+on)\b/i.test(
      answer
    )
  );
}

export async function findCachedAnswer(
  question: string,
  promptVersion: number
): Promise<string | null> {
  const embedding = await createEmbedding(question);
  const vector = toVectorLiteral(embedding);

  const rows = await prisma.$queryRawUnsafe<
    { answerText: string; similarity: number }[]
  >(
    `SELECT "answerText", 1 - ("questionEmbedding" <=> $1::vector) AS similarity
     FROM "ResponseCache"
     WHERE "promptVersion" = $2
       AND 1 - ("questionEmbedding" <=> $1::vector) >= $3
     ORDER BY "questionEmbedding" <=> $1::vector
     LIMIT 1`,
    vector,
    promptVersion,
    env.cacheSimilarityThreshold
  );

  return rows[0]?.answerText ?? null;
}

export async function storeCachedAnswer(
  question: string,
  answer: string,
  promptVersion: number
): Promise<void> {
  const embedding = await createEmbedding(question);
  const vector = toVectorLiteral(embedding);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "ResponseCache" (id, "questionText", "questionEmbedding", "answerText", "promptVersion")
     VALUES (gen_random_uuid(), $1, $2::vector, $3, $4)`,
    question,
    vector,
    answer,
    promptVersion
  );
}
