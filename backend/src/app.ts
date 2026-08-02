import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { ChatError } from "./services/chat.service.js";
import { EscalationError } from "./services/escalation.service.js";
import { SessionError } from "./services/session.service.js";
import categoriesRouter from "./routes/categories.js";
import chatRouter from "./routes/chat.js";
import escalationRouter from "./routes/escalation.js";
import sessionsRouter from "./routes/sessions.js";
import { uploadDir } from "./lib/upload.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.isDev
        ? [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
          ]
        : undefined,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads", express.static(uploadDir));

  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a moment." },
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
    });
  });

  app.use("/api/categories", categoriesRouter);
  app.use("/api/sessions", sessionsRouter);
  app.use("/api/sessions", escalationRouter);
  app.use("/api/chat", chatLimiter, chatRouter);

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error(err);

      if (err instanceof SessionError || err instanceof ChatError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }

      if (err instanceof EscalationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }

      res.status(500).json({ error: "Internal server error" });
    }
  );

  return app;
}
