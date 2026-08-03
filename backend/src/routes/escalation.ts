import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireSession } from "../middleware/session.js";
import { escalationUpload } from "../lib/upload.js";
import {
  EscalationError,
  submitEscalation,
} from "../services/escalation.service.js";

const router = Router();

router.post(
  "/:sessionId/escalate",
  requireSession,
  (req, res, next) => {
    escalationUpload.array("images", 3)(req, res, (err) => {
      if (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Invalid upload",
        });
        return;
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    const customerEmail =
      typeof req.body?.customerEmail === "string"
        ? req.body.customerEmail
        : "";
    const message =
      typeof req.body?.message === "string" ? req.body.message : "";

    const files = req.files as Express.Multer.File[] | undefined;
    const imageFilenames = (files ?? []).map((file) => file.filename);

    try {
      const escalation = await submitEscalation({
        sessionId: req.chatSession!.id,
        customerEmail,
        message,
        imageFilenames,
      });

      res.status(201).json({
        escalation: {
          id: escalation.id,
          createdAt: escalation.createdAt.toISOString(),
        },
      });
    } catch (err) {
      if (err instanceof EscalationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

export default router;
