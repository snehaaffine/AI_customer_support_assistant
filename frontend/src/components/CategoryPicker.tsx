import type { Category } from "../api/types.js";

interface CategoryPickerProps {
  categories: Category[];
  loading: boolean;
  selecting?: boolean;
  onSelect: (categoryId: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  "order-status": "📦",
  "damaged-lost": "⚠️",
  other: "💬",
};

function getIcon(slug: string): string {
  return CATEGORY_ICONS[slug] ?? "💬";
}

export default function CategoryPicker({
  categories,
  loading,
  selecting = false,
  onSelect,
}: CategoryPickerProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-6 gap-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading options…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-5 overflow-y-auto">
      <div className="text-center mb-5">
        <h2 className="text-lg font-semibold text-gray-900">
          How can we help?
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose a topic to get started
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            disabled={selecting}
            onClick={() => onSelect(category.id)}
            className="flex items-start gap-3 w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50 transition-colors group"
          >
            <span className="text-2xl shrink-0 mt-0.5" aria-hidden>
              {getIcon(category.slug)}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 group-hover:text-brand-700">
                {category.label}
              </p>
              {category.description && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {category.description}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
