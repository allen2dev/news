/**
 * RSS channels — mixed domestic / HK / regional sources for better reach from mainland China,
 * plus a few international feeds where domestic equivalents lack stable RSS.
 */
export type ChannelId = "all" | "dev" | "tech" | "world" | "business" | "science";

export const CHANNEL_ORDER: ChannelId[] = [
  "all",
  "dev",
  "tech",
  "world",
  "business",
  "science",
];

const DEV = [
  { source: "GitHub Blog", url: "https://github.blog/feed/" },
  { source: "Dev.to", url: "https://dev.to/feed" },
  { source: "阮一峰的网络日志", url: "https://www.ruanyifeng.com/blog/atom.xml" },
] as const;

const TECH = [
  { source: "Solidot", url: "https://www.solidot.org/index.rss" },
  { source: "IT之家", url: "https://www.ithome.com/rss/" },
  { source: "cnBeta", url: "https://www.cnbeta.com/backend.php" },
] as const;

const WORLD = [
  { source: "中新网", url: "https://www.chinanews.com.cn/rss/scroll-news.xml" },
  { source: "南华早报 SCMP", url: "https://www.scmp.com/rss/2/feed" },
  { source: "The Guardian — World", url: "https://www.theguardian.com/world/rss" },
] as const;

const BUSINESS = [
  { source: "36氪", url: "https://36kr.com/feed" },
  { source: "第一财经", url: "https://www.yicai.com/rss.xml" },
  { source: "新华网 — Business", url: "http://www.xinhuanet.com/english/rss/business.xml" },
] as const;

const SCIENCE = [
  { source: "Nature — News", url: "https://www.nature.com/nature.rss" },
  { source: "中科院之声", url: "http://www.cas.cn/xw/kxyw/rss.xml" },
  {
    source: "BBC — Science & Environment",
    url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  },
] as const;

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  all: "全部",
  dev: "开发者",
  tech: "科技",
  world: "国际",
  business: "商业",
  science: "科学",
};

const BY_ID: Record<Exclude<ChannelId, "all">, readonly { source: string; url: string }[]> =
  {
    dev: DEV,
    tech: TECH,
    world: WORLD,
    business: BUSINESS,
    science: SCIENCE,
  };

export function getFeedsForChannel(id: ChannelId): { source: string; url: string }[] {
  if (id === "all") {
    const seen = new Set<string>();
    const out: { source: string; url: string }[] = [];
    for (const key of CHANNEL_ORDER) {
      if (key === "all") continue;
      for (const f of BY_ID[key]) {
        if (!seen.has(f.url)) {
          seen.add(f.url);
          out.push({ source: f.source, url: f.url });
        }
      }
    }
    return out;
  }
  return [...BY_ID[id]];
}

export function isChannelId(s: string): s is ChannelId {
  return (
    s === "all" ||
    s === "dev" ||
    s === "tech" ||
    s === "world" ||
    s === "business" ||
    s === "science"
  );
}
