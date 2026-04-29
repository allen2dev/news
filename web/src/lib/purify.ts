import DOMPurify from "dompurify";

const CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "h2",
    "h3",
    "h4",
    "pre",
    "code",
    "img",
    "figure",
    "figcaption",
  ],
  ALLOWED_ATTR: ["href", "title", "src", "alt", "loading", "decoding"],
  ADD_ATTR: ["target", "rel"],
};

export function sanitizeArticleHtml(html: string) {
  if (!html) return "";
  return DOMPurify.sanitize(html, CONFIG as Parameters<typeof DOMPurify.sanitize>[1]);
}
