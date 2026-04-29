import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  Loader2,
  Moon,
  RefreshCw,
  Rss,
  Search,
  Sun,
} from "lucide-react";
import { ArticleDialog } from "@/components/ArticleDialog";
import {
  loadAllFeeds,
  persistArticle,
} from "@/lib/rss";
import type { RssItem } from "@/lib/types";
import { runViewTransition } from "@/lib/viewTransition";
import { cn } from "@/lib/utils";

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") return true;
    const saved = localStorage.getItem("pulse-theme");
    if (saved === "light") return false;
    if (saved === "dark") return true;
    return !window.matchMedia("(prefers-color-scheme: light)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("pulse-theme", dark ? "dark" : "light");
  }, [dark]);

  return [dark, setDark] as const;
}

export default function App() {
  const [dark, setDark] = useTheme();
  const [items, setItems] = useState<RssItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<RssItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus("正在拉取 RSS…");
    try {
      const list = await loadAllFeeds();
      setItems(list);
      setStatus(
        `已聚合 ${list.length} 条 · ${new Date().toLocaleTimeString("zh-CN")}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = items.filter((it) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      it.title.toLowerCase().includes(q) ||
      it.excerpt.toLowerCase().includes(q) ||
      it.source.toLowerCase().includes(q)
    );
  });

  const openArticle = useCallback((item: RssItem) => {
    persistArticle(item);
    void runViewTransition(() => {
      flushSync(() => {
        setSelected(item);
        setDialogOpen(true);
      });
    });
  }, []);

  const onDialogOpenChange = useCallback((open: boolean) => {
    if (open) return;
    void runViewTransition(() => {
      flushSync(() => {
        setDialogOpen(false);
        setSelected(null);
      });
    });
  }, []);

  return (
    <div className="relative min-h-dvh">
      {/* ambient */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-1/4 top-0 h-[50vh] w-[70vw] rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--accent)/0.15)_0%,transparent_65%)] blur-3xl dark:bg-[radial-gradient(ellipse_at_center,hsl(187_92%_42%/0.12)_0%,transparent_65%)]" />
        <div className="absolute -right-1/4 top-1/3 h-[45vh] w-[60vw] rounded-full bg-[radial-gradient(ellipse_at_center,hsl(263_70%_58%/0.1)_0%,transparent_60%)] blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-4 pb-6 pt-10 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--accent))] to-violet-500 shadow-lg shadow-[hsl(var(--accent)/0.25)] dark:from-cyan-400 dark:to-violet-500">
            <Rss className="h-7 w-7 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Pulse
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              开发者资讯 · GitHub · Dev.to · CSS
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDark(!dark)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={dark ? "切换到亮色" : "切换到暗色"}
          >
            {dark ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
          <label className="flex min-w-[min(100%,280px)] items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm backdrop-blur">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标题或来源…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-4 w-4", loading && "animate-spin")}
            />
            刷新
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-xs text-muted-foreground">{status}</p>
      </div>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-8 text-center dark:border-red-400/20">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-4 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
            >
              重试
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">加载资讯…</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <p className="py-16 text-center text-muted-foreground">
            暂无条目，请稍后重试或调整搜索。
          </p>
        )}

        {!loading && filtered.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item, i) => (
              <li key={item.id} style={{ animationDelay: `${i * 40}ms` }}>
                <article
                  className={cn(
                    "group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm backdrop-blur-md transition",
                    "duration-300 hover:border-[hsl(var(--ring)/0.35)] hover:shadow-lg",
                    "motion-safe:animate-[fadeSlide_0.5s_ease-out_both]"
                  )}
                >
                  {item.thumb ? (
                    <div className="relative aspect-[16/9] max-h-40 overflow-hidden bg-muted">
                      <img
                        src={item.thumb}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-3 flex items-center justify-between gap-2 text-xs">
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono font-medium uppercase tracking-wide text-muted-foreground">
                        {item.source}
                      </span>
                      <time
                        className="font-mono text-muted-foreground"
                        dateTime={new Date(item.ts).toISOString()}
                      >
                        {relTime(item.ts)}
                      </time>
                    </div>
                    <h2 className="mb-2 line-clamp-2 text-base font-semibold leading-snug tracking-tight">
                      <button
                        type="button"
                        onClick={() => openArticle(item)}
                        className="text-left text-foreground transition hover:text-[hsl(var(--accent))]"
                      >
                        {item.title}
                      </button>
                    </h2>
                    <p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {item.excerpt || "—"}
                    </p>
                    <button
                      type="button"
                      onClick={() => openArticle(item)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--accent))] transition group-hover:gap-2"
                    >
                      阅读全文
                      <span aria-hidden>→</span>
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="relative z-10 border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        数据来源为公开 RSS · 仅供个人阅读
      </footer>

      <ArticleDialog
        item={selected}
        open={dialogOpen && !!selected}
        onOpenChange={onDialogOpenChange}
      />
    </div>
  );
}

function relTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return new Date(ts).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}
