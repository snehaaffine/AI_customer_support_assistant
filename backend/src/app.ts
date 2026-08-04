import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { ChatError } from "./services/chat.service.js";
import { EscalationError } from "./services/escalation.service.js";
import { AdminError } from "./services/admin.service.js";
import { SessionError } from "./services/session.service.js";
import categoriesRouter from "./routes/categories.js";
import chatRouter from "./routes/chat.js";
import escalationRouter from "./routes/escalation.js";
import adminRouter from "./routes/admin.js";
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
  app.use("/api/admin", adminRouter);

  // Serve the built SPA whenever dist exists (Docker/Railway). Do not gate on
  // NODE_ENV — Railway may leave NODE_ENV=development and otherwise return
  // "Cannot GET /" even though /api/health works.
  const frontendDist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../frontend/dist"
  );
  if (fs.existsSync(path.join(frontendDist, "index.html"))) {
    app.use(express.static(frontendDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

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

      if (err instanceof AdminError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }

      res.status(500).json({ error: "Internal server error" });
    }
  );

  return app;
}
