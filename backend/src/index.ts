import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { cleanupExpiredSessions } from "./lib/db-helpers.js";

const app = createApp();

async function start() {
  try {
    const removed = await cleanupExpiredSessions();
    if (removed > 0) {
      console.log(`Cleaned up ${removed} expired session(s)`);
    }
  } catch (err) {
    console.warn(
      "Session cleanup skipped (database may not be ready):",
      err instanceof Error ? err.message : err
    );
  }

  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
    console.log(`Environment: ${env.nodeEnv}`);
  });
}

start();

// Periodic cleanup every hour
setInterval(
  () => {
    cleanupExpiredSessions().catch((err) =>
      console.error("Periodic session cleanup failed:", err)
    );
  },
  60 * 60 * 1000
);
