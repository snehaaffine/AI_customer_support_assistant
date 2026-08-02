import { MessageRole } from "@prisma/client";
import { getSystemConfig } from "../lib/db-helpers.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeMessage } from "../lib/sanitize.js";
import { streamChatCompletion } from "./ai.service.js";
import {
  findCachedAnswer,
  isCacheableAnswer,
  shouldBypassCache,
  storeCachedAnswer,
} from "./cache.service.js";
import { shouldEscalate } from "./escalation.service.js";
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

export interface ChatGenerationResult {
  stream: AsyncGenerator<string>;
  fromCache: boolean;
  shouldEscalate: boolean;
}

const MAX_HISTORY_MESSAGES = 20;

export async function generateChatResponse(
  sessionId: string,
  userMessage: string,
  categoryLabel?: string,
  categorySlug?: string
): Promise<ChatGenerationResult> {
  const config = await getSystemConfig();
  const escalate = await shouldEscalate({
    message: userMessage,
    category: categorySlug ? { slug: categorySlug } : null,
  });

  const bypassCache = shouldBypassCache(userMessage);

  if (!bypassCache) {
    const cached = await findCachedAnswer(userMessage, config.promptVersion);
    if (cached) {
      const answer = cached;
      async function* cachedStream() {
        yield answer;
      }
      return { stream: cachedStream(), fromCache: true, shouldEscalate: escalate };
    }
  }

  const history = await prisma.message.findMany({
    where: { sessionId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MAX_HISTORY_MESSAGES,
    select: { role: true, content: true },
  });

  const messages = history.map((m) => ({
    role: m.role === MessageRole.ASSISTANT ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  const generator = streamChatCompletion(
    config.systemPrompt,
    messages,
    categoryLabel
  );

  if (bypassCache) {
    return { stream: generator, fromCache: false, shouldEscalate: escalate };
  }

  async function* cachingStream() {
    let fullResponse = "";
    for await (const chunk of generator) {
      fullResponse += chunk;
      yield chunk;
    }

    if (
      fullResponse.trim() &&
      isCacheableAnswer(fullResponse) &&
      !shouldBypassCache(userMessage)
    ) {
      try {
        await storeCachedAnswer(
          userMessage,
          fullResponse,
          config.promptVersion
        );
      } catch (err) {
        console.error("Failed to store cached response:", err);
      }
    }
  }

  return { stream: cachingStream(), fromCache: false, shouldEscalate: escalate };
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
