// Tooltips as plain HTML, for /tooltips.js on other sites (it asks /api/tip?f=html). The same lines as the site's own
// tooltips (components/tooltips.tsx), with the styles inline so they need nothing from the page they appear on.
import { equipLines } from '@/components/tooltips';
import { itemTypeLabel } from './items';
import type { Item } from './types';
import { CLASS_NAMES, DAMAGE_TYPE, QUALITY_COLOR, SLOT, STAT_LABEL, WHITE_STATS, classesFromMask, formatMoney } from './wow';

const YELLOW = '#ffd100';
const GREEN = '#1eff00';
const GREY = '#9d9d9d';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const line = (text: string, color?: string, extra = '') => `<div style="${color ? `color:${color};` : ''}${extra}">${text}</div>`;
const name = (text: string, color: string) => `<div style="color:${color};font-weight:600;font-size:16px;line-height:1.25">${esc(text)}</div>`;
const split = (a: string, b: string) => `<div style="display:flex;justify-content:space-between;gap:24px"><span>${a}</span><span>${b}</span></div>`;
/** Game text: |cffRRGGBB...|r color escapes and line breaks, everything else escaped. */
const game = (s: string) => esc(s).replace(/\|c[fF]{2}([0-9a-fA-F]{6})(.*?)\|r/g, '<span style="color:#$1">$2</span>').replace(/\n/g, '<br>');
const money = (c: number) => {
  const { g, s, c: cu } = formatMoney(c);
  return [g && `${g}g`, s && `${s}s`, cu && `${cu}c`].filter(Boolean).join(' ') || '0c';
};

export function itemHtml(item: Item, extra?: { set?: { name: string; pieces: unknown[]; bonus: [number, string][] }; source?: string }) {
  const color = QUALITY_COLOR[item.q] ?? '#fff';
  const out: string[] = [name(item.n, color)];
  if (item.lb) out.push(line(esc(item.lb), GREEN));
  out.push(line(`Item Level ${item.l}`, YELLOW));
  if (item.b) out.push(line(esc(item.b)));
  const unique = item.u ?? (item.uq ? (item.uq > 1 ? `Unique (${item.uq})` : 'Unique') : null);
  if (unique) out.push(line(esc(unique)));
  if (item.bq) out.push(line('This Item Begins a Quest'));
  const showType = item.c === 2 || (item.c === 4 && [1, 2, 3, 4, 6, 7, 8, 9].includes(item.sc) && ![2, 11, 12, 16].includes(item.s));
  if (item.s > 0 && (SLOT[item.s] || showType)) out.push(showType ? split(esc(SLOT[item.s] ?? ''), esc(itemTypeLabel(item))) : line(esc(SLOT[item.s])));
  if (item.w) {
    const dmg = `${Math.round(item.w[0])} - ${Math.round(item.w[1])} ${item.w[4] ? `${DAMAGE_TYPE[item.w[4]]} ` : ''}Damage`;
    out.push(item.w[2] ? split(dmg, `Speed ${Number(item.w[2]).toFixed(2)}`) : line(dmg));
    if (item.w[3]) out.push(line(`(${Number(item.w[3]).toFixed(1)} damage per second)`));
  }
  if (item.ar) out.push(line(`${item.ar} Armor`));
  const whites = item.wl ?? Object.entries(item.st ?? {}).filter(([k]) => WHITE_STATS.has(k)).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${STAT_LABEL[k]}`);
  for (const w of whites) out.push(line(esc(w)));
  if (item.du) out.push(line(`Durability ${item.du} / ${item.du}`));
  if (item.dur) out.push(line(`Duration: ${esc(item.dur)}`));
  const classes = classesFromMask(item.cls);
  if (classes.length) out.push(line(`Classes: ${esc(classes.map((c) => CLASS_NAMES[c]).join(', '))}`));
  if (item.races) out.push(line(`Races: ${esc(item.races)}`));
  if (item.r > 1 && !item.nr) out.push(line(`Requires Level ${item.r}`));
  for (const r of item.rq ?? []) out.push(line(esc(r)));
  for (const g of item.fx?.length ? item.fx : equipLines(item.st)) out.push(line(esc(g), /^(Equip|Use|Chance on hit):/.test(g) ? GREEN : undefined));
  if (extra?.set) {
    out.push(line(`${esc(extra.set.name)} (0/${extra.set.pieces.length})`, YELLOW, 'margin-top:8px'));
    for (const [n, t] of extra.set.bonus) out.push(line(`(${n}) Set: ${esc(t)}`, GREY));
  }
  if (item.f) out.push(line(`“${esc(item.f)}”`, YELLOW, 'margin-top:6px'));
  if (item.sell) out.push(line(`Sell Price: ${money(item.sell)}`, undefined, 'margin-top:6px'));
  if (extra?.source) out.push(line(esc(extra.source), GREY, 'margin-top:6px;font-size:13px'));
  return out.join('');
}

export function spellHtml(spell: { name: string; rank?: string; desc?: string }) {
  return [split(`<span style="font-weight:600;font-size:16px">${esc(spell.name)}</span>`, spell.rank ? `<span style="color:${GREY};font-size:13px">${esc(spell.rank)}</span>` : ''), spell.desc ? line(game(spell.desc), YELLOW, 'margin-top:4px') : ''].join('');
}

export function questHtml(q: { n: string; l: number; r: number; side: string; zone: string; o?: string; rq: string[]; rewards: ({ n: string; q: number; c: number } | null)[]; choose: boolean; xp?: number; m?: number; change?: string }) {
  const out = [name(q.n, YELLOW), line(`Level ${q.l}${q.r ? `, requires ${q.r}` : ''}, ${esc(q.side)}, ${esc(q.zone)}`, GREY, 'font-size:13px')];
  if (q.change) out.push(line(esc(q.change), GREEN, 'font-size:13px'));
  if (q.o) out.push(line(esc(q.o), undefined, 'margin-top:8px'));
  if (q.rq.length) out.push(`<div style="margin-top:8px">${q.rq.map((r) => line(`- ${esc(r)}`, GREY)).join('')}</div>`);
  const rewards = q.rewards.filter((r): r is { n: string; q: number; c: number } => Boolean(r));
  if (rewards.length) out.push(`<div style="margin-top:8px">${line(q.choose ? 'Choose a reward:' : 'Rewards:', YELLOW)}${rewards.map((r) => line(`${esc(r.n)}${r.c > 1 ? ` x${r.c}` : ''}`, QUALITY_COLOR[r.q] ?? '#fff')).join('')}</div>`);
  const tail = [q.xp ? `${q.xp.toLocaleString('en-US')} experience` : '', q.m ? money(q.m) : ''].filter(Boolean).join(', ');
  if (tail) out.push(line(tail, GREY, 'margin-top:8px;font-size:13px'));
  return out.join('');
}

export function npcHtml(npc: { n: string; title?: string; level?: string; rank?: string; zone?: string; react: string }) {
  const color = npc.react === 'hh' ? '#ff4a3d' : npc.react === 'ff' ? '#3ce23c' : npc.react === 'nn' ? YELLOW : '#f0e7d4';
  const out = [name(npc.n, color)];
  if (npc.title) out.push(line(`&lt;${esc(npc.title)}&gt;`));
  if (npc.level || npc.rank) out.push(line(`${npc.level ? `Level ${esc(npc.level)}` : esc(npc.rank)}${npc.level && npc.rank ? ` (${esc(npc.rank)})` : ''}`));
  if (npc.zone) out.push(line(esc(npc.zone), GREY));
  return out.join('');
}
