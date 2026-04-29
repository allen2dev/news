/**
 * Curated RSS channels — major publishers with stable, standards-compliant feeds.
 * URLs are official feed endpoints (BBC, Guardian, NPR, etc.).
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
  { source: "CSS-Tricks", url: "https://css-tricks.com/feed/" },
] as const;

const TECH = [
  { source: "Hacker News", url: "https://news.ycombinator.com/rss" },
  { source: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
] as const;

const WORLD = [
  { source: "BBC News — World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { source: "The Guardian — World", url: "https://www.theguardian.com/world/rss" },
  { source: "NPR News", url: "https://feeds.npr.org/1001/rss.xml" },
] as const;

const BUSINESS = [
  { source: "BBC News — Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { source: "The Guardian — Business", url: "https://www.theguardian.com/uk/business/rss" },
  { source: "Reuters — Business", url: "https://feeds.reuters.com/reuters/businessNews" },
] as const;

const SCIENCE = [
  {
    source: "BBC News — Science",
    url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  },
  { source: "Nature — News", url: "https://www.nature.com/nature.rss" },
  {
    source: "Scientific American",
    url: "https://rss.sciam.com/ScientificAmerican-Global",
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
