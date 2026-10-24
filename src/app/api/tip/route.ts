import { NextResponse, type NextRequest } from 'next/server';
import { getDrops, getItem, getMinorItem, getNpc, getQuest, getSpellIndex } from '@/lib/data';
import { itemTipExtra } from '@/lib/item-source';
import { categoryName, CHANGE_LABEL, entityRef, itemRef, RANK_LABEL, SIDE_LABEL } from '@/lib/quests';
import type { Item } from '@/lib/types';

const MINOR_CLASS: Record<number, string> = { 0: 'Consumable', 5: 'Reagent', 7: 'Trade goods', 9: 'Recipe', 12: 'Quest item', 13: 'Key' };

/** Tooltip data for the hover layer: ?k=item:12640, spell:10060, quest:7 or npc:448. */
export function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get('k') ?? '';
  const [type, raw] = k.split(':');
  const id = Number(raw);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'bad key' }, { status: 400 });
  const headers = { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' };
  if (type === 'item') {
    const item = getItem(id);
    if (item) return NextResponse.json({ type: 'item', item, extra: itemTipExtra(item) }, { headers });
    const m = getMinorItem(id);
    if (!m) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const pseudo: Item = { i: id, n: m[0], q: m[1], ic: m[2], c: m[3], sc: m[4], l: m[5], r: m[6], s: 0 };
    const d = getDrops(id);
    const best = d?.s[0];
    const from = best ? entityRef(best[0] === 'p' || best[0] === 's' ? 'n' : best[0] === 'f' ? 'o' : best[0], best[1]) : null;
    const source = [MINOR_CLASS[m[3]], from && best ? `Drops from ${from.name} (${best[2] >= 1 ? best[2].toFixed(best[2] >= 10 ? 0 : 1) : best[2].toFixed(2)}%)${d && d.t > 1 ? ` and ${d.t - 1} more` : ''}` : null].filter(Boolean).join('. ');
    return NextResponse.json({ type: 'item', item: pseudo, extra: { source } }, { headers });
  }
  if (type === 'spell') {
    const spell = getSpellIndex().get(id);
    if (!spell) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ type: 'spell', spell }, { headers });
  }
  if (type === 'quest') {
    const q = getQuest(id);
    if (!q) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const rq = (q.rq ?? []).map(([kind, rid, text, count]) => {
      const name = text ?? (rid ? (kind === 'i' ? itemRef(rid)?.n : kind === 'n' || kind === 'o' ? entityRef(kind, rid)?.name : undefined) : undefined) ?? '';
      const verb = kind === 'n' && !text ? ' slain' : '';
      return `${name}${verb}${count > 1 ? ` x ${count}` : ''}`;
    });
    const pairs = q.ic?.length ? q.ic : q.ir ?? [];
    const rewards = pairs
      .map(([rid, c]) => {
        const it = itemRef(rid);
        return it ? { n: it.n, q: it.q, ic: it.ic, c } : null;
      })
      .filter(Boolean);
    const quest = { n: q.n, l: q.l, r: q.r, side: SIDE_LABEL[q.s] ?? 'Both factions', zone: categoryName(q.z), o: q.o, rq, rewards, choose: Boolean(q.ic?.length), xp: q.xp, m: q.m, change: CHANGE_LABEL[q.ch] ?? undefined };
    return NextResponse.json({ type: 'quest', quest }, { headers });
  }
  if (type === 'npc') {
    const n = getNpc(id);
    if (!n) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const npc = { n: n[0], title: n[1] || undefined, level: n[2] <= 0 ? undefined : n[2] === n[3] ? String(n[2]) : `${n[2]}-${n[3]}`, rank: RANK_LABEL[n[4]], zone: n[6] ? categoryName(n[6]) : undefined, react: n[5] };
    return NextResponse.json({ type: 'npc', npc }, { headers });
  }
  return NextResponse.json({ error: 'unknown type' }, { status: 400 });
}
