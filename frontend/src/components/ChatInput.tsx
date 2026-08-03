import {
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
  placeholder?: string;
}

const MAX_LENGTH = 4000;

export default function ChatInput({
  onSend,
  disabled,
  placeholder = "Type your message…",
}: ChatInputProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = !disabled && Boolean(value.trim());

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 bg-white p-3"
    >
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed max-h-32"
          style={{
            minHeight: "42px",
            fieldSizing: "content",
          } as CSSProperties}
        />
        <button
          type="submit"
          disabled={!canSend}
          className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed ${
            canSend
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "bg-gray-200 text-gray-400"
          }`}
          aria-label="Send message"
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
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
      {value.length > MAX_LENGTH * 0.9 && (
        <p className="text-[10px] text-gray-400 mt-1 text-right">
          {value.length}/{MAX_LENGTH}
        </p>
      )}
    </form>
  );
}
