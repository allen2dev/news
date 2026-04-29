import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { RssItem } from "@/lib/types";
import { sanitizeArticleHtml } from "@/lib/purify";
import { cn } from "@/lib/utils";

function formatTime(ts: number) {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return new Date(ts).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  item: RssItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ArticleDialog({ item, open, onOpenChange }: Props) {
  if (!item) return null;

  const descId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);

  const cleaned = sanitizeArticleHtml(item.html);
  const textLen = cleaned.replace(/<[^>]+>/g, "").trim().length;
  const hasBody = textLen > 40 || cleaned.includes("<img");

  useEffect(() => {
    if (!open || !bodyRef.current) return;
    bodyRef.current.querySelectorAll("a[href]").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
  }, [open, cleaned]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(100%-1.5rem,48rem)] max-h-[min(88vh,52rem)] -translate-x-1/2 -translate-y-1/2",
            "overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
          aria-describedby={descId}
        >
          <div className="flex max-h-[min(88vh,52rem)] flex-col">
            <header className="shrink-0 border-b border-border px-5 pb-4 pt-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono font-medium uppercase tracking-wide text-muted-foreground">
                    {item.source}
                  </span>
                  <time
                    className="font-mono text-muted-foreground"
                    dateTime={new Date(item.ts).toISOString()}
                  >
                    {formatTime(item.ts)}
                  </time>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="关闭"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Title className="text-balance pr-8 text-xl font-semibold leading-snug tracking-tight">
                {item.title}
              </Dialog.Title>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4">
              {item.thumb && !cleaned.includes("<img") && (
                <img
                  src={item.thumb}
                  alt=""
                  className="mb-5 w-full max-h-56 rounded-xl border border-border object-cover"
                />
              )}
              {/* eslint-disable-next-line react/no-danger -- DOMPurify */}
              <div
                ref={bodyRef}
                className={cn(
                  "article-body prose prose-base max-w-none dark:prose-invert",
                  "prose-headings:scroll-mt-20 prose-headings:font-semibold",
                  "prose-p:leading-relaxed prose-li:leading-relaxed",
                  "prose-a:text-[hsl(var(--accent))] prose-a:underline prose-a:underline-offset-2 prose-a:break-words",
                  "prose-img:rounded-lg",
                  "[&_.highlight]:my-4 [&_.highlight]:overflow-x-auto [&_.highlight]:rounded-xl [&_.highlight]:border [&_.highlight]:border-border [&_.highlight]:bg-muted/40 [&_.highlight]:p-1",
                  "[&_.js-code-highlight]:my-4 [&_.js-code-highlight]:overflow-x-auto [&_.js-code-highlight]:rounded-xl [&_.js-code-highlight]:border [&_.js-code-highlight]:border-border [&_.js-code-highlight]:bg-muted/40",
                  "prose-pre:my-4 prose-pre:max-h-[min(50vh,28rem)] prose-pre:overflow-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-border prose-pre:bg-muted/80 prose-pre:p-4 prose-pre:text-[13px] prose-pre:leading-relaxed",
                  "prose-code:before:content-none prose-code:after:content-none",
                  "prose-pre:prose-code:bg-transparent prose-pre:prose-code:p-0 prose-pre:prose-code:text-inherit",
                  "prose-code:rounded-md prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.9em]",
                  "prose-table:block prose-table:max-w-full prose-table:overflow-x-auto prose-table:text-sm",
                  "prose-th:border prose-td:border prose-table:border-border prose-th:px-3 prose-td:px-3 prose-th:py-2 prose-td:py-2",
                  "prose-blockquote:border-l-[hsl(var(--accent))]"
                )}
                dangerouslySetInnerHTML={{ __html: cleaned }}
              />
              {!hasBody && (
                <p id={descId} className="mt-4 text-sm text-muted-foreground">
                  暂无正文摘要，请点击下方在原文阅读。
                </p>
              )}
              {hasBody && (
                <p id={descId} className="sr-only">
                  正文摘自 RSS 摘要，完整内容请访问原文。
                </p>
              )}
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
              >
                <ExternalLink className="h-4 w-4" />
                在浏览器中打开原文
              </a>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
