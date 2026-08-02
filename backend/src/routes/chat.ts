import { Router } from "express";
import { isValidMessage } from "../lib/sanitize.js";
import { endSse, initSse, writeSseEvent } from "../lib/sse.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireSession } from "../middleware/session.js";
import {
  ChatError,
  generateChatResponse,
  getMessages,
  saveAssistantMessage,
  saveUserMessage,
} from "../services/chat.service.js";
import { SessionError } from "../services/session.service.js";

const router = Router();

router.get(
  "/:sessionId/messages",
  requireSession,
  asyncHandler(async (req, res) => {
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit =
      typeof req.query.limit === "string"
        ? parseInt(req.query.limit, 10)
        : undefined;

    if (limit !== undefined && (Number.isNaN(limit) || limit < 1)) {
      res.status(400).json({ error: "limit must be a positive integer" });
      return;
    }

    try {
      const result = await getMessages(req.chatSession!.id, { cursor, limit });
      res.json({
        messages: result.messages.map((m) => ({
          id: m.id,
          role: m.role.toLowerCase(),
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      });
    } catch (err) {
      if (err instanceof SessionError || err instanceof ChatError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.post(
  "/:sessionId/messages",
  requireSession,
  asyncHandler(async (req, res) => {
    const { content } = req.body ?? {};

    if (typeof content !== "string") {
      res.status(400).json({ error: "content is required" });
      return;
    }

    if (!isValidMessage(content)) {
      res.status(400).json({
        error: "Message must be between 1 and 4000 characters after sanitization",
      });
      return;
    }

    const session = req.chatSession!;

    try {
      const userMessage = await saveUserMessage(session.id, content);

      initSse(res);

      let assistantContent = "";
      const categoryLabel = session.category?.label;
      const categorySlug = session.category?.slug;

      writeSseEvent(res, "message_start", {
        userMessageId: userMessage.id,
      });

      const { stream, fromCache, shouldEscalate: escalate } =
        await generateChatResponse(
          session.id,
          content,
          categoryLabel,
          categorySlug
        );

      for await (const chunk of stream) {
        assistantContent += chunk;
        writeSseEvent(res, "content_delta", { delta: chunk });
      }

      const assistantMessage = await saveAssistantMessage(
        session.id,
        assistantContent
      );

      writeSseEvent(res, "message_end", {
        messageId: assistantMessage.id,
        fromCache,
        shouldEscalate: escalate,
      });

      endSse(res);
    } catch (err) {
      if (res.headersSent) {
        writeSseEvent(res, "error", {
          error:
            err instanceof Error ? err.message : "Failed to generate response",
        });
        endSse(res);
        return;
      }

      if (err instanceof SessionError || err instanceof ChatError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

export default router;
