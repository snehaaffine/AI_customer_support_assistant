import { Router } from "express";
import { getEnabledCategories } from "../lib/db-helpers.js";
import { asyncHandler } from "../middleware/async-handler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await getEnabledCategories();
    res.json({
      categories: categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        label: c.label,
        description: c.description,
      })),
    });
  })
);

export default router;
