import type { Session } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      chatSession?: Session & {
        category?: { id: string; slug: string; label: string } | null;
      };
    }
  }
}

export {};
