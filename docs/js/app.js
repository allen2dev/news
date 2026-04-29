/**
 * Pulse — static news aggregator for GitHub Pages
 * Fetches public RSS via rss2json API (browser CORS friendly).
 */

const RSS2JSON = "https://api.rss2json.com/v1/api.json";

const FEEDS = {
  tech: [
    { source: "Hacker News", url: "https://news.ycombinator.com/rss" },
    { source: "TechCrunch", url: "https://techcrunch.com/feed/" },
    { source: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  ],
  world: [
    { source: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { source: "Reuters World", url: "https://feeds.reuters.com/Reuters/worldNews" },
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

function rssUrl(feedUrl) {
  return `${RSS2JSON}?rss_url=${encodeURIComponent(feedUrl)}`;
}

async function fetchFeed({ source, url }) {
  const res = await fetch(rssUrl(url), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== "ok" || !Array.isArray(data.items)) {
    throw new Error(data.message || "Invalid feed response");
  }
  return data.items.map((item) => normalizeItem(item, source));
}

function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent?.trim() || "";
}

function normalizeItem(item, source) {
  const link = item.link || item.guid || "#";
  const title = stripHtml(item.title) || "Untitled";
  const excerpt =
    stripHtml(item.description || item.content || "").slice(0, 280) || "";
  const pub =
    item.pubDate ||
    item.isoDate ||
    item.published ||
    new Date().toISOString();
  const ts = new Date(pub).getTime();
  return {
    id: `${source}:${link}:${title}`.slice(0, 200),
    source,
    title,
    link,
    excerpt,
    ts: Number.isFinite(ts) ? ts : Date.now(),
  };
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
  const keys =
    category === "all"
      ? ["tech", "world", "dev"]
      : [category];
  const tasks = [];
  for (const k of keys) {
    for (const f of FEEDS[k] || []) {
      tasks.push(
        fetchFeed(f).catch(() => {
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
    card.className = "card";
    card.style.animationDelay = `${Math.min(i * 0.04, 0.6)}s`;
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-meta">
          <span class="source-pill">${escapeHtml(item.source)}</span>
          <time class="time" datetime="${new Date(item.ts).toISOString()}">${formatTime(item.ts)}</time>
        </div>
        <h2 class="card-title"><a href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h2>
        <p class="card-excerpt">${escapeHtml(item.excerpt || "—")}</p>
        <div class="card-footer">
          <a class="read-link" href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer">
            阅读原文
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M7 7h10v10"/></svg>
          </a>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
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

function setLoading(on) {
  state.loading = on;
  grid.setAttribute("aria-busy", on ? "true" : "false");
  skeleton.hidden = !on;
  if (on) {
    skeleton.innerHTML = Array.from({ length: 8 })
      .map(() => '<div class="sk"></div>')
      .join("");
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
    setStatus(`已聚合 ${items.length} 条 · ${new Date().toLocaleTimeString("zh-CN")}`, false);
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
    refresh();
  });
});

$("#btn-refresh").addEventListener("click", () => refresh());
$("#btn-retry").addEventListener("click", () => {
  errorEl.hidden = true;
  refresh();
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  render();
  const filtered = state.items.filter(matchesFilter);
  empty.hidden = filtered.length > 0 || state.loading;
});

refresh();
