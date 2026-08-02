import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMessages, sendMessageStream } from "../api/chat.js";
import type { Message } from "../api/types.js";

export function useChat(sessionId: string | null, categorySelected: boolean) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const historyLoadedRef = useRef(false);

  const loadMessages = useCallback(
    async (cursor?: string) => {
      if (!sessionId) return;

      setLoadingHistory(true);
      try {
        const result = await fetchMessages(sessionId, { cursor, limit: 20 });
        setHasMore(result.hasMore);
        setNextCursor(result.nextCursor);

        if (cursor) {
          setMessages((prev) => [...result.messages, ...prev]);
        } else {
          setMessages(result.messages);
        }
      } finally {
        setLoadingHistory(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    if (!sessionId || !categorySelected) {
      setMessages([]);
      historyLoadedRef.current = false;
      return;
    }

    if (!historyLoadedRef.current) {
      historyLoadedRef.current = true;
      loadMessages();
    }
  }, [sessionId, categorySelected, loadMessages]);

  const loadOlder = useCallback(() => {
    if (!nextCursor || loadingHistory) return;
    loadMessages(nextCursor);
  }, [nextCursor, loadingHistory, loadMessages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || isTyping) return;

      setSendError(null);
      setIsTyping(true);

      const tempUserId = `temp-user-${Date.now()}`;
      const tempAssistantId = `temp-assistant-${Date.now()}`;

      const userMessage: Message = {
        id: tempUserId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };

      const assistantMessage: Message = {
        id: tempAssistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        streaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await sendMessageStream(
          sessionId,
          content,
          {
            onStart: ({ userMessageId }) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempUserId ? { ...m, id: userMessageId } : m
                )
              );
            },
            onDelta: (delta) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? { ...m, content: m.content + delta }
                    : m
                )
              );
            },
            onEnd: ({ messageId }) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? { ...m, id: messageId, streaming: false }
                    : m
                )
              );
            },
            onError: (error) => {
              setSendError(error);
              setMessages((prev) =>
                prev.filter(
                  (m) => m.id !== tempAssistantId || m.content.length > 0
                ).map((m) =>
                  m.id === tempAssistantId
                    ? { ...m, streaming: false }
                    : m
                )
              );
            },
          },
          controller.signal
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSendError(
          err instanceof Error ? err.message : "Failed to send message"
        );
      } finally {
        setIsTyping(false);
      }
    },
    [sessionId, isTyping]
  );

  return {
    messages,
    isTyping,
    sendError,
    loadingHistory,
    hasMore,
    loadOlder,
    sendMessage,
  };
}
