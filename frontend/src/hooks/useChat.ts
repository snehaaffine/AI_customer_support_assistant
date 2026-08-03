import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMessages, sendMessageStream } from "../api/chat.js";
import type { Message } from "../api/types.js";

const STREAM_CHARS_PER_TICK = 3;
const STREAM_TICK_MS = 45;

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
      let assistantId: string | null = null;

      const userMessage: Message = {
        id: tempUserId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const pendingRef = { current: "" };
      let streamDone = false;
      let shouldEscalatePending = false;
      let finalMessageId = "";
      let drainInterval: ReturnType<typeof setInterval> | null = null;

      const stopDrain = () => {
        if (drainInterval) {
          clearInterval(drainInterval);
          drainInterval = null;
        }
      };

      const finalizeAssistant = () => {
        if (!assistantId) return;

        const offerEscalation = shouldEscalatePending;
        shouldEscalatePending = false;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  id: finalMessageId || m.id,
                  streaming: false,
                  ...(offerEscalation ? { offerEscalation: true } : {}),
                }
              : m
          )
        );
      };

      const completeStream = () => {
        stopDrain();
        finalizeAssistant();
        setIsTyping(false);
      };

      const drainPending = () => {
        if (pendingRef.current.length === 0) {
          if (streamDone) {
            completeStream();
          }
          return;
        }

        const chunk = pendingRef.current.slice(0, STREAM_CHARS_PER_TICK);
        pendingRef.current = pendingRef.current.slice(STREAM_CHARS_PER_TICK);

        if (!assistantId) {
          assistantId = `temp-assistant-${Date.now()}`;
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId!,
              role: "assistant",
              content: chunk,
              createdAt: new Date().toISOString(),
              streaming: true,
            },
          ]);
          return;
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      };

      const startDrain = () => {
        if (drainInterval) return;
        drainInterval = setInterval(drainPending, STREAM_TICK_MS);
      };

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
              pendingRef.current += delta;
              startDrain();
            },
            onEnd: ({ messageId, shouldEscalate }) => {
              streamDone = true;
              finalMessageId = messageId;
              shouldEscalatePending = shouldEscalate;
              if (!drainInterval && pendingRef.current.length === 0) {
                completeStream();
              }
            },
            onError: (error) => {
              stopDrain();
              setSendError(error);
              if (assistantId) {
                setMessages((prev) =>
                  prev
                    .filter((m) => m.id !== assistantId || m.content.length > 0)
                    .map((m) =>
                      m.id === assistantId ? { ...m, streaming: false } : m
                    )
                );
              }
              setIsTyping(false);
            },
          },
          controller.signal
        );
      } catch (err) {
        stopDrain();
        if (err instanceof DOMException && err.name === "AbortError") {
          setIsTyping(false);
          return;
        }
        setSendError(
          err instanceof Error ? err.message : "Failed to send message"
        );
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
