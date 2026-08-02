import { MessageRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { sanitizeMessage } from "../lib/sanitize.js";
import { getSession, SessionError } from "./session.service.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export interface PaginatedMessages {
  messages: {
    id: string;
    role: MessageRole;
    content: string;
    createdAt: Date;
  }[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function getMessages(
  sessionId: string,
  options?: { cursor?: string; limit?: number }
): Promise<PaginatedMessages> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new SessionError("Session not found or expired", 404);
  }

  const limit = Math.min(
    Math.max(options?.limit ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );

  const cursorMessage = options?.cursor
    ? await prisma.message.findFirst({
        where: { id: options.cursor, sessionId },
      })
    : null;

  if (options?.cursor && !cursorMessage) {
    throw new ChatError("Invalid cursor", 400);
  }

  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(cursorMessage
      ? {
          cursor: { id: cursorMessage.id },
          skip: 1,
        }
      : {}),
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;

  return {
    messages: page,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
    hasMore,
  };
}

export async function saveUserMessage(sessionId: string, content: string) {
  const session = await getSession(sessionId);
  if (!session) {
    throw new SessionError("Session not found or expired", 404);
  }

  if (session.escalated) {
    throw new ChatError("Session has been escalated", 409);
  }

  if (!session.categoryId) {
    throw new ChatError("Select a category before sending a message", 400);
  }

  const sanitized = sanitizeMessage(content);
  if (!sanitized) {
    throw new ChatError("Message cannot be empty", 400);
  }

  return prisma.message.create({
    data: {
      sessionId,
      role: MessageRole.USER,
      content: sanitized,
    },
  });
}

export async function saveAssistantMessage(sessionId: string, content: string) {
  return prisma.message.create({
    data: {
      sessionId,
      role: MessageRole.ASSISTANT,
      content: sanitizeMessage(content),
    },
  });
}

/**
 * Placeholder response generator — replaced by Claude + cache in Phase 5.
 * Yields text chunks for SSE streaming.
 */
export async function* generateStubResponse(
  userMessage: string,
  categoryLabel?: string
): AsyncGenerator<string> {
  const topic = categoryLabel ? ` about ${categoryLabel}` : "";
  const text =
    `Thanks for your message${topic}. I received: "${userMessage.slice(0, 120)}${userMessage.length > 120 ? "…" : ""}". ` +
    `Full AI-powered responses will be enabled in the next phase. ` +
    `For now, this confirms the chat streaming pipeline is working.`;

  const words = text.split(" ");
  for (const word of words) {
    yield word + " ";
  }
}

export class ChatError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ChatError";
  }
}
