import { NextResponse, type NextRequest } from 'next/server';
import { getClass } from '@/lib/data';
import { scoreFor } from '@/lib/gear';
import { bestInSlot, parseWeights, setsFor, type Avail, type Side } from '@/lib/gear-server';

/** Best item per paper-doll slot: /api/gear?class=mage&w=<json weights>&max=60&src=forever|launch|all */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const cls = p.get('class') ?? '';
  if (!getClass(cls)) return NextResponse.json({ error: 'Unknown class' }, { status: 400 });
  const w = parseWeights(p.get('w'));
  const max = Math.min(60, Math.max(1, Number(p.get('max')) || 60));
  const src = (['forever', 'launch', 'all'].includes(p.get('src') ?? '') ? p.get('src') : 'forever') as Avail;
  const side: Side = p.get('side') === 'horde' ? 'horde' : 'alliance';
  const slots = bestInSlot(cls, w, max, src, side);
  const withScore = Object.fromEntries(Object.entries(slots).map(([k, it]) => [k, it ? { ...it, score: scoreFor(it, w) } : null]));
  return NextResponse.json({ slots: withScore, sets: setsFor(Object.values(slots)) }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
