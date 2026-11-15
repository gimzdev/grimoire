// The hotfix pages as an RSS feed, for feed readers and Discord's feed bots.
import { getNews, newsDay } from '@/lib/news';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-static';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

export function GET() {
  const base = siteUrl();
  const news = getNews();
  const items = news
    .map(
      (n) => `    <item>
      <title>${esc(`WoW Forever hotfixes, ${newsDay(n.date)}`)}</title>
      <link>${base}/news/${n.date}</link>
      <guid isPermaLink="true">${base}/news/${n.date}</guid>
      <pubDate>${new Date(`${n.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(n.description)}</description>
    </item>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Grimoire: WoW Forever hotfixes</title>
    <link>${base}/news</link>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Every World of Warcraft: Forever hotfix in short, with the classes and builds it touches.</description>
    <language>en</language>
${news[0] ? `    <lastBuildDate>${new Date(`${news[0].date}T12:00:00Z`).toUTCString()}</lastBuildDate>\n` : ''}${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
}
