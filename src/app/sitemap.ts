import type { MetadataRoute } from 'next';
import { buildHref } from '@/lib/build-pages';
import { getBuilds, getClasses, getDungeons, getEntityQuestIndex, getGuides, getItems, getMeta, getNpcLoot, getNpcs, getQuests, getRaces, getZones } from '@/lib/data';
import { bandsOf, firstBand, getRoutes, routeHref } from '@/lib/guide';
import { getNews } from '@/lib/news';
import { siteUrl } from '@/lib/site';

export const revalidate = 86400;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  // Each page is dated by what it shows: the game data's date (data/meta.json), a guide's own date
  const data = new Date(getMeta().extracted);
  const page = (path: string, priority = 0.6, lastModified: Date = data): MetadataRoute.Sitemap[number] => ({ url: `${base}${path}`, lastModified, changeFrequency: 'weekly', priority });
  const fixed = ['/', '/forever', '/talents', '/builds', '/classes', '/races', '/abilities', '/items', '/sets', '/quests', '/world', '/dungeons', '/guides', '/tools', '/tools/gear', '/tools/leveling', '/tools/raid', '/tools/legacy', '/tools/addon', '/tools/tooltips'].map((p) => page(p, p === '/' ? 1 : 0.8));
  const legal = page('/legal', 0.2);
  const classes = getClasses().flatMap((c) => [page(`/classes/${c.slug}`, 0.8), page(`/talents/${c.slug}`, 0.9)]);
  const races = getRaces().map((r) => page(`/races/${r.slug}`));
  const guides = getGuides().map((g) => page(`/guides/${g.slug}`, 0.8, new Date(g.updated)));
  const builds = getBuilds().map((b) => page(buildHref(b), 0.8));
  const news = [page('/news', 0.7, new Date(getNews()[0]?.date ?? getMeta().extracted)), ...getNews().map((n) => page(`/news/${n.date}`, 0.6, new Date(n.date)))];
  // A route is up to six pages by level: its own address is the first, the others carry their band (/20, /30…).
  const routes = getRoutes().flatMap((r) => {
    const first = firstBand(r);
    return bandsOf(r)
      .filter((b) => b.visits.length && b.k >= first)
      .map((b) => page(routeHref(r.id, b.k), b.k === first ? 0.8 : 0.6));
  });
  const dungeons = getDungeons().map((d) => page(`/dungeons/${d.slug}`));
  const zones = getZones()
    .filter((z) => z.cat === 0 || z.cat === 1 || z.cat === -1)
    .map((z) => page(`/world/${z.id}`, 0.4));
  const quests = getQuests().map((q) => page(`/quests/${q.i}`, q.ch === 'n' ? 0.6 : 0.4));
  const items = getItems().map((i) => page(`/items/${i.i}`, 0.4));
  // NPCs worth a page of their own: quest givers, quest targets and anything with loot.
  const questIndex = getEntityQuestIndex();
  const npcs = Object.keys(getNpcs())
    .filter((id) => questIndex.has(`n${id}`) || getNpcLoot(Number(id)).length > 0)
    .map((id) => page(`/npcs/${id}`, 0.3));
  return [...fixed, legal, ...classes, ...builds, ...news, ...races, ...guides, ...routes, ...dungeons, ...zones, ...quests, ...items, ...npcs];
}
