import { useCallback, useEffect, useState } from "react";
import { createSession, getSession, setSessionCategory } from "../api/chat.js";
import { ApiError } from "../api/client.js";
import type { Session } from "../api/types.js";

const SESSION_KEY = "csa_session_id";

function readStoredSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function storeSessionId(id: string): void {
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    // ignore storage failures
  }
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const storedId = readStoredSessionId();

      if (storedId) {
        try {
          const { session: existing } = await getSession(storedId);
          setSession(existing);
          return;
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 404)) {
            throw err;
          }
        }
      }

      const { session: created } = await createSession(storedId ?? undefined);
      storeSessionId(created.id);
      setSession(created);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to initialize session"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const selectCategory = useCallback(
    async (categoryId: string) => {
      if (!session) return;

      const { session: updated } = await setSessionCategory(
        session.id,
        categoryId
      );
      setSession(updated);
    },
    [session]
  );

  const refreshSession = useCallback(async () => {
    if (!session?.id) return;

    const { session: updated } = await getSession(session.id);
    setSession(updated);
  }, [session?.id]);

  return {
    session,
    loading,
    error,
    selectCategory,
    refreshSession,
    retry: initSession,
  };
}
