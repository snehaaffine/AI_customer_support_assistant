import { useState, type FormEvent } from "react";

interface EscalationDialogProps {
  open: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (data: {
    customerEmail: string;
    message: string;
    images: File[];
  }) => void;
  onClose: () => void;
}

const MAX_MESSAGE = 2000;
const MAX_IMAGES = 3;

export default function EscalationDialog({
  open,
  submitting,
  error,
  onSubmit,
  onClose,
}: EscalationDialogProps) {
  const [customerEmail, setCustomerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<File[]>([]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ customerEmail, message, images });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES);
    setImages(files);
  };

  const canSubmit =
    !submitting &&
    customerEmail.trim().length > 0 &&
    message.trim().length > 0;

  return (
    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="escalation-title"
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h2
            id="escalation-title"
            className="text-base font-semibold text-gray-900"
          >
            Contact support
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            A team member will follow up by email. Add any details or photos
            that might help.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label
              htmlFor="escalation-email"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Your email
            </label>
            <input
              id="escalation-email"
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              disabled={submitting}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="escalation-message"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Message
            </label>
            <textarea
              id="escalation-message"
              required
              rows={4}
              value={message}
              onChange={(e) =>
                setMessage(e.target.value.slice(0, MAX_MESSAGE))
              }
              disabled={submitting}
              placeholder="Describe your issue or add context…"
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="escalation-images"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Photos (optional, up to {MAX_IMAGES})
            </label>
            <input
              id="escalation-images"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={submitting}
              onChange={handleImageChange}
              className="w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 file:text-xs file:font-medium"
            />
            {images.length > 0 && (
              <p className="text-[10px] text-gray-400 mt-1">
                {images.length} file{images.length === 1 ? "" : "s"} selected
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending…" : "Send to support"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
