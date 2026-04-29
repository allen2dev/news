import DOMPurify from "dompurify";

/** Rich article HTML (e.g. Dev.to): semantic tags + tables/code; XSS handled by DOMPurify. */
const CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "hr",
    "div",
    "span",
    "section",
    "article",
    "main",
    "aside",
    "header",
    "footer",
    "nav",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "s",
    "mark",
    "del",
    "ins",
    "sub",
    "sup",
    "small",
    "a",
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "pre",
    "code",
    "img",
    "picture",
    "source",
    "figure",
    "figcaption",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "colgroup",
    "col",
  ],
  ALLOWED_ATTR: [
    "href",
    "title",
    "src",
    "alt",
    "loading",
    "decoding",
    "class",
    "id",
    "width",
    "height",
    "colspan",
    "rowspan",
    "scope",
    "start",
    "type",
    "reversed",
    "cite",
    "datetime",
    "target",
    "rel",
    "media",
    "sizes",
    "srcset",
  ],
  FORBID_TAGS: [
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "textarea",
    "select",
    "option",
    "button",
    "style",
    "script",
    "link",
    "meta",
    "base",
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ADD_ATTR: ["target", "rel"],
};

/**
 * RSS / JSON APIs sometimes return HTML that was entity-encoded once or twice,
 * so the UI shows literal "&lt;p&gt;" instead of paragraphs. Decode until stable.
 */
export function decodeRepeatedEntities(html: string): string {
  if (!html || typeof document === "undefined") return html;
  const textarea = document.createElement("textarea");
  let cur = html;
  const max = 6;
  for (let i = 0; i < max; i++) {
    textarea.innerHTML = cur;
    const next = textarea.value;
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/** True if content looks like escaped markup (tags visible as text). */
function looksLikeEscapedHtml(s: string): boolean {
  const t = s.trim().slice(0, 500);
  return /&lt;[a-z][^>]*&gt;/i.test(t) || /^&lt;!/.test(t);
}

export function sanitizeArticleHtml(html: string) {
  if (!html) return "";
  let input = html.trim();

  if (looksLikeEscapedHtml(input)) {
    input = decodeRepeatedEntities(input);
  }

  const sanitized = DOMPurify.sanitize(input, CONFIG);

  /* Last resort: if DOMPurify stripped everything because input was still escaped */
  if (
    sanitized.replace(/<[^>]+>/g, "").trim().length < 20 &&
    looksLikeEscapedHtml(input)
  ) {
    const again = decodeRepeatedEntities(input);
    if (again !== input) {
      return DOMPurify.sanitize(again, CONFIG);
    }
  }

  return sanitized;
}
