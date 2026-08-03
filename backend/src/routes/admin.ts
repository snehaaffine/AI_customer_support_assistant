import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/auth.js";
import {
  AdminError,
  getSystemConfigAdmin,
  listEscalationRules,
  listRecentEscalations,
  loginAdmin,
  updateEscalationRule,
  updateSystemPrompt,
} from "../services/admin.service.js";

const router = Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body ?? {};

    if (typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "username and password are required" });
      return;
    }

    try {
      const result = await loginAdmin(username, password);
      res.json(result);
    } catch (err) {
      if (err instanceof AdminError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  "/config",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const config = await getSystemConfigAdmin();
    res.json({
      systemPrompt: config.systemPrompt,
      promptVersion: config.promptVersion,
      updatedAt: config.updatedAt.toISOString(),
    });
  })
);

router.put(
  "/config",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { systemPrompt } = req.body ?? {};

    if (typeof systemPrompt !== "string") {
      res.status(400).json({ error: "systemPrompt is required" });
      return;
    }

    try {
      const config = await updateSystemPrompt(systemPrompt);
      res.json({
        systemPrompt: config.systemPrompt,
        promptVersion: config.promptVersion,
        updatedAt: config.updatedAt.toISOString(),
      });
    } catch (err) {
      if (err instanceof AdminError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  "/escalation-rules",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rules = await listEscalationRules();
    res.json({
      rules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        config: r.config,
        enabled: r.enabled,
        priority: r.priority,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  })
);

router.patch(
  "/escalation-rules/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { enabled, priority } = req.body ?? {};

    if (enabled !== undefined && typeof enabled !== "boolean") {
      res.status(400).json({ error: "enabled must be a boolean" });
      return;
    }

    if (
      priority !== undefined &&
      (typeof priority !== "number" || !Number.isInteger(priority))
    ) {
      res.status(400).json({ error: "priority must be an integer" });
      return;
    }

    try {
      const rule = await updateEscalationRule(String(req.params.id), {
        enabled,
        priority,
      });
      res.json({
        rule: {
          id: rule.id,
          name: rule.name,
          type: rule.type,
          config: rule.config,
          enabled: rule.enabled,
          priority: rule.priority,
          updatedAt: rule.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      if (err instanceof AdminError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

router.get(
  "/escalations",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit =
      typeof req.query.limit === "string"
        ? parseInt(req.query.limit, 10)
        : 20;

    const escalations = await listRecentEscalations(
      Number.isNaN(limit) ? 20 : Math.min(limit, 100)
    );

    res.json({
      escalations: escalations.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  })
);

export default router;
