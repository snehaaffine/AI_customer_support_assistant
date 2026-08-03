import { apiFetch } from "./client.js";
import type { Category, PaginatedMessages, Session } from "./types.js";

export function fetchCategories(): Promise<{ categories: Category[] }> {
  return apiFetch("/api/categories");
}

export function createSession(
  id?: string
): Promise<{ session: Session }> {
  return apiFetch("/api/sessions", {
    method: "POST",
    body: JSON.stringify(id ? { id } : {}),
  });
}

export function getSession(
  sessionId: string
): Promise<{ session: Session }> {
  return apiFetch(`/api/sessions/${sessionId}`);
}

export function setSessionCategory(
  sessionId: string,
  categoryId: string
): Promise<{ session: Session }> {
  return apiFetch(`/api/sessions/${sessionId}/category`, {
    method: "PATCH",
    body: JSON.stringify({ categoryId }),
  });
}

export function fetchMessages(
  sessionId: string,
  options?: { cursor?: string; limit?: number }
): Promise<PaginatedMessages> {
  const params = new URLSearchParams();
  if (options?.cursor) params.set("cursor", options.cursor);
  if (options?.limit) params.set("limit", String(options.limit));

  const query = params.toString();
  return apiFetch(
    `/api/chat/${sessionId}/messages${query ? `?${query}` : ""}`
  );
}

export interface StreamHandlers {
  onStart?: (data: { userMessageId: string }) => void;
  onDelta?: (delta: string) => void;
  onEnd?: (data: {
    messageId: string;
    fromCache: boolean;
    shouldEscalate: boolean;
  }) => void;
  onError?: (error: string) => void;
}

export async function sendMessageStream(
  sessionId: string,
  content: string,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`/api/chat/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.error === "string") message = body.error;
    } catch {
      // ignore
    }
    handlers.onError?.(message);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    handlers.onError?.("No response stream");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const block of events) {
      if (!block.trim()) continue;

      let eventType = "message";
      let data = "";

      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7);
        } else if (line.startsWith("data: ")) {
          data = line.slice(6);
        }
      }

      if (!data) continue;

      try {
        const parsed = JSON.parse(data);
        switch (eventType) {
          case "message_start":
            handlers.onStart?.(parsed);
            break;
          case "content_delta":
            handlers.onDelta?.(parsed.delta);
            break;
          case "message_end":
            handlers.onEnd?.(parsed);
            break;
          case "error":
            handlers.onError?.(parsed.error ?? "Stream error");
            break;
        }
      } catch {
        // skip malformed events
      }
    }
  }
}
