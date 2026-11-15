import { NextResponse, type NextRequest } from 'next/server';
import { getAbilities, getClass, getDungeons, getMinorItem, getNpc, getObject, getQuests, getQuestsByZone, getZoneMap } from '@/lib/data';
import { PRESETS, scoreFor } from '@/lib/gear';
import { bestInSlot } from '@/lib/gear-server';
import { bandsFor } from '@/lib/route';
import type { Quest } from '@/lib/types';
import { CLASS_IDS } from '@/lib/wow';
import { ZONE_NOTES, zoneLevels } from '@/lib/world';

type Giver = { kind: 'n' | 'o' | 'i'; id: number; name: string } | null;

function giverOf(q: Quest): Giver {
  const st = q.st?.find((s) => s[0] === 'n') ?? q.st?.[0];
  if (!st) return null;
  const [kind, id] = st;
  const name = kind === 'n' ? getNpc(id)?.[0] : kind === 'o' ? getObject(id)?.[0] : getMinorItem(id)?.[0];
  return name ? { kind, id, name } : null;
}

const lite = (q: Quest) => ({ i: q.i, n: q.n, l: q.l, r: q.r, ch: q.ch, group: q.ty === 1 || Boolean(q.gp), giver: giverOf(q) });

/** One quest per name: faction copies and unconfirmed duplicates collapse into the best-known version. */
function dedupe(list: Quest[]) {
  const best = new Map<string, Quest>();
  const rank = (q: Quest) => (q.ch === 'x' ? 0 : 1) + (q.st?.length ? 2 : 0);
  for (const q of list) {
    const cur = best.get(q.n);
    if (!cur || rank(q) > rank(cur)) best.set(q.n, q);
  }
  return [...best.values()];
}

/** Everything the leveling tool shows for one level: /api/route?lvl=34&faction=alliance&class=mage&spec=frost */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lvl = Math.min(60, Math.max(1, Number(p.get('lvl')) || 1));
  const faction = p.get('faction') === 'horde' ? 'horde' : 'alliance';
  const cls = getClass(p.get('class') ?? '') ? (p.get('class') as string) : undefined;
  const zoneMap = getZoneMap();

  const bands = bandsFor(lvl);
  const zoneIds = [...new Set(bands.flatMap((b) => b[faction]))];
  const zones = zoneIds
    .map((id) => zoneMap.get(id))
    .filter((z) => z !== undefined)
    .map((z) => {
      const lv = zoneLevels(z);
      return { id: z.id, name: z.n, lo: lv?.lo ?? 0, hi: lv?.hi ?? 0, approx: Boolean(lv?.approx), territory: z.t, isNew: z.st === 'new', note: ZONE_NOTES[z.id] ?? null };
    });

  // Quests you can take right now in the suggested zones, a little below to a little above your level.
  const other = faction === 'alliance' ? 2 : 1;
  const bit = cls ? 1 << (CLASS_IDS[cls] - 1) : 0;
  const lo = Math.max(1, lvl - 2);
  const hi = Math.min(62, lvl + 3);
  const fits = (q: Quest) =>
    q.s !== other &&
    q.r <= lvl &&
    q.l >= lo &&
    q.l <= hi &&
    !q.rep &&
    !q.ev &&
    !q.sk &&
    q.c2 !== 9 &&
    q.ty !== 62 &&
    q.ty !== 41 &&
    (!q.rc || (bit > 0 && (q.rc & bit) !== 0));
  const byZone = getQuestsByZone();
  const quests = zones
    .map((z) => {
      const list = dedupe((byZone.get(z.id) ?? []).filter(fits)).sort((a, b) => a.l - b.l || Number(Boolean(b.st?.length)) - Number(Boolean(a.st?.length)) || a.n.localeCompare(b.n));
      return { zone: z.id, name: z.name, total: list.length, list: list.slice(0, 7).map(lite) };
    })
    .filter((g) => g.total > 0);

  // Class quests: training calls, totems, forms and weapons that only your class gets.
  const classQuests = bit
    ? dedupe(getQuests().filter((q) => q.rc && (q.rc & bit) !== 0 && q.s !== other && q.r <= lvl + 2 && q.l >= lvl - 3 && q.l <= lvl + 5 && !q.sk))
        .sort((a, b) => a.r - b.r || a.l - b.l || a.n.localeCompare(b.n))
        .slice(0, 6)
        .map(lite)
    : [];

  const dungeons = getDungeons()
    .filter((d) => d.kind === 'dungeon' && d.levels && d.levels[0] <= lvl + 3 && d.levels[1] >= lvl - 1)
    .sort((a, b) => a.levels![0] - b.levels![0])
    .map((d) => ({ slug: d.slug, name: d.name, levels: d.levels, isNew: d.isNew, status: d.status, location: d.location }));

  let trainer: { level: number; spells: { id: number; name: string; icon: string; rank?: string }[] }[] = [];
  let gear: { slot: string; item: { i: number; n: string; q: number; ic?: string; r: number; l: number; score: number } }[] = [];
  if (cls) {
    const abilities = getAbilities(cls);
    const levels = [...new Set(abilities.map((a) => a.level))].filter((l) => l >= lvl).sort((a, b) => a - b).slice(0, 2);
    trainer = levels.map((l) => ({ level: l, spells: abilities.filter((a) => a.level === l).map((a) => ({ id: a.id, name: a.name, icon: a.icon, rank: a.rank })) }));
    const preset = PRESETS[cls]?.find((x) => x.key === p.get('spec')) ?? PRESETS[cls]?.[0];
    if (preset) {
      const set = bestInSlot(cls, preset.weights, lvl, 'forever', faction);
      gear = Object.entries(set)
        .filter(([, it]) => it)
        .map(([slot, it]) => ({ slot, item: { i: it!.i, n: it!.n, q: it!.q, ic: it!.ic, r: it!.r, l: it!.l, score: scoreFor(it!, preset.weights) } }));
    }
  }

  return NextResponse.json(
    {
      level: lvl,
      faction,
      notes: bands.map((b) => ({ lo: b.lo, hi: b.hi, note: b.note })),
      zones,
      quests,
      questRange: [lo, hi],
      classQuests,
      dungeons,
      talentPoints: Math.max(0, lvl - 9),
      talentPointsTalented: Math.max(0, Math.min(51, lvl - 4)),
      trainer,
      gear,
    },
    { headers: { 'Cache-Control': 'public, max-age=600' } },
  );
}
