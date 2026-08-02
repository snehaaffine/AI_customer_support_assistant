import { useEffect, useRef } from "react";
import type { Message } from "../api/types.js";
import MessageBubble from "./MessageBubble.js";
import TypingIndicator from "./TypingIndicator.js";

interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
  hasMore: boolean;
  loadingHistory: boolean;
  onLoadOlder: () => void;
}

export default function MessageList({
  messages,
  isTyping,
  hasMore,
  loadingHistory,
  onLoadOlder,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;

      if (scrollTop < 40 && hasMore && !loadingHistory) {
        onLoadOlder();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingHistory, onLoadOlder]);

  useEffect(() => {
    const grew = messages.length > prevLengthRef.current;
    prevLengthRef.current = messages.length;

    if (grew && isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const showTyping =
    isTyping &&
    (messages.length === 0 ||
      !messages[messages.length - 1]?.streaming ||
      messages[messages.length - 1]?.content === "");

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
    >
      {hasMore && (
        <div className="text-center py-2">
          {loadingHistory ? (
            <span className="text-xs text-gray-400">Loading earlier messages…</span>
          ) : (
            <button
              type="button"
              onClick={onLoadOlder}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              Load earlier messages
            </button>
          )}
        </div>
      )}

      {messages.length === 0 && !isTyping && (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <p className="text-gray-400 text-sm">
            Send a message to start the conversation
          </p>
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {showTyping && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  );
}
