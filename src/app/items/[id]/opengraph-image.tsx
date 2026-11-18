import { ImageResponse } from 'next/og';
import { equipLines } from '@/components/tooltips';
import { getItem, getMinorItem } from '@/lib/data';
import type { Item } from '@/lib/types';
import { itemTypeLabel } from '@/lib/items';
import { clip, INK, OG_SIZE, OgFrame, ogFonts, ogIcon } from '@/lib/og';
import { CLASS_NAMES, DAMAGE_TYPE, QUALITY, QUALITY_COLOR, SLOT, STAT_LABEL, WHITE_STATS, classesFromMask } from '@/lib/wow';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'The item’s tooltip, as the game shows it';

const GREEN = '#1eff00';
const YELLOW = '#ffd100';

/** The item drawn as its tooltip (the same lines as components/tooltips.tsx), with its icon. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // a minor item (consumable, reagent, quest item...) is drawn from its short record
  const m = getItem(Number(id)) ? null : getMinorItem(Number(id));
  const item: Item | undefined = getItem(Number(id)) ?? (m ? { i: Number(id), n: m[0], q: m[1], ic: m[2], c: m[3], sc: m[4], l: m[5], r: m[6], s: 0 } : undefined);
  if (!item) return new Response('Not found', { status: 404 });
  const color = QUALITY_COLOR[item.q] ?? '#fff';
  const icon = await ogIcon(item.ic);
  const showType = item.c === 2 || (item.c === 4 && [1, 2, 3, 4, 6, 7, 8, 9].includes(item.sc) && ![2, 11, 12, 16].includes(item.s));
  const whites = item.wl ?? Object.entries(item.st ?? {}).filter(([k]) => WHITE_STATS.has(k)).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${STAT_LABEL[k]}`);
  const greens = item.fx?.length ? item.fx : equipLines(item.st);
  const classes = classesFromMask(item.cls);
  const lines: { text: string; color?: string; split?: string }[] = [];
  if (item.b) lines.push({ text: item.b });
  if (item.s > 0 && (SLOT[item.s] || showType)) lines.push({ text: SLOT[item.s] ?? '', split: showType ? itemTypeLabel(item) : undefined });
  if (item.w) lines.push({ text: `${Math.round(item.w[0])} - ${Math.round(item.w[1])} ${item.w[4] ? `${DAMAGE_TYPE[item.w[4]]} ` : ''}Damage`, split: item.w[2] ? `Speed ${Number(item.w[2]).toFixed(2)}` : undefined });
  if (item.ar) lines.push({ text: `${item.ar} Armor` });
  for (const w of whites) lines.push({ text: w });
  if (classes.length) lines.push({ text: `Classes: ${classes.map((c) => CLASS_NAMES[c]).join(', ')}` });
  if (item.r > 1 && !item.nr) lines.push({ text: `Requires Level ${item.r}` });
  for (const g of greens) lines.push({ text: clip(g, 90), color: /^(Equip|Use|Chance on hit):/.test(g) ? GREEN : undefined });
  if (item.f) lines.push({ text: `“${clip(item.f, 80)}”`, color: YELLOW });
  const shown = lines.slice(0, 11);
  return new ImageResponse(
    (
      <OgFrame color={color} foot="WoW Forever items">
        <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 360, marginRight: 48 }}>
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} width={128} height={128} alt="" style={{ borderRadius: 18, border: `3px solid ${color}` }} />
            ) : (
              <div style={{ display: 'flex', width: 128, height: 128, borderRadius: 18, border: `3px solid ${color}`, background: '#14171c' }} />
            )}
            <span style={{ fontSize: 26, fontWeight: 500, color, marginTop: 26 }}>{QUALITY[item.q] ?? ''} item</span>
            <span style={{ fontSize: 24, color: INK.mist, marginTop: 8 }}>Item level {item.l}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '22px 28px', borderRadius: 16, background: 'rgba(8,10,20,0.92)', border: '2px solid #5a5f6b', fontSize: 25, lineHeight: 1.32 }}>
            <span style={{ fontSize: 34, fontWeight: 600, color, marginBottom: 4 }}>{clip(item.n, 40)}</span>
            {shown.map((l, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: l.color ?? INK.vellum }}>
                <span>{l.text}</span>
                {l.split && <span>{l.split}</span>}
              </div>
            ))}
            {lines.length > shown.length && <span style={{ color: INK.mist }}>…</span>}
          </div>
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  );
}
