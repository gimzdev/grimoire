import { getDrops, getFactions, getItemMap, getNpc, getObject, getSetMap, getZoneMap, getZoneNames } from './data';
import type { Item } from './types';
import { PROFESSION, REP_LEVEL, SOURCE } from './wow';

export interface SourceLine {
  kind: string;
  text: string;
  zone?: string;
  zoneId?: number;
  npc?: string;
  /** The item this one is made from. */
  itemId?: number;
}

/** Where an item comes from, in plain words: "Drop: Rhahk'Zor (The Deadmines)", "Quest: Old Ironforge Incursion". */
export function itemSources(it: Item): SourceLine[] {
  const zones = getZoneNames();
  const known = getZoneMap();
  const out: SourceLine[] = [];
  const codes = it.src ?? [];
  for (const s of it.sm ?? []) {
    const zone = s.z ? zones[String(s.z)] : undefined;
    if (s.t === 1) {
      const vendor = codes.includes(5) && !codes.includes(2);
      out.push({ kind: vendor ? 'Vendor' : 'Drop', text: s.n ?? 'Unknown', zone, zoneId: s.z, npc: s.n });
    } else if (s.t === 5) out.push({ kind: 'Quest', text: s.n ?? 'Quest', zone, zoneId: s.z });
    else if (s.t === 2) out.push({ kind: 'Container', text: s.n ?? 'Object', zone, zoneId: s.z });
    else if (s.t === 6) out.push({ kind: 'Crafted', text: s.s ? (PROFESSION[s.s] ?? 'Profession') : 'Crafted' });
    else if (s.t === 3) out.push({ kind: 'Contained in', text: s.n ?? 'Item' });
    else if (s.t === 7) out.push({ kind: 'Made from', text: s.n ?? 'Item', itemId: s.id });
    else if (s.z && !s.n) out.push({ kind: codes.includes(2) ? 'Drop' : (SOURCE[codes[0]] ?? 'Source'), text: zone ?? 'Unknown zone', zone, zoneId: s.z });
  }
  if (!out.length) {
    const generic: Record<number, [string, string]> = {
      1: ['Crafted', 'A profession recipe'],
      2: ['Drop', 'World drop'],
      3: ['PvP', 'PvP reward'],
      4: ['Quest', 'Quest reward'],
      5: ['Vendor', 'Sold by a vendor'],
    };
    for (const c of codes) {
      const [kind, text] = generic[c] ?? [SOURCE[c] ?? 'Source', SOURCE[c] ?? 'Unknown'];
      out.push({ kind, text });
    }
  }
  // Only link zones that have a page.
  for (const o of out) if (o.zoneId && !known.has(o.zoneId)) o.zoneId = undefined;
  return out;
}

/** A drop chance in a few characters: 31%, 4.2%, 0.35%. */
function pctLabel(p: number) {
  if (p >= 10) return `${Math.round(p)}%`;
  if (p >= 1) return `${p.toFixed(1)}%`;
  if (p >= 0.01) return `${p.toFixed(2)}%`;
  return 'under 0.01%';
}

/** The chance to get the item from its main source, when the loot tables know it: "31%". */
export function mainSourceChance(it: Item): string | undefined {
  const s = itemSources(it)[0];
  if (!s || s.kind !== 'Drop') return undefined;
  const drops = getDrops(it.i);
  if (!drops) return undefined;
  const match = drops.s.find((d) => (d[0] === 'n' || d[0] === 'o') && (d[0] === 'n' ? getNpc(d[1])?.[0] : getObject(d[1])?.[0]) === s.npc) ?? (drops.s.length === 1 ? drops.s[0] : undefined);
  return match ? pctLabel(match[2]) : undefined;
}

export function sourceSummary(it: Item, withChance = true): string | undefined {
  const s = itemSources(it)[0];
  if (!s) return it.av === 'e' ? 'Source not confirmed for Forever' : undefined;
  const where = s.zone && s.zone !== s.text ? ` (${s.zone})` : '';
  const base = s.kind === s.text ? s.kind : `${s.kind}: ${s.text}${where}`;
  const chance = withChance ? mainSourceChance(it) : undefined;
  return chance ? `${base}, ${chance}` : base;
}

export function repRequirement(it: Item): string | undefined {
  if (!it.rep) return undefined;
  const f = getFactions()[String(it.rep[0])];
  return `Requires ${f?.n ?? 'a faction'} – ${REP_LEVEL[it.rep[1]] ?? 'Friendly'}`;
}

export function itemTipExtra(it: Item) {
  const set = it.set ? getSetMap().get(it.set) : undefined;
  const items = getItemMap();
  return {
    set: set
      ? { id: set.id, name: set.n, pieces: set.pieces.map((p) => ({ i: p, n: items.get(p)?.n ?? `Item ${p}` })), bonus: set.bonus ?? [] }
      : undefined,
    source: sourceSummary(it),
  };
}
