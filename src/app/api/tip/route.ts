import { NextResponse, type NextRequest } from 'next/server';
import { fishingPlace } from '@/lib/areas';
import { getDrops, getItem, getMinorItem, getNpc, getQuest, getSpellIndex } from '@/lib/data';
import { itemTipExtra } from '@/lib/item-source';
import { categoryName, CHANGE_LABEL, entityRef, itemRef, RANK_LABEL, SIDE_LABEL } from '@/lib/quests';
import { itemHtml, npcHtml, questHtml, spellHtml } from '@/lib/tip-html';
import type { Item } from '@/lib/types';

const MINOR_CLASS: Record<number, string> = { 0: 'Consumable', 5: 'Reagent', 7: 'Trade goods', 9: 'Recipe', 12: 'Quest item', 13: 'Key' };

/**
 * Tooltip data for the hover layer: ?k=item:12640, spell:10060, quest:7 or npc:448. With f=html the tooltip comes as
 * ready HTML instead ({ html }), for /tooltips.js on other sites: any site may ask, so every answer allows any origin.
 */
export function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get('k') ?? '';
  const [type, raw] = k.split(':');
  const id = Number(raw);
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'bad key' }, { status: 400, headers: cors });
  const headers = { ...cors, 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' };
  const answer = (data: { type: string; [key: string]: unknown }, html: () => string) =>
    NextResponse.json(req.nextUrl.searchParams.get('f') === 'html' ? { type: data.type, html: html() } : data, { headers });
  if (type === 'item') {
    const item = getItem(id);
    if (item) {
      const extra = itemTipExtra(item);
      return answer({ type: 'item', item, extra }, () => itemHtml(item, extra));
    }
    const m = getMinorItem(id);
    if (!m) return NextResponse.json({ error: 'not found' }, { status: 404, headers: cors });
    const pseudo: Item = { i: id, n: m[0], q: m[1], ic: m[2], c: m[3], sc: m[4], l: m[5], r: m[6], s: 0 };
    const d = getDrops(id);
    const best = d?.s[0];
    // What is fished is filed by water, not by a creature or an object: its number is an area's (src/lib/areas.ts). Read
    // as an object's, it named Small Thorium Vein as where Raw Rockscale Cod drops.
    const from = !best ? null : best[0] === 'f' ? fishingPlace(best[1]) : entityRef(best[0] === 'p' || best[0] === 's' ? 'n' : best[0], best[1]);
    const source = [MINOR_CLASS[m[3]], from && best ? `${best[0] === 'f' ? 'Fished in' : 'Drops from'} ${from.name} (${best[2] >= 1 ? best[2].toFixed(best[2] >= 10 ? 0 : 1) : best[2].toFixed(2)}%)${d && d.t > 1 ? ` and ${d.t - 1} more` : ''}` : null].filter(Boolean).join('. ');
    return answer({ type: 'item', item: pseudo, extra: { source } }, () => itemHtml(pseudo, { source }));
  }
  if (type === 'spell') {
    const spell = getSpellIndex().get(id);
    if (!spell) return NextResponse.json({ error: 'not found' }, { status: 404, headers: cors });
    return answer({ type: 'spell', spell }, () => spellHtml(spell));
  }
  if (type === 'quest') {
    const q = getQuest(id);
    if (!q) return NextResponse.json({ error: 'not found' }, { status: 404, headers: cors });
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
    return answer({ type: 'quest', quest }, () => questHtml(quest));
  }
  if (type === 'npc') {
    const n = getNpc(id);
    if (!n) return NextResponse.json({ error: 'not found' }, { status: 404, headers: cors });
    const npc = { n: n[0], title: n[1] || undefined, level: n[2] <= 0 ? undefined : n[2] === n[3] ? String(n[2]) : `${n[2]}-${n[3]}`, rank: RANK_LABEL[n[4]], zone: n[6] ? categoryName(n[6]) : undefined, react: n[5] };
    return answer({ type: 'npc', npc }, () => npcHtml(npc));
  }
  return NextResponse.json({ error: 'unknown type' }, { status: 400, headers: cors });
}
