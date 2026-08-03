import type { Session } from "@prisma/client";
import type { AdminTokenPayload } from "../services/admin.service.js";

declare global {
  namespace Express {
    interface Request {
      chatSession?: Session & {
        category?: { id: string; slug: string; label: string } | null;
      };
      admin?: AdminTokenPayload;
    }
  }
}

export {};
