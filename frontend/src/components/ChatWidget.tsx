import { useCallback, useEffect, useState } from "react";
import { submitEscalation } from "../api/escalation.js";
import { fetchCategories } from "../api/chat.js";
import type { Category } from "../api/types.js";
import { useChat } from "../hooks/useChat.js";
import { useSession } from "../hooks/useSession.js";
import CategoryPicker from "./CategoryPicker.js";
import ChatInput from "./ChatInput.js";
import EscalationDialog from "./EscalationDialog.js";
import MessageList from "./MessageList.js";

export default function ChatWidget() {
  const {
    session,
    loading: sessionLoading,
    error: sessionError,
    selectCategory,
    refreshSession,
    retry,
  } = useSession();
  const [isOpen, setIsOpen] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [selectingCategory, setSelectingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [escalationOpen, setEscalationOpen] = useState(false);
  const [escalationSubmitting, setEscalationSubmitting] = useState(false);
  const [escalationError, setEscalationError] = useState<string | null>(null);

  const categorySelected = Boolean(session?.categoryId);

  const openEscalation = useCallback(() => {
    if (session?.escalated) return;
    setEscalationError(null);
    setEscalationOpen(true);
  }, [session?.escalated]);

  const {
    messages,
    isTyping,
    sendError,
    loadingHistory,
    hasMore,
    loadOlder,
    sendMessage,
  } = useChat(session?.id ?? null, categorySelected);

  useEffect(() => {
    fetchCategories()
      .then(({ categories: cats }) => setCategories(cats))
      .catch(() => setCategoryError("Failed to load categories"))
      .finally(() => setCategoriesLoading(false));
  }, []);

  const handleCategorySelect = async (categoryId: string) => {
    setSelectingCategory(true);
    setCategoryError(null);
    try {
      await selectCategory(categoryId);
    } catch (err) {
      setCategoryError(
        err instanceof Error ? err.message : "Failed to select category"
      );
    } finally {
      setSelectingCategory(false);
    }
  };

  const handleEscalationSubmit = async (data: {
    customerEmail: string;
    message: string;
    images: File[];
  }) => {
    if (!session?.id) return;

    setEscalationSubmitting(true);
    setEscalationError(null);

    try {
      await submitEscalation(session.id, data);
      setEscalationOpen(false);
      await refreshSession();
    } catch (err) {
      setEscalationError(
        err instanceof Error ? err.message : "Failed to submit escalation"
      );
    } finally {
      setEscalationSubmitting(false);
    }
  };

  const showCategoryPicker = !categorySelected;
  const chatDisabled = isTyping || Boolean(session?.escalated);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-brand-600 text-white rounded-full shadow-lg hover:bg-brand-700 hover:scale-105 transition-all flex items-center justify-center"
        aria-label="Open chat"
      >
        <svg
          className="w-7 h-7"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[380px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-brand-600 text-white px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center shrink-0">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-base leading-tight">
            Customer Support
          </h1>
          <p className="text-brand-100 text-xs truncate">
            {session?.escalated
              ? "Request submitted — we'll email you"
              : (session?.category?.label ?? "We're here to help")}
          </p>
        </div>
        {!session?.escalated && (
          <span
            className="w-2 h-2 bg-green-400 rounded-full shrink-0"
            title="Online"
          />
        )}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
          aria-label="Close chat"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </header>

      {/* Body */}
      <div className="relative flex flex-col flex-1 min-h-0 bg-gray-50">
        {sessionLoading ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Connecting…</p>
          </div>
        ) : sessionError ? (
          <div className="flex flex-col items-center justify-center flex-1 p-6 text-center gap-3">
            <p className="text-sm text-red-600">{sessionError}</p>
            <button
              type="button"
              onClick={retry}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              Try again
            </button>
          </div>
        ) : showCategoryPicker ? (
          <>
            <CategoryPicker
              categories={categories}
              loading={categoriesLoading}
              selecting={selectingCategory}
              onSelect={handleCategorySelect}
            />
            {categoryError && (
              <p className="text-xs text-red-600 text-center px-4 pb-3">
                {categoryError}
              </p>
            )}
          </>
        ) : session?.escalated ? (
          <div className="flex flex-col flex-1 min-h-0">
            <MessageList
              messages={messages}
              isTyping={false}
              hasMore={hasMore}
              loadingHistory={loadingHistory}
              onLoadOlder={loadOlder}
              showEscalateActions={false}
            />
            <div className="shrink-0 px-4 py-3 bg-white border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Your request has been submitted. We'll follow up by email.
              </p>
            </div>
          </div>
        ) : (
          <>
            <MessageList
              messages={messages}
              isTyping={isTyping}
              hasMore={hasMore}
              loadingHistory={loadingHistory}
              onLoadOlder={loadOlder}
              onEscalate={openEscalation}
              showEscalateActions={!session?.escalated}
            />
            {sendError && (
              <div className="px-4 py-2 bg-red-50 border-t border-red-100">
                <p className="text-xs text-red-600">{sendError}</p>
              </div>
            )}
            <ChatInput
              onSend={sendMessage}
              disabled={chatDisabled}
              placeholder="Type your message…"
            />
            <EscalationDialog
              open={escalationOpen}
              submitting={escalationSubmitting}
              error={escalationError}
              onSubmit={handleEscalationSubmit}
              onClose={() => {
                if (!escalationSubmitting) setEscalationOpen(false);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
