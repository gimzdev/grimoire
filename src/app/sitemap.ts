import type { MetadataRoute } from 'next';
import { getClasses, getDungeons, getEntityQuestIndex, getGuides, getItems, getNpcLoot, getNpcs, getQuests, getRaces, getZones } from '@/lib/data';
import { getRoutes } from '@/lib/guide';
import { siteUrl } from '@/lib/site';

export const revalidate = 86400;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  const page = (path: string, priority = 0.6): MetadataRoute.Sitemap[number] => ({ url: `${base}${path}`, lastModified: now, changeFrequency: 'weekly', priority });
  const fixed = ['/', '/forever', '/talents', '/classes', '/races', '/abilities', '/items', '/quests', '/world', '/dungeons', '/guides', '/tools', '/tools/leveling', '/tools/raid', '/tools/legacy'].map((p) => page(p, p === '/' ? 1 : 0.8));
  const legal = page('/legal', 0.2);
  const classes = getClasses().flatMap((c) => [page(`/classes/${c.slug}`, 0.8), page(`/talents/${c.slug}`, 0.9)]);
  const races = getRaces().map((r) => page(`/races/${r.slug}`));
  const guides = getGuides().map((g) => page(`/guides/${g.slug}`, 0.8));
  const routes = getRoutes().map((r) => page(`/tools/leveling/${r.id}`, 0.8));
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
  return [...fixed, legal, ...classes, ...races, ...guides, ...routes, ...dungeons, ...zones, ...quests, ...items, ...npcs];
}
