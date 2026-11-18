import { SCHOOLS, runPlaces } from '@/components/encounters';
import type { MapBoss } from '@/components/dungeon-map';
import { getItem, getMinorItem } from './data';
import type { DungeonEncounters, Encounter } from './types';
import { QUALITY_COLOR } from './wow';

/** What a boss's portrait on the map tells on hover: its level and place, its first abilities and its best loot. */
function mapBoss(b: Encounter, place: number | undefined, total: number): MapBoss {
  const lv = b.npcs[0]?.lv;
  const flags = new Set(b.f ?? []);
  const what = flags.has('rare') ? 'Rare spawn' : flags.has('event') ? 'World event' : flags.has('quest') ? 'Quest summon' : flags.has('summon') ? 'Optional summon' : flags.has('optional') ? 'Optional' : place ? `Boss ${place} of ${total}` : null;
  const level = lv && lv[0] > 0 ? (lv[0] === lv[1] ? `Level ${lv[0]}` : `Level ${lv[0]} to ${lv[1]}`) : null;
  type Seen = { id: number; pct: number; n: string; q: number; ic?: string };
  const loot: Seen[] = [];
  for (const [id, pct] of b.loot) {
    const it = getItem(id);
    const m = it ? undefined : getMinorItem(id);
    const row = it ? { id, pct, n: it.n, q: it.q, ic: it.ic } : m ? { id, pct, n: m[0], q: m[1], ic: m[2] } : undefined;
    if (row && row.q >= 2) loot.push(row);
  }
  loot.sort((a, c) => c.q - a.q || c.pct - a.pct);
  return {
    n: b.n,
    sub: [level, what].filter(Boolean).join(' · '),
    abilities: b.abilities.filter((a) => a.t !== 'passive').slice(0, 5).map((a) => ({ n: a.n, c: (SCHOOLS[a.s] ?? SCHOOLS[0]).c })),
    loot: loot.slice(0, 4).map((l) => ({ id: l.id, n: l.n, c: QUALITY_COLOR[l.q], ic: l.ic })),
    more: Math.max(0, loot.length - 4),
  };
}

/** Every boss of a dungeon or raid as its map's hover cards tell it, by key. */
export function mapBosses(enc: DungeonEncounters): Record<string, MapBoss> {
  const places = runPlaces(enc);
  return Object.fromEntries(enc.wings.flatMap((w) => w.bosses).map((b) => [b.key, mapBoss(b, places.get(b.key), enc.bosses)]));
}
