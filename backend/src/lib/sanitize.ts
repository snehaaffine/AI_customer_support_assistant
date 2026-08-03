import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: "discard",
};

/** Strip HTML and trim user-provided text before storage or rendering. */
export function sanitizeMessage(content: string): string {
  return sanitizeHtml(content, SANITIZE_OPTIONS).trim();
}

export function isValidMessage(content: string): boolean {
  const sanitized = sanitizeMessage(content);
  return sanitized.length > 0 && sanitized.length <= 4000;
}
