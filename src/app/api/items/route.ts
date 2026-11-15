import { NextResponse, type NextRequest } from 'next/server';
import { getClass, getItemMap, getItems } from '@/lib/data';
import { scoreFor } from '@/lib/gear';
import { gearPool, parseWeights, setsFor, slotOptions, type Avail, type Side } from '@/lib/gear-server';
import { filterItems, sortItems } from '@/lib/items';

/**
 * Item lookups for the planners.
 *   ?ids=1,2,3                                   the items themselves (for shared links)
 *   ?doll=head&class=priest&max=60&w=&src=&q=     candidates for a paper-doll slot, best first
 *   ?slot=head&class=priest&q=                    plain filtered search (item database filters)
 */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const ids = p.get('ids');
  if (ids) {
    const map = getItemMap();
    const items = ids
      .split(',')
      .slice(0, 40)
      .map((x) => map.get(Number(x)))
      .filter((x) => x !== undefined);
    return NextResponse.json({ items, sets: setsFor(items) });
  }
  const cls = p.get('class') ?? undefined;
  const info = cls ? getClass(cls) : undefined;
  const w = parseWeights(p.get('w'));
  const src = (['forever', 'launch', 'all'].includes(p.get('src') ?? '') ? p.get('src') : 'forever') as Avail;
  const q = p.get('q') ?? undefined;
  const doll = p.get('doll');
  if (doll && info) {
    const max = Math.min(60, Math.max(1, Number(p.get('max')) || 60));
    const side: Side = p.get('side') === 'horde' ? 'horde' : 'alliance';
    const opts = slotOptions(gearPool(info.slug, max, src, side), doll, info.slug, w, q, 80);
    const items = opts.map((x) => ({ ...x.it, score: x.s }));
    return NextResponse.json({ items, sets: setsFor(items) });
  }
  let list = filterItems(getItems(), { q, slot: p.get('slot') ?? undefined, max: Number(p.get('max')) || undefined, cls: info?.slug, weapons: info?.weapons });
  if (src === 'forever') list = list.filter((it) => it.av === 'n' || it.av === 'c');
  else if (src === 'launch') list = list.filter((it) => it.av !== 'e');
  const sorted = (q ? sortItems(list, 'relevance', q) : list.map((it) => ({ it, s: scoreFor(it, w) })).sort((a, b) => b.s - a.s || b.it.l - a.it.l).map((x) => x.it)).slice(0, 60);
  return NextResponse.json({ items: sorted.map((it) => ({ ...it, score: scoreFor(it, w) })) });
}
