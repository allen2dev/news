import type { RssItem } from "./types";

export const FEEDS = [
  { source: "GitHub Blog", url: "https://github.blog/feed/" },
  { source: "Dev.to", url: "https://dev.to/feed" },
  { source: "CSS-Tricks", url: "https://css-tricks.com/feed/" },
] as const;

const RSS2JSON = "https://api.rss2json.com/v1/api.json";
export const STORAGE_PREFIX = "pulse-item:";

const CONTENT_NS = "http://purl.org/rss/1.0/modules/content/";

const PROXY_BUILDERS = [
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u: string) =>
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u: string) =>
    `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(u)}`,
  (u: string) =>
    `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

const FETCH_TIMEOUT_MS = 14_000;

function rssUrl(feedUrl: string) {
  return `${RSS2JSON}?rss_url=${encodeURIComponent(feedUrl)}`;
}

function parseRss2Json(data: { status?: string; items?: unknown[] }) {
  if (data.status === "ok" && Array.isArray(data.items)) return data.items;
  return null;
}

async function fetchWithTimeout(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { cache: "no-store", signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchTextViaProxies(feedUrl: string) {
  let lastErr: unknown;
  for (const build of PROXY_BUILDERS) {
    try {
      const res = await fetchWithTimeout(build(feedUrl));
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      const trimmed = text?.trim() || "";
      if (trimmed.length > 80 && looksLikeFeed(trimmed)) return trimmed;
      lastErr = new Error("short or non-feed response");
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all CORS proxies failed");
}

function looksLikeFeed(text: string) {
  const head = text.slice(0, 800).toLowerCase();
  return head.includes("<rss") || head.includes("<feed") || head.includes("<?xml");
}

function textFromEl(el: Element | null) {
  return el?.textContent?.trim() || "";
}

function getContentEncoded(itemEl: Element) {
  const list = itemEl.getElementsByTagNameNS(CONTENT_NS, "encoded");
  if (list.length)
    return list[0].innerHTML || textFromEl(list[0]) || "";
  const any = itemEl.querySelector("*|encoded");
  if (any?.namespaceURI?.includes("content")) return any.innerHTML || "";
  return "";
}

function normalizeFromRaw(item: Record<string, unknown>, source: string): RssItem {
  const link = String(item.link || item.guid || "#");
  const title = stripHtml(String(item.title || "")) || "Untitled";
  const rawHtml =
    String(item.content || item["content:encoded"] || item.description || "");
  const excerpt = stripHtml(rawHtml).slice(0, 280) || "";
  const enc = item.enclosure as { link?: string } | undefined;
  const thumb =
    String(item.thumbnail || enc?.link || firstImageFromHtml(rawHtml) || "");
  const pub = String(
    item.pubDate || item.isoDate || item.published || new Date().toISOString()
  );
  const ts = new Date(pub).getTime();
  const id = hashId(`${source}|${link}|${title}`);
  return {
    id,
    source,
    title,
    link,
    excerpt,
    thumb,
    html: rawHtml,
    ts: Number.isFinite(ts) ? ts : Date.now(),
  };
}

export function stripHtml(html: string) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent?.trim() || "";
}

const IMG_RE = /<img[^>]+src=["']([^"']+)["']/i;

function firstImageFromHtml(html: string) {
  const m = html.match(IMG_RE);
  return m ? m[1].trim() : "";
}

export function hashId(str: string) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return `a${(h >>> 0).toString(36)}`;
}

function parseRssChannel(doc: Document, source: string): RssItem[] {
  const itemEls = doc.querySelectorAll("channel > item, rss channel > item");
  const out: RssItem[] = [];
  itemEls.forEach((itemEl) => {
    const title = textFromEl(itemEl.querySelector("title")) || "Untitled";
    const linkEl = itemEl.querySelector("link");
    const link =
      textFromEl(linkEl) ||
      linkEl?.getAttribute?.("href") ||
      textFromEl(itemEl.querySelector("guid")) ||
      "#";
    const pub =
      textFromEl(itemEl.querySelector("pubDate")) ||
      textFromEl(itemEl.querySelector("published")) ||
      textFromEl(itemEl.querySelector("updated"));
    const desc =
      itemEl.querySelector("description")?.innerHTML ||
      textFromEl(itemEl.querySelector("description")) ||
      "";
    const encoded = getContentEncoded(itemEl);
    const rawHtml = encoded || desc;
    out.push(
      normalizeFromRaw(
        {
          title,
          link,
          description: rawHtml,
          content: encoded || "",
          pubDate: pub || undefined,
        },
        source
      )
    );
  });
  return out;
}

function parseAtomFeed(doc: Document, source: string): RssItem[] {
  const entries = doc.querySelectorAll("feed > entry");
  const out: RssItem[] = [];
  entries.forEach((entry) => {
    const title = textFromEl(entry.querySelector("title")) || "Untitled";
    const linkEl =
      entry.querySelector('link[rel="alternate"]') || entry.querySelector("link");
    const link =
      linkEl?.getAttribute?.("href") || textFromEl(linkEl) || "#";
    const pub =
      textFromEl(entry.querySelector("published")) ||
      textFromEl(entry.querySelector("updated"));
    const summary = entry.querySelector("summary")?.innerHTML || "";
    const contentEl =
      entry.querySelector("content") || entry.querySelector("summary");
    const rawHtml = contentEl?.innerHTML || summary || "";
    out.push(
      normalizeFromRaw(
        {
          title,
          link,
          description: rawHtml,
          content: rawHtml,
          pubDate: pub || undefined,
        },
        source
      )
    );
  });
  return out;
}

function parseFeedXml(xmlText: string, source: string): RssItem[] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML parse error");
  const root = doc.documentElement?.localName?.toLowerCase();
  if (root === "feed") return parseAtomFeed(doc, source);
  return parseRssChannel(doc, source);
}

export async function fetchFeed(feed: { source: string; url: string }) {
  try {
    const xmlText = await fetchTextViaProxies(feed.url);
    const parsed = parseFeedXml(xmlText, feed.source);
    if (parsed.length > 0) return parsed;
  } catch (e1) {
    console.warn(`[Pulse] raw XML via proxy failed: ${feed.source}`, e1);
  }

  try {
    const res = await fetchWithTimeout(rssUrl(feed.url));
    const data = (await res.json()) as Parameters<typeof parseRss2Json>[0];
    const items = parseRss2Json(data);
    if (items?.length)
      return items.map((item) =>
        normalizeFromRaw(item as Record<string, unknown>, feed.source)
      );
    console.warn(`[Pulse] rss2json no items: ${feed.source}`);
  } catch (e2) {
    console.warn(`[Pulse] rss2json failed: ${feed.source}`, e2);
  }

  return [];
}

function dedupe(items: RssItem[]) {
  const seen = new Set<string>();
  const out: RssItem[] = [];
  for (const it of items) {
    const key = it.title.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export function persistArticle(item: RssItem) {
  try {
    localStorage.setItem(STORAGE_PREFIX + item.id, JSON.stringify(item));
  } catch {
    /* ignore */
  }
}

export async function loadAllFeeds(): Promise<RssItem[]> {
  const chunks = await Promise.all(FEEDS.map((f) => fetchFeed(f)));
  let merged = dedupe(chunks.flat());
  merged.sort((a, b) => b.ts - a.ts);
  for (const it of merged.slice(0, 150)) {
    persistArticle(it);
  }
  return merged;
}
