import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DetailHead } from '@/components/detail-head';
import { WowIcon } from '@/components/icon';
import { ItemLink } from '@/components/links';
import { ItemOrigins } from '@/components/item-origins';
import { LootList, notableLoot } from '@/components/loot-list';
import { ItemTooltip, Money } from '@/components/tooltips';
import { Badge, Container } from '@/components/ui';
import { getClasses, getDrops, getItem, getItemMap, getItemQuestIndex, getItems, getMinorItem, getNpc, getNpcLoot, getNpcNameIndex, getQuestNameIndex, getSetMap, getVendors } from '@/lib/data';
import { statLine } from '@/lib/item-format';
import { itemSources, repRequirement } from '@/lib/item-source';
import { changeLabel, itemTypeLabel, usableBy } from '@/lib/items';
import { iconUrl, QUALITY, QUALITY_COLOR, SLOT, SLOT_FILTERS } from '@/lib/wow';
import type { Item, MinorItem } from '@/lib/types';

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const it = getItem(Number(id));
  if (!it) {
    const m = getMinorItem(Number(id));
    if (!m) return { title: 'Item not found' };
    const d = getDrops(Number(id));
    return { title: m[0], description: `${m[0]}: where it drops in World of Warcraft: Forever${d ? `, from ${d.t} sources with drop chances` : ''}, and the quests that use it.`, alternates: { canonical: `/items/${id}` } };
  }
  const stats = statLine(it, 6).join(', ');
  return {
    title: it.n,
    description: `${it.n}: item level ${it.l} ${QUALITY[it.q].toLowerCase()} ${SLOT[it.s]?.toLowerCase() ?? 'item'} in World of Warcraft: Forever${stats ? ` (${stats})` : ''}.`,
    alternates: { canonical: `/items/${it.i}` },
  };
}

/** Availability worth a badge. Ordinary items that exist in the Forever world get none. */
const AVAIL: Record<string, [string, 'new' | 'changed' | 'removed'] | undefined> = {
  n: ['New in Forever', 'new'],
  r: ['Classic raid drop, not in the launch raids', 'changed'],
  e: ['No known source in Forever', 'removed'],
};

const MINOR_CLASS: Record<number, string> = {
  0: 'Consumable',
  1: 'Container',
  2: 'Weapon',
  4: 'Armor',
  5: 'Reagent',
  6: 'Projectile',
  7: 'Trade goods',
  9: 'Recipe',
  11: 'Quiver',
  12: 'Quest item',
  13: 'Key',
  15: 'Miscellaneous',
};

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "leather hands", "two-hand staff", "trinket": what to call items like this one. */
function altLabel(it: Item) {
  const type = itemTypeLabel(it).toLowerCase();
  const slot = (SLOT[it.s] ?? '').toLowerCase();
  if (!slot || slot === type) return type || 'item';
  return it.c === 2 ? `${slot} ${type}` : `${type} ${slot}`;
}

const WEAPON_SUB: Record<number, string> = {
  0: 'One-hand axe',
  1: 'Two-hand axe',
  2: 'Bow',
  3: 'Gun',
  4: 'One-hand mace',
  5: 'Two-hand mace',
  6: 'Polearm',
  7: 'One-hand sword',
  8: 'Two-hand sword',
  10: 'Staff',
  13: 'Fist weapon',
  15: 'Dagger',
  16: 'Thrown',
  18: 'Crossbow',
  19: 'Wand',
  20: 'Fishing pole',
};
const ARMOR_SUB: Record<number, string> = { 1: 'Cloth armor', 2: 'Leather armor', 3: 'Mail armor', 4: 'Plate armor', 6: 'Shield', 7: 'Libram', 8: 'Idol', 9: 'Totem' };

/** What kind of thing a minor item is. Rings, necks and trinkets share one armor subclass, so the icon tells them apart. */
function minorKind(cls: number, sub: number, icon: string) {
  if (cls === 2) return WEAPON_SUB[sub] ?? 'Weapon';
  if (cls === 4) {
    if (ARMOR_SUB[sub]) return ARMOR_SUB[sub];
    if (/jewelry_ring/.test(icon)) return 'Ring';
    if (/necklace|amulet/.test(icon)) return 'Neck';
    if (/talisman|trinket/.test(icon)) return 'Trinket';
    if (/cape|cloak/.test(icon)) return 'Cloak';
    if (/shirt/.test(icon)) return 'Shirt';
    if (/tabard/.test(icon)) return 'Tabard';
    return 'Accessory';
  }
  return MINOR_CLASS[cls] ?? 'Item';
}

/** The boss or creature most likely to drop this, and what else it drops. */
function MoreFrom({ id }: { id: number }) {
  const top = getDrops(id)
    ?.s.filter((s) => s[0] === 'n')
    .sort((a, b) => b[2] - a[2])[0];
  if (!top) return null;
  const npc = getNpc(top[1]);
  const rows = notableLoot(getNpcLoot(top[1]), id).slice(0, 8);
  if (!npc || rows.length === 0) return null;
  return (
    <section className="frame p-5 sm:p-7">
      <h2 className="text-[1.45rem] text-vellum">
        More from{' '}
        <Link href={`/npcs/${top[1]}`} data-tip={`npc:${top[1]}`} className="transition-colors hover:text-gilt-bright">
          {npc[0]}
        </Link>
      </h2>
      <div className="-mx-3 mt-3">
        <LootList rows={rows} />
      </div>
    </section>
  );
}

function Footnote({ id }: { id: number }) {
  return (
    <p className="px-1 text-[13px] leading-relaxed text-fog">
      Drop chances are Classic rates unless marked otherwise.{' '}
      <a href={`https://www.wowhead.com/forever/item=${id}`} className="text-mist underline-offset-2 hover:text-vellum hover:underline" rel="noreferrer" target="_blank">
        See it on Wowhead
      </a>
      .
    </p>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="frame p-5">
      <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-vellum">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** A tooltip for items whose Forever stats are not on record: what the game shows before the stat lines. */
function PlainTooltip({ m }: { m: MinorItem }) {
  const [name, q, , cls, , ilvl, req, , , startQuest] = m;
  const gear = cls === 2 || cls === 4;
  return (
    <div className="wtt w-[300px] max-w-full">
      <div className="wtt-name" style={{ color: QUALITY_COLOR[q] }}>
        {name}
      </div>
      {gear && ilvl > 1 && <div className="text-tt-yellow">Item Level {ilvl}</div>}
      {startQuest ? <div>This Item Begins a Quest</div> : null}
      {cls === 12 && <div>Quest Item</div>}
      {req > 1 && <div>Requires Level {req}</div>}
      {gear && <div className="mt-1.5 text-tt-grey">Stats not yet seen in Forever</div>}
    </div>
  );
}

/** Quest items, consumables, trade goods and recipes, and gear whose Forever stats are not on record. */
function MinorItemPage({ id }: { id: number }) {
  const m = getMinorItem(id)!;
  const [name, q, icon, cls, sub, ilvl, req, buy, stack] = m;
  const kind = minorKind(cls, sub, icon);
  const meta = [kind, ilvl > 1 && (cls === 2 || cls === 4) ? `item level ${ilvl}` : null, req > 1 ? `requires level ${req}` : null, stack > 1 ? `stacks to ${stack}` : null].filter(Boolean).join(', ');
  const hasOrigins = Boolean(getDrops(id) || getVendors(id).length || getItemQuestIndex().has(id));
  return (
    <>
      <DetailHead
        crumbs={[['Items', '/items'], [kind]]}
        icon={<WowIcon icon={icon} size={72} quality={q} name={name} eager />}
        title={name}
        titleColor={QUALITY_COLOR[q]}
        meta={meta}
        wash={iconUrl(icon, 'large')}
        tint={QUALITY_COLOR[q]}
        aside={<PlainTooltip m={m} />}
      />
      <Container>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <div className="frame p-5 sm:p-7">{hasOrigins ? <ItemOrigins id={id} /> : <p className="text-mist">No source recorded for this item yet.</p>}</div>
            <MoreFrom id={id} />
          </div>
          <aside className="h-fit space-y-4">
            {buy > 0 && (
              <SideCard title="Vendor price">
                <Money copper={buy} className="text-[1.1rem] text-vellum" />
              </SideCard>
            )}
            <Footnote id={id} />
          </aside>
        </div>
      </Container>
    </>
  );
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const it = getItem(Number(id));
  if (!it && getMinorItem(Number(id))) return <MinorItemPage id={Number(id)} />;
  if (!it) notFound();
  const hasDrops = Boolean(getDrops(it.i));
  // Drops already have their own table with chances; the source list keeps quests, vendors, crafting and containers.
  const sources = itemSources(it).filter((s) => !(hasDrops && s.kind === 'Drop'));
  const questIds = getQuestNameIndex();
  const npcIds = getNpcNameIndex();
  const ch = changeLabel(it);
  const rep = repRequirement(it);
  const set = it.set ? getSetMap().get(it.set) : undefined;
  const items = getItemMap();
  const classes = getClasses().filter((c) => usableBy(it, c.slug, c.weapons));
  const slotKey = SLOT_FILTERS.find((f) => f.slots.includes(it.s))?.key;
  const avail = AVAIL[it.av ?? 'c'];
  const hasOrigins = Boolean(getDrops(it.i) || getVendors(it.i).length || getItemQuestIndex().has(it.i));

  const alts = getItems()
    .filter((x) => x.i !== it.i && x.s === it.s && x.c === it.c && x.sc === it.sc && Math.abs(x.r - it.r) <= 4 && x.q >= 2 && x.av !== 'e')
    .sort((a, b) => b.l - a.l || b.q - a.q)
    .slice(0, 12);

  const meta = [cap(altLabel(it)), `item level ${it.l}`, it.r > 1 && !it.nr ? `requires level ${it.r}` : null].filter(Boolean).join(', ');

  return (
    <>
      <DetailHead
        crumbs={[['Items', '/items'], [SLOT[it.s] ?? 'Other', `/items${slotKey ? `?slot=${slotKey}` : ''}`]]}
        icon={<WowIcon icon={it.ic} size={72} quality={it.q} name={it.n} eager />}
        title={it.n}
        titleColor={QUALITY_COLOR[it.q]}
        meta={meta}
        wash={iconUrl(it.ic, 'large')}
        tint={QUALITY_COLOR[it.q]}
        badges={
          avail || ch.kind === 'updated' || ch.kind === 'unconfirmed' ? (
            <>
              {avail && <Badge tone={avail[1]}>{avail[0]}</Badge>}
              {ch.kind === 'updated' && <Badge tone="changed">Changed from Classic</Badge>}
              {ch.kind === 'unconfirmed' && <Badge tone="neutral">Stats unconfirmed</Badge>}
            </>
          ) : undefined
        }
        aside={
          <div className="space-y-3 drop-shadow-[0_30px_50px_rgb(0_0_0/0.6)]">
            <ItemTooltip item={it} extra={{ set: itemTipSet(it) }} />
            {rep && <div className="px-1 text-[14.5px] text-tt-red">{rep}</div>}
          </div>
        }
      />

      <Container>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            {sources.length > 0 && (
              <section className="frame p-5 sm:p-7">
                <h2 className="text-[1.45rem] text-vellum">Source</h2>
                <ul className="mt-4 space-y-2.5">
                  {sources.map((s, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15.5px]">
                      <Badge tone="gilt">{s.kind}</Badge>
                      {s.kind === 'Quest' && questIds.has(s.text) ? (
                        <Link href={`/quests/${questIds.get(s.text)}`} data-tip={`quest:${questIds.get(s.text)}`} className="text-gilt-bright hover:underline hover:underline-offset-2">
                          {s.text}
                        </Link>
                      ) : (s.kind === 'Drop' || s.kind === 'Vendor') && s.npc && npcIds.has(s.npc) ? (
                        <Link href={`/npcs/${npcIds.get(s.npc)}`} data-tip={`npc:${npcIds.get(s.npc)}`} className="text-vellum underline decoration-gilt/30 underline-offset-[3px] hover:decoration-gilt">
                          {s.text}
                        </Link>
                      ) : (
                        <span className="text-vellum">{s.text}</span>
                      )}
                      {s.zone && s.zone !== s.text && (
                        <>
                          {s.zoneId && s.zoneId > 0 ? (
                            <Link href={`/world/${s.zoneId}`} className="text-mist transition-colors hover:text-vellum">
                              {s.zone}
                            </Link>
                          ) : (
                            <span className="text-mist">{s.zone}</span>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {hasOrigins && (
              <div className="frame p-5 sm:p-7">
                <ItemOrigins id={it.i} />
              </div>
            )}

            <MoreFrom id={it.i} />

            {sources.length === 0 && !hasOrigins && (
              <div className="frame p-5 text-mist sm:p-7">{it.av === 'n' ? 'Where this new item comes from is not known yet.' : 'No source recorded for this item yet.'}</div>
            )}

            {ch.kind === 'updated' && ch.lines.length > 0 && (
              <section className="frame p-5 sm:p-7">
                <h2 className="text-[1.45rem] text-vellum">Changed in Forever</h2>
                <ul className="mt-3 space-y-2 text-[15.5px] text-parch">
                  {ch.lines.map((l, i) => (
                    <li key={i} className="flex gap-3">
                      <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-gilt" />
                      {l}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {set && (
              <section className="frame p-5 sm:p-7">
                <h2 className="text-[1.45rem] text-vellum">
                  <Link href={`/sets?set=${set.id}#set-${set.id}`} className="transition-colors hover:text-gilt-bright">
                    {set.n}
                  </Link>
                </h2>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {set.pieces.map((p) => {
                    const x = items.get(p);
                    return x ? (
                      <li key={p}>
                        <ItemLink item={x} size={26} className="text-[15px]" />
                      </li>
                    ) : null;
                  })}
                </ul>
                {set.bonus && (
                  <ul className="mt-4 space-y-1.5 text-[15px]">
                    {set.bonus.map(([n, t], i) => (
                      <li key={i} className="text-tt-green">
                        <span className="text-gilt-bright">{n} pieces:</span> {t}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          <aside className="h-fit space-y-4">
            <SideCard title="Usable by">
              <div className="flex flex-wrap gap-2">
                {classes.length === 0 && <span className="text-mist">No class can equip this.</span>}
                {classes.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/classes/${c.slug}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] py-1 pl-1 pr-3 text-[14px] font-semibold ring-1 ring-inset ring-white/[0.07] transition-colors hover:bg-white/[0.08]"
                    style={{ color: c.color }}
                  >
                    <WowIcon icon={c.icon} size={22} name={c.name} rounded />
                    {c.name}
                  </Link>
                ))}
              </div>
            </SideCard>
            {it.sell ? (
              <SideCard title="Sells for">
                <Money copper={it.sell} className="text-[1.1rem] text-vellum" />
              </SideCard>
            ) : null}
            <Footnote id={it.i} />
          </aside>
        </div>

        {alts.length > 0 && (
          <section className="mt-14">
            <h2 className="text-[1.8rem] text-vellum">
              Other {altLabel(it)} options near level {it.r || it.l}
            </h2>
            <div className="frame mt-5 p-2">
              {alts.map((x) => (
                <div key={x.i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.03] [&+&]:border-t [&+&]:border-white/[0.05]">
                  <ItemLink item={x} size={32} className="text-[15px]" />
                  <div className="flex flex-wrap items-center gap-x-4 text-[14px] text-mist">
                    <span>{statLine(x, 4).join(', ')}</span>
                    <span className="num text-fog">
                      Item level {x.l}
                      {x.r > 1 && !x.nr ? `, requires ${x.r}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}

/** The set block the tooltip prints under the item. */
function itemTipSet(it: Item) {
  const set = it.set ? getSetMap().get(it.set) : undefined;
  if (!set) return undefined;
  const items = getItemMap();
  return { id: set.id, name: set.n, pieces: set.pieces.map((p) => ({ i: p, n: items.get(p)?.n ?? `Item ${p}` })), bonus: set.bonus ?? [] };
}
