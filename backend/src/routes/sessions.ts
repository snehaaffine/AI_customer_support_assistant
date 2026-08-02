import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireSession } from "../middleware/session.js";
import {
  createSession,
  getSession,
  setSessionCategory,
  SessionError,
} from "../services/session.service.js";

const router = Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { id, categoryId } = req.body ?? {};

    if (id !== undefined && (typeof id !== "string" || !id.trim())) {
      res.status(400).json({ error: "Session id must be a non-empty string" });
      return;
    }

    if (
      categoryId !== undefined &&
      (typeof categoryId !== "string" || !categoryId.trim())
    ) {
      res.status(400).json({ error: "categoryId must be a non-empty string" });
      return;
    }

    try {
      const session = await createSession({ id, categoryId });
      res.status(201).json({
        session: {
          id: session.id,
          categoryId: session.categoryId,
          category: session.category,
          escalated: session.escalated,
          expiresAt: session.expiresAt.toISOString(),
          createdAt: session.createdAt.toISOString(),
        },
      });
    } catch (err) {
      if (err instanceof SessionError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  "/:sessionId",
  requireSession,
  asyncHandler(async (req, res) => {
    const session = req.chatSession!;
    res.json({
      session: {
        id: session.id,
        categoryId: session.categoryId,
        category: session.category,
        escalated: session.escalated,
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
      },
    });
  })
);

router.patch(
  "/:sessionId/category",
  requireSession,
  asyncHandler(async (req, res) => {
    const { categoryId } = req.body ?? {};

    if (typeof categoryId !== "string" || !categoryId.trim()) {
      res.status(400).json({ error: "categoryId is required" });
      return;
    }

    try {
      const session = await setSessionCategory(req.chatSession!.id, categoryId);
      res.json({
        session: {
          id: session.id,
          categoryId: session.categoryId,
          category: session.category,
          escalated: session.escalated,
          expiresAt: session.expiresAt.toISOString(),
          createdAt: session.createdAt.toISOString(),
        },
      });
    } catch (err) {
      if (err instanceof SessionError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

export default router;
