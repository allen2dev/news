/**
 * Pulse — developer RSS only; modal detail with View Transitions.
 */
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/+esm";

const RSS2JSON = "https://api.rss2json.com/v1/api.json";
const DETAIL_KEY = "pulse-article";
const STORAGE_PREFIX = "pulse-item:";

const FEEDS = [
  { source: "GitHub Blog", url: "https://github.blog/feed/" },
  { source: "Dev.to", url: "https://dev.to/feed" },
  { source: "CSS-Tricks", url: "https://css-tricks.com/feed/" },
];

const CONTENT_NS = "http://purl.org/rss/1.0/modules/content/";

const PROXY_BUILDERS = [
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) =>
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) =>
    `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(u)}`,
  (u) =>
    `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

const FETCH_TIMEOUT_MS = 14_000;

let state = {
  query: "",
  items: [],
  loading: false,
  modalOpen: false,
  lastFocus: null,
};

const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");
const empty = $("#empty");
const errorEl = $("#error");
const errorMsg = $("#error-msg");
const statusText = $("#status-text");
const statusDot = $("#status-dot");
const searchInput = $("#search");
const modalRoot = $("#modal-root");
const modalBackdrop = $("#modal-backdrop");
const detailDialog = $("#detail-dialog");
const detailSource = $("#detail-source");
const detailTime = $("#detail-time");
const detailTitle = $("#detail-title");
const detailBody = $("#detail-body");
const detailFigure = $("#detail-figure");
const detailImage = $("#detail-image");
const detailFallback = $("#detail-fallback");
const detailExternal = $("#detail-external");
const btnClose = $("#btn-close");
const btnTheme = $("#btn-theme");

function rssUrl(feedUrl) {
  return `${RSS2JSON}?rss_url=${encodeURIComponent(feedUrl)}`;
}

function parseRss2Json(data) {
  if (data.status === "ok" && Array.isArray(data.items)) return data.items;
  return null;
}

async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

async function fetchTextViaProxies(feedUrl) {
  let lastErr;
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
  throw lastErr || new Error("all CORS proxies failed");
}

function looksLikeFeed(text) {
  const head = text.slice(0, 800).toLowerCase();
  return (
    head.includes("<rss") ||
    head.includes("<feed") ||
    head.includes("<?xml")
  );
}

function textFromEl(el) {
  return el?.textContent?.trim() || "";
}

function getContentEncoded(itemEl) {
  const list = itemEl.getElementsByTagNameNS(CONTENT_NS, "encoded");
  if (list.length) return list[0].innerHTML || textFromEl(list[0]) || "";
  const any = itemEl.querySelector("*|encoded");
  if (any && any.namespaceURI?.includes("content")) return any.innerHTML || "";
  return "";
}

function parseRssChannel(doc, source) {
  const itemEls = doc.querySelectorAll("channel > item, rss channel > item");
  const out = [];
  itemEls.forEach((itemEl) => {
    const title = textFromEl(itemEl.querySelector("title")) || "Untitled";
    const linkEl = itemEl.querySelector("link");
    let link =
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
      normalizeItem(
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

function parseAtomFeed(doc, source) {
  const entries = doc.querySelectorAll("feed > entry");
  const out = [];
  entries.forEach((entry) => {
    const title = textFromEl(entry.querySelector("title")) || "Untitled";
    const linkEl =
      entry.querySelector('link[rel="alternate"]') ||
      entry.querySelector("link");
    let link =
      linkEl?.getAttribute?.("href") || textFromEl(linkEl) || "#";
    const pub =
      textFromEl(entry.querySelector("published")) ||
      textFromEl(entry.querySelector("updated"));
    const summary = entry.querySelector("summary")?.innerHTML || "";
    const contentEl =
      entry.querySelector("content") || entry.querySelector("summary");
    const rawHtml = contentEl?.innerHTML || summary || "";
    out.push(
      normalizeItem(
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

function parseFeedXml(xmlText, source) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("XML parse error");
  }
  const root = doc.documentElement?.localName?.toLowerCase();
  if (root === "feed") return parseAtomFeed(doc, source);
  return parseRssChannel(doc, source);
}

async function fetchFeed(feed) {
  try {
    const xmlText = await fetchTextViaProxies(feed.url);
    const parsed = parseFeedXml(xmlText, feed.source);
    if (parsed.length > 0) return parsed;
  } catch (e1) {
    console.warn(
      `[Pulse] raw XML via proxy failed: ${feed.source}`,
      e1?.message || e1
    );
  }

  try {
    const res = await fetchWithTimeout(rssUrl(feed.url));
    const data = await res.json();
    const items = parseRss2Json(data);
    if (items?.length)
      return items.map((item) => normalizeItem(item, feed.source));
    console.warn(
      `[Pulse] rss2json no items: ${feed.source}`,
      data?.message || ""
    );
  } catch (e2) {
    console.warn(`[Pulse] rss2json failed: ${feed.source}`, e2?.message || e2);
  }

  return [];
}

function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent?.trim() || "";
}

const IMG_RE = /<img[^>]+src=["']([^"']+)["']/i;

function firstImageFromHtml(html) {
  if (!html) return "";
  const m = html.match(IMG_RE);
  return m ? m[1].trim() : "";
}

function normalizeItem(item, source) {
  const link = item.link || item.guid || "#";
  const title = stripHtml(item.title) || "Untitled";
  const rawHtml =
    item.content ||
    item["content:encoded"] ||
    item.description ||
    "";
  const excerpt = stripHtml(rawHtml).slice(0, 280) || "";
  const thumb =
    item.thumbnail ||
    item.enclosure?.link ||
    firstImageFromHtml(rawHtml) ||
    "";
  const pub =
    item.pubDate ||
    item.isoDate ||
    item.published ||
    new Date().toISOString();
  const ts = new Date(pub).getTime();
  const id = hashId(`${source}|${link}|${title}`);
  return {
    id,
    source,
    title,
    link,
    excerpt,
    thumb,
    html: typeof rawHtml === "string" ? rawHtml : "",
    ts: Number.isFinite(ts) ? ts : Date.now(),
  };
}

function hashId(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return `a${(h >>> 0).toString(36)}`;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = it.title.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function persistArticle(item) {
  try {
    localStorage.setItem(STORAGE_PREFIX + item.id, JSON.stringify(item));
  } catch (e) {
    console.warn("[Pulse] localStorage persist failed", e);
  }
}

async function loadFeeds() {
  const chunks = await Promise.all(FEEDS.map((f) => fetchFeed(f)));
  let merged = dedupe(chunks.flat());
  merged.sort((a, b) => b.ts - a.ts);
  for (const it of merged.slice(0, 150)) {
    persistArticle(it);
  }
  return merged;
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function matchesFilter(item) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.title.toLowerCase().includes(q) ||
    item.excerpt.toLowerCase().includes(q) ||
    item.source.toLowerCase().includes(q)
  );
}

function purifyHtml(html) {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
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
  });
}

function enhanceArticleLinks(container) {
  container.querySelectorAll("a[href]").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
}

function renderCardThumb(item) {
  if (!item.thumb) return "";
  const safeSrc = escapeAttr(item.thumb);
  const alt = escapeAttr(item.title.slice(0, 120));
  return `<div class="card-thumb"><img src="${safeSrc}" alt="${alt}" loading="lazy" decoding="async" /></div>`;
}

function stashArticle(item) {
  try {
    sessionStorage.setItem(DETAIL_KEY, JSON.stringify(item));
  } catch (e) {
    console.warn("[Pulse] sessionStorage", e);
  }
}

function openArticle(item) {
  stashArticle(item);
  persistArticle(item);
  fillModal(item);
  openModal();
}

function render() {
  const filtered = state.items.filter(matchesFilter);
  grid.innerHTML = "";
  if (filtered.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  filtered.forEach((item, i) => {
    const card = document.createElement("article");
    card.className = "card" + (item.thumb ? " card--thumb" : "");
    card.style.animationDelay = `${Math.min(i * 0.04, 0.6)}s`;
    card.innerHTML = `
      ${renderCardThumb(item)}
      <div class="card-inner">
        <div class="card-meta">
          <span class="source-pill">${escapeHtml(item.source)}</span>
          <time class="time" datetime="${new Date(item.ts).toISOString()}">${formatTime(item.ts)}</time>
        </div>
        <h2 class="card-title"><button type="button" class="card-title-btn">${escapeHtml(item.title)}</button></h2>
        <p class="card-excerpt">${escapeHtml(item.excerpt || "—")}</p>
        <div class="card-footer">
          <button type="button" class="read-link">
            阅读全文
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    `;
    card.querySelector(".card-title-btn").addEventListener("click", () =>
      openArticle(item)
    );
    card.querySelector(".read-link").addEventListener("click", () =>
      openArticle(item)
    );
    grid.appendChild(card);
  });
}

function fillModal(item) {
  detailSource.textContent = item.source;
  detailTime.textContent = formatTime(item.ts);
  detailTime.setAttribute("datetime", new Date(item.ts).toISOString());
  detailTitle.textContent = item.title;
  detailExternal.href = item.link;

  const bodyHtml = item.html || "";
  const cleaned = purifyHtml(bodyHtml);
  detailBody.innerHTML = cleaned;
  enhanceArticleLinks(detailBody);

  const hasMeaningfulBody =
    detailBody.querySelector("img,figure,video,iframe") !== null ||
    stripHtml(cleaned).replace(/\s+/g, " ").trim().length > 40;
  detailFallback.hidden = hasMeaningfulBody;

  const imgInBody = detailBody.querySelector("img");
  if (item.thumb && !imgInBody) {
    detailFigure.hidden = false;
    detailImage.src = item.thumb;
    detailImage.alt = item.title.slice(0, 200);
  } else {
    detailFigure.hidden = true;
    detailImage.removeAttribute("src");
    detailImage.alt = "";
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function vt(cb) {
  if (document.startViewTransition) {
    return document.startViewTransition(cb);
  }
  cb();
  return { finished: Promise.resolve() };
}

function openModal() {
  if (state.modalOpen) return;
  state.lastFocus = document.activeElement;
  if (document.startViewTransition) {
    modalBackdrop.style.viewTransitionName = "modal-backdrop";
    detailDialog.style.viewTransitionName = "modal-dialog";
  }
  const t = vt(() => {
    modalRoot.classList.add("is-open");
    modalRoot.removeAttribute("aria-hidden");
    detailDialog.focus();
  });
  t.finished.finally(() => {
    modalBackdrop.style.viewTransitionName = "";
    detailDialog.style.viewTransitionName = "";
  });
  document.body.classList.add("modal-open");
  state.modalOpen = true;
}

function closeModal() {
  if (!state.modalOpen) return;
  if (document.startViewTransition) {
    modalBackdrop.style.viewTransitionName = "modal-backdrop";
    detailDialog.style.viewTransitionName = "modal-dialog";
  }
  const t = vt(() => {
    modalRoot.classList.remove("is-open");
    modalRoot.setAttribute("aria-hidden", "true");
  });
  t.finished.finally(() => {
    modalBackdrop.style.viewTransitionName = "";
    detailDialog.style.viewTransitionName = "";
  });
  document.body.classList.remove("modal-open");
  state.modalOpen = false;
  if (state.lastFocus && typeof state.lastFocus.focus === "function") {
    state.lastFocus.focus();
  }
}

function setLoading(on) {
  state.loading = on;
  grid.setAttribute("aria-busy", on ? "true" : "false");
  if (on) {
    errorEl.hidden = true;
    empty.hidden = true;
    grid.innerHTML = "";
  }
}

function setStatus(text, live = false) {
  statusText.textContent = text;
  statusDot.classList.toggle("is-live", live);
}

async function refresh() {
  setLoading(true);
  setStatus("正在拉取 RSS…", true);
  try {
    const items = await loadFeeds();
    state.items = items;
    setStatus(
      `已聚合 ${items.length} 条 · ${new Date().toLocaleTimeString("zh-CN")}`,
      false
    );
    render();
    if (items.length === 0) {
      empty.hidden = false;
      empty.querySelector("p").textContent = "未能获取条目，请稍后重试。";
    }
  } catch (e) {
    errorEl.hidden = false;
    errorMsg.textContent = e.message || "网络错误";
    setStatus("加载失败", false);
  } finally {
    setLoading(false);
  }
}

$("#btn-refresh").addEventListener("click", () => refresh());
$("#btn-retry").addEventListener("click", () => {
  errorEl.hidden = true;
  refresh();
});

btnClose.addEventListener("click", () => closeModal());
modalBackdrop.addEventListener("click", () => closeModal());

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.modalOpen) {
    e.preventDefault();
    closeModal();
  }
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  render();
  const filtered = state.items.filter(matchesFilter);
  empty.hidden = filtered.length > 0 || state.loading;
});

function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("pulse-theme", theme);
  } catch (e) {}
  const isLight = theme === "light";
  if (btnTheme) {
    btnTheme.setAttribute("aria-pressed", isLight ? "true" : "false");
    btnTheme.title = isLight ? "切换为暗色" : "切换为亮色";
  }
}

btnTheme.addEventListener("click", () => {
  applyTheme(getTheme() === "dark" ? "light" : "dark");
});

applyTheme(getTheme());

refresh();
