/**
 * Pulse — static news aggregator for GitHub Pages
 * Fetches public RSS via rss2json API (browser CORS friendly).
 */
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/+esm";

const RSS2JSON = "https://api.rss2json.com/v1/api.json";
const DETAIL_KEY = "pulse-article";
const SKELETON_COUNT = 8;

const FEEDS = {
  tech: [
    { source: "Hacker News", url: "https://news.ycombinator.com/rss" },
    { source: "TechCrunch", url: "https://techcrunch.com/feed/" },
    { source: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  ],
  world: [
    { source: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    /* Reuters direct RSS often fails in rss2json; Guardian World is a stable alternative */
    { source: "The Guardian World", url: "https://www.theguardian.com/world/rss" },
    { source: "NPR News", url: "https://feeds.npr.org/1001/rss.xml" },
  ],
  dev: [
    { source: "GitHub Blog", url: "https://github.blog/feed/" },
    { source: "Dev.to", url: "https://dev.to/feed" },
    { source: "CSS-Tricks", url: "https://css-tricks.com/feed/" },
  ],
};

let state = {
  category: "all",
  query: "",
  items: [],
  loading: false,
};

const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");
const skeleton = $("#skeleton");
const empty = $("#empty");
const errorEl = $("#error");
const errorMsg = $("#error-msg");
const statusText = $("#status-text");
const statusDot = $("#status-dot");
const searchInput = $("#search");
const mainList = $("#main-list");
const siteHeader = document.querySelector(".site-header");
const siteTabs = document.querySelector(".tabs");
const siteStatus = document.querySelector(".status-bar");
const siteFooter = $("#site-footer");
const detailPanel = $("#detail-panel");
const detailSource = $("#detail-source");
const detailTime = $("#detail-time");
const detailTitle = $("#detail-title");
const detailBody = $("#detail-body");
const detailFigure = $("#detail-figure");
const detailImage = $("#detail-image");
const detailFallback = $("#detail-fallback");
const detailExternal = $("#detail-external");
const btnBack = $("#btn-back");
const btnTheme = $("#btn-theme");

function rssUrl(feedUrl) {
  return `${RSS2JSON}?rss_url=${encodeURIComponent(feedUrl)}`;
}

function parseRss2Json(data) {
  if (data.status === "ok" && Array.isArray(data.items)) return data.items;
  return null;
}

async function fetchFeed({ source, url }) {
  const res = await fetch(rssUrl(url), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const items = parseRss2Json(data);
  if (!items) {
    const msg = data?.message || "Invalid feed response";
    throw new Error(msg);
  }
  return items.map((item) => normalizeItem(item, source));
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
  const rawHtml = item.content || item.description || "";
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
    html: rawHtml,
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

async function loadFeeds(category) {
  const keys = category === "all" ? ["tech", "world", "dev"] : [category];
  const tasks = [];
  for (const k of keys) {
    for (const f of FEEDS[k] || []) {
      tasks.push(
        fetchFeed(f).catch((err) => {
          console.warn(`[Pulse] feed skip: ${f.source}`, err?.message || err);
          return [];
        })
      );
    }
  }
  const chunks = await Promise.all(tasks);
  let merged = chunks.flat();
  merged = dedupe(merged);
  merged.sort((a, b) => b.ts - a.ts);
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
    const detailHref = `#/article/${item.id}`;
    card.innerHTML = `
      ${renderCardThumb(item)}
      <div class="card-inner">
        <div class="card-meta">
          <span class="source-pill">${escapeHtml(item.source)}</span>
          <time class="time" datetime="${new Date(item.ts).toISOString()}">${formatTime(item.ts)}</time>
        </div>
        <h2 class="card-title"><a href="${detailHref}">${escapeHtml(item.title)}</a></h2>
        <p class="card-excerpt">${escapeHtml(item.excerpt || "—")}</p>
        <div class="card-footer">
          <a class="read-link" href="${detailHref}">
            阅读全文
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    `;
    const linkRead = card.querySelector(".read-link");
    const titleLink = card.querySelector(".card-title a");
    [linkRead, titleLink].forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        stashArticle(item);
        window.location.hash = `#/article/${item.id}`;
      });
    });
    grid.appendChild(card);
  });
}

function stashArticle(item) {
  try {
    sessionStorage.setItem(
      DETAIL_KEY,
      JSON.stringify({
        id: item.id,
        source: item.source,
        title: item.title,
        link: item.link,
        excerpt: item.excerpt,
        thumb: item.thumb,
        html: item.html,
        ts: item.ts,
      })
    );
  } catch (e) {
    console.warn("[Pulse] sessionStorage full or disabled", e);
  }
}

function loadStashedArticle(id) {
  try {
    const raw = sessionStorage.getItem(DETAIL_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && o.id === id) return o;
  } catch (e) {}
  return null;
}

function findArticleById(id) {
  return state.items.find((x) => x.id === id) || null;
}

function showDetailView(item) {
  if (!item) return;
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

  detailPanel.hidden = false;
  detailPanel.setAttribute("aria-hidden", "false");
  mainList.hidden = true;
  if (siteHeader) siteHeader.hidden = true;
  if (siteTabs) siteTabs.hidden = true;
  if (siteStatus) siteStatus.hidden = true;
  if (siteFooter) siteFooter.hidden = true;
  document.title = `${item.title} · Pulse`;
  window.scrollTo(0, 0);
}

function hideDetailView() {
  detailPanel.hidden = true;
  detailPanel.setAttribute("aria-hidden", "true");
  mainList.hidden = false;
  if (siteHeader) siteHeader.hidden = false;
  if (siteTabs) siteTabs.hidden = false;
  if (siteStatus) siteStatus.hidden = false;
  if (siteFooter) siteFooter.hidden = false;
  document.title = "Pulse · 新闻聚合";
}

function syncRoute() {
  const h = window.location.hash || "";
  const m = /^#\/article\/([^/?#]+)/.exec(h);
  if (!m) {
    hideDetailView();
    return;
  }
  const id = decodeURIComponent(m[1]);
  let item = findArticleById(id) || loadStashedArticle(id);
  if (item) {
    showDetailView(item);
  } else {
    hideDetailView();
    setStatus("无法展示该条（请从列表重新进入）", false);
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

function fillSkeletonPlates() {
  skeleton.replaceChildren();
  for (let i = 0; i < SKELETON_COUNT; i++) {
    const plate = document.createElement("div");
    plate.className = "sk";
    const img = document.createElement("div");
    img.className = "sk-img";
    const bar1 = document.createElement("div");
    bar1.className = "sk-line sk-line-lg";
    const bar2 = document.createElement("div");
    bar2.className = "sk-line";
    const bar3 = document.createElement("div");
    bar3.className = "sk-line sk-line-short";
    plate.appendChild(img);
    plate.appendChild(bar1);
    plate.appendChild(bar2);
    plate.appendChild(bar3);
    skeleton.appendChild(plate);
  }
}

function setLoading(on) {
  state.loading = on;
  grid.setAttribute("aria-busy", on ? "true" : "false");
  skeleton.hidden = !on;
  skeleton.classList.toggle("is-loading", on);
  if (on) {
    fillSkeletonPlates();
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
    const items = await loadFeeds(state.category);
    state.items = items;
    setStatus(
      `已聚合 ${items.length} 条 · ${new Date().toLocaleTimeString("zh-CN")}`,
      false
    );
    render();
    syncRoute();
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

/* Tabs */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const cat = btn.dataset.category;
    state.category = cat;
    document.querySelectorAll(".tab").forEach((b) => {
      const active = b === btn;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (window.location.hash.startsWith("#/article")) {
      window.location.hash = "";
    }
    refresh();
  });
});

$("#btn-refresh").addEventListener("click", () => refresh());
$("#btn-retry").addEventListener("click", () => {
  errorEl.hidden = true;
  refresh();
});

btnBack.addEventListener("click", () => {
  window.location.hash = "";
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  render();
  const filtered = state.items.filter(matchesFilter);
  empty.hidden = filtered.length > 0 || state.loading;
});

window.addEventListener("hashchange", syncRoute);

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
