export interface Category {
  id: string;
  slug: string;
  label: string;
  description: string | null;
}

export interface Session {
  id: string;
  categoryId: string | null;
  category: { id: string; slug: string; label: string } | null;
  escalated: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  streaming?: boolean;
  offerEscalation?: boolean;
}

export interface PaginatedMessages {
  messages: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}
