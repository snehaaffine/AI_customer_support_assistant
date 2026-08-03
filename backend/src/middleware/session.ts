import type { NextFunction, Request, Response } from "express";
import { getSession } from "../services/session.service.js";

export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionId =
    (req.params.sessionId as string | undefined) ??
    (req.headers["x-session-id"] as string | undefined);

  if (!sessionId) {
    res.status(400).json({ error: "Session ID is required" });
    return;
  }

  const session = await getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }

  req.chatSession = session;
  next();
}
