import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache, type ReactNode } from 'react';
import { BossIndex, BossSection, runPlaces, TrashDrops } from '@/components/encounters';
import { Badge, BUTTON, ButtonLink, Container, Panel, SectionTitle } from '@/components/ui';
import { Vista } from '@/components/vista';
import { CountTile, DungeonCards, EnemyGrid, ItemGroup, LevelTile, NextGrid, ServicesBlock, ZoneNav } from '@/components/zone-parts';
import { ZoneQuests } from '@/components/zone-quests';
import { getEncounters, getZones } from '@/lib/data';
import { levelTitle } from '@/lib/quest-bands';
import { TERRITORY_COLOR } from '@/lib/world';
import { TERRITORY } from '@/lib/wow';
import { changeLine, hasServices, KIND_LABEL, nextCards, overview, zoneBlurb, zoneGuides, zoneQuestRows, zoneReputation } from '@/lib/zone';

export function generateStaticParams() {
  return getZones().map((z) => ({ id: String(z.id) }));
}

const getOverview = cache((id: number) => overview(id));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const o = getOverview(Number(id));
  if (!o) return {};
  const { zone: z, levels: lv } = o;
  // Entries that share a name get their kind in the title, so the tab and the search result say which is which.
  const title = o.twin ? `${z.n} (${KIND_LABEL[o.kind].toLowerCase()})` : z.n;
  const enc = o.primary ? undefined : getEncounters(`zone-${z.id}`);
  const has = [enc && 'its bosses in order with their abilities and loot', o.quests.length && 'quests', o.enemies.length && 'named enemies', o.items.total && 'the items found there', hasServices(o.services) && 'trainers and vendors'].filter(Boolean) as string[];
  const list = has.length > 1 ? `${has.slice(0, -1).join(', ')} and ${has[has.length - 1]}` : has[0];
  return {
    title,
    description: `${z.n}${o.kind === 'dungeon' || o.kind === 'raid' || o.kind === 'battleground' ? `, a ${o.kind}` : ''} in World of Warcraft: Forever${lv ? `, ${levelTitle(lv.lo, lv.hi).toLowerCase()}` : ''}${list ? `: ${list}.` : '.'}`,
    alternates: { canonical: `/world/${z.id}` },
  };
}

type Key = 'bosses' | 'trash' | 'services' | 'dungeons' | 'quests' | 'enemies' | 'items';

const join = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? ''));

export default async function ZonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = getOverview(Number(id));
  if (!o) notFound();
  const { zone: z, kind, primary, related, quests, enemies, items, services, levels } = o;

  const fresh = quests.filter((q) => q.ch === 'n').length;
  const rows = zoneQuestRows(quests);
  const sides = rows.some((q) => q.s === 1) && rows.some((q) => q.s === 2);
  const reputation = zoneReputation(quests);
  const guides = zoneGuides(z, [...(primary ? [primary] : []), ...related]);
  const next = nextCards(z, kind, primary);
  const showServices = hasServices(services);
  const place = kind === 'zone' || kind === 'city';
  // A Classic raid without a page of its own (Molten Core, Naxxramas) shows its bosses here.
  const enc = primary ? undefined : getEncounters(`zone-${z.id}`);
  const bosses = enc ? enc.wings.flatMap((w) => w.bosses) : [];
  const places = enc ? runPlaces(enc) : new Map<string, number>();

  /* Which sections this zone has, in the order that suits it. Nothing empty is drawn. */
  const order: Key[] = kind === 'city' ? ['services', 'dungeons', 'quests', 'enemies', 'items'] : kind === 'dungeon' || kind === 'raid' ? ['bosses', 'trash', 'enemies', 'quests', 'items', 'services', 'dungeons'] : ['dungeons', 'quests', 'enemies', 'items', 'services'];
  const has: Record<Key, boolean> = { bosses: bosses.length > 0, trash: Boolean(enc?.trash.length), services: showServices, dungeons: related.length > 0, quests: quests.length > 0, enemies: enemies.length > 0, items: items.total > 0 };
  const sections = order.filter((k) => has[k]);
  const dungeonKinds = new Set(related.map((d) => d.kind));
  const dungeonsTitle = dungeonKinds.size > 1 ? 'Dungeons and raids here' : dungeonKinds.has('raid') ? 'Raids here' : dungeonKinds.has('battleground') ? 'Battlegrounds here' : 'Dungeons here';
  const nav: Record<Key, { label: string; count?: number }> = {
    bosses: { label: 'Bosses', count: enc?.bosses },
    trash: { label: 'Trash drops', count: enc?.trash.length },
    services: { label: 'Trainers and vendors' },
    dungeons: { label: dungeonKinds.size > 1 ? 'Dungeons and raids' : dungeonsTitle.replace(' here', '') },
    quests: { label: 'Quests', count: quests.length },
    enemies: { label: 'Enemies', count: enemies.length },
    items: { label: 'Items', count: items.total },
  };

  /* Facts */
  const size = primary?.size || z.np;
  const facts: [string, ReactNode][] = [];
  if (levels) facts.push(['Levels', `${levels.lo === levels.hi ? levels.lo : `${levels.lo} to ${levels.hi}`}${levels.approx ? ', estimated' : ''}`]);
  facts.push([
    'Territory',
    <span key="t" className={z.t === 0 ? 'text-[#a9c8f5]' : z.t === 1 ? 'text-[#f5a196]' : ''}>
      {TERRITORY[z.t] ?? 'Unknown'}
    </span>,
  ]);
  if (o.region) facts.push([place ? 'Region' : 'Where', o.region]);
  if (size > 0) facts.push(['Players', kind === 'battleground' ? `${size}v${size}` : `${size} players`]);
  if (z.req > 0) facts.push(['Required level', String(z.req)]);

  const JUMP: Record<Key, [string, string]> = { bosses: ['Bosses', '#bosses'], trash: ['Trash drops', '#trash'], quests: ['Quests', '#quests'], services: ['Services', '#services'], enemies: ['Enemies', '#enemies'], items: ['Items', '#items'], dungeons: ['Dungeons', '#dungeons'] };
  const first = kind === 'city' && sections.includes('services') ? 'services' : sections.includes('bosses') ? 'bosses' : sections.includes('quests') ? 'quests' : sections[0];
  const action: [string, string] | null = primary ? [kind === 'raid' ? 'Raid page' : kind === 'battleground' ? 'Battleground' : 'Dungeon page', `/dungeons/${primary.slug}`] : first ? JUMP[first] : null;

  const counts: { n: number | string; label: string; sub?: string; href?: string }[] = [];
  if (enc?.bosses) counts.push({ n: enc.bosses, label: enc.bosses === 1 ? 'Boss' : 'Bosses', href: '#bosses' });
  if (quests.length) counts.push({ n: quests.length, label: quests.length === 1 ? 'Quest' : 'Quests', sub: fresh ? (fresh === quests.length ? 'All new' : `${fresh} new`) : undefined, href: '#quests' });
  if (enemies.length) counts.push({ n: enemies.length, label: enemies.length === 1 ? 'Named enemy' : 'Named enemies', href: '#enemies' });
  if (related.length) counts.push({ n: related.length, label: related.length === 1 ? 'Dungeon here' : 'Dungeons here', href: '#dungeons' });
  if (items.total) counts.push({ n: items.total, label: items.total === 1 ? 'Item recorded' : 'Items recorded', href: '#items' });
  if (services.trainerCount) counts.push({ n: services.trainerCount, label: services.trainerCount === 1 ? 'Trainer' : 'Trainers', href: '#services' });
  if (services.vendorCount) counts.push({ n: services.vendorCount, label: services.vendorCount === 1 ? 'Vendor' : 'Vendors', href: '#services' });
  const tiles = counts.slice(0, 5);
  // One lone tile would stretch across the whole row and say little, so it is left out.
  const cells = levels || tiles.length > 1 ? tiles.length + (levels ? 2 : 0) : 0;

  const navItems = [...sections.map((k) => ({ id: k as string, ...nav[k] })), ...(next.length ? [{ id: 'next', label: 'Where next' }] : [])];
  // The tile shows the usual leveling range; the zone record can list a wider one (Dun Morogh is 1 to 56 there).
  const note = levels?.typical && (z.lo !== levels.lo || z.hi !== levels.hi) ? `Usual range. The zone record lists levels ${z.lo} to ${z.hi}.` : undefined;

  return (
    <>
      <Vista
        art={o.art}
        kicker={
          <span className="flex flex-wrap items-center gap-2">
            {KIND_LABEL[kind]}
            {o.region ? `, ${o.region}` : ''}
            {z.st === 'new' && <Badge tone="new">New in Forever</Badge>}
            {z.st === 'updated' && <Badge tone="changed">Changed</Badge>}
            {z.t === 0 && <Badge tone="alliance">Alliance</Badge>}
            {z.t === 1 && <Badge tone="horde">Horde</Badge>}
            {((place && z.t === 2) || z.t === 3 || z.t === 4) && <Badge tone="neutral">{TERRITORY[z.t]}</Badge>}
          </span>
        }
        title={z.n}
        aside={
          <Panel className="w-full p-5 lg:w-[340px]" gilt>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-[15px] lg:grid-cols-1">
              {facts.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-fog">{label}</dt>
                  <dd className="text-vellum">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex gap-2">
              {action && (
                <ButtonLink href={action[1]} className="min-w-0 flex-1 whitespace-nowrap px-4">
                  {action[0]}
                </ButtonLink>
              )}
              <ButtonLink href="/world" variant={action ? 'ghost' : 'primary'} className={`whitespace-nowrap px-5 ${action ? 'shrink-0' : 'flex-1'}`}>
                All zones
              </ButtonLink>
            </div>
          </Panel>
        }
      >
        {zoneBlurb(o)}
      </Vista>

      <Container>
        <div className="space-y-5">
          {cells > 0 && (
            // Tiles wrap and grow, so a short last row fills the width instead of leaving a gap.
            <ul className="flex flex-wrap gap-3" aria-label="Facts">
              {levels && (
                <li className="min-w-0 flex-[2_1_15rem]">
                  <LevelTile lo={levels.lo} hi={levels.hi} color={TERRITORY_COLOR[z.t] ?? '#888'} isNew={z.st === 'new'} approx={levels.approx} note={note} />
                </li>
              )}
              {tiles.map((t) => (
                <li key={t.label} className="min-w-0 flex-[1_1_7.75rem]">
                  <CountTile {...t} />
                </li>
              ))}
            </ul>
          )}

          {z.lines && z.lines.length > 0 && (
            <Panel gilt className="p-5">
              <Badge tone="changed">Changed in Forever</Badge>
              <ul className="mt-3 space-y-1 text-[16.5px] text-vellum">
                {z.lines.map((l) => (
                  <li key={l} className="flex items-baseline gap-2.5">
                    <span aria-hidden className="mt-[0.5em] size-1.5 shrink-0 rotate-45 bg-gilt-deep" />
                    {changeLine(l)}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {primary && (
            <Panel gilt className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 p-5 sm:p-6">
              <div className="min-w-0 max-w-2xl">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="gilt">{KIND_LABEL[primary.kind]}</Badge>
                  {primary.levels && <Badge tone="neutral">{levelTitle(primary.levels[0], primary.levels[1])}</Badge>}
                  <Badge tone="neutral">{primary.kind === 'battleground' ? `${primary.size}v${primary.size}` : `${primary.size} players`}</Badge>
                  {primary.isNew && <Badge tone="new">New in Forever</Badge>}
                  <Badge tone="neutral">{primary.status}</Badge>
                </div>
                <h2 className="mt-3 text-[1.55rem] leading-tight text-vellum">{primary.name} has its own page</h2>
                <p className="mt-1.5 text-[16px] leading-relaxed text-mist">
                  {primary.kind === 'battleground' ? 'The battleground page has the levels, quests and rewards that are on record.' : `The ${primary.kind} page has the bosses, quests and loot that are on record.`}
                </p>
              </div>
              <Link href={`/dungeons/${primary.slug}`} className={`${BUTTON.base} ${BUTTON.primary}`}>
                Open the {primary.kind === 'battleground' ? 'battleground' : primary.kind} page
              </Link>
            </Panel>
          )}
        </div>

        {navItems.length >= 3 && <ZoneNav items={navItems} />}

        <div className={`space-y-16 ${navItems.length >= 3 ? '' : 'mt-12'}`}>
          {sections.map((k) => {
            if (k === 'bosses' && enc)
              return (
                <section key={k} id={k} className="scroll-mt-28">
                  <SectionTitle title="Bosses">
                    {`${enc.bosses} ${enc.bosses === 1 ? 'boss' : 'bosses'}${enc.rares ? ` and ${enc.rares} rare ${enc.rares === 1 ? 'spawn' : 'spawns'}` : ''} in the order of a normal run${enc.runs ? ', each wing a run of its own' : ''}. Abilities, loot and chances are Classic’s (patch 1.12, from VMaNGOS); Forever may have changed them.`}
                  </SectionTitle>
                  {bosses.length > 1 && <BossIndex data={enc} />}
                  <div className={`space-y-6 ${bosses.length > 1 ? 'mt-12' : ''}`}>
                    {bosses.map((b) => (
                      <BossSection key={b.key} boss={b} place={places.get(b.key)} />
                    ))}
                  </div>
                </section>
              );
            if (k === 'trash' && enc)
              return (
                <section key={k} id={k} className="scroll-mt-28">
                  <SectionTitle title="Notable drops from regular mobs">Uncommon or better items that drop mainly in this raid, from its regular mobs: best quality first, with the best chance per kill and the mobs that drop them.</SectionTitle>
                  <TrashDrops data={enc} />
                </section>
              );
            if (k === 'dungeons')
              return (
                <section key={k} id={k} className="scroll-mt-12">
                  <SectionTitle title={dungeonsTitle}>Each has its own page.</SectionTitle>
                  <DungeonCards list={related} />
                </section>
              );
            if (k === 'quests')
              return (
                <section key={k} id={k} className="scroll-mt-12">
                  {/* Quest givers for brand-new zones are often not on record yet; the giver line only shows where one is. */}
                  <SectionTitle title="Quests" href={`/quests?zone=${z.id}`} linkLabel="Filter these quests">
                    New and changed quests come first, then the rest by level.{sides ? ' Quests only one side can take are marked.' : ''}
                  </SectionTitle>
                  {reputation.length > 0 && (
                    <p className="mb-5 flex flex-wrap items-center gap-2 text-[14.5px] text-mist">
                      <span>Reputation from these quests:</span>
                      {reputation.map((f) => (
                        <span key={f.id} className="rounded-full bg-white/[0.06] px-3 py-1 text-[13.5px] text-parch ring-1 ring-inset ring-white/10">
                          {f.name} <span className="num text-fog">{f.quests}</span>
                        </span>
                      ))}
                    </p>
                  )}
                  <ZoneQuests quests={rows} />
                </section>
              );
            if (k === 'enemies')
              return (
                <section key={k} id={k} className="scroll-mt-12">
                  <SectionTitle title="Named and elite enemies">Bosses and rare creatures first, then elites by level.</SectionTitle>
                  <EnemyGrid enemies={enemies} />
                </section>
              );
            if (k === 'items')
              return (
                <section key={k} id={k} className="scroll-mt-12">
                  <SectionTitle title="Items from this zone">Uncommon and better, best first.</SectionTitle>
                  <div className="space-y-10">
                    <ItemGroup title="Quest rewards" note="Rewards and reward choices of the quests above." items={items.rewards} />
                    <ItemGroup title="Drops and chests" items={items.drops} />
                    <ItemGroup title="Sold by vendors here" items={items.sold} />
                  </div>
                </section>
              );
            return (
              <section key={k} id={k} className="scroll-mt-12">
                <SectionTitle title="Trainers and vendors">
                  {join([services.classTrainers.length ? 'Class trainers' : '', services.trainers.length ? 'other trainers' : '', services.vendors.length ? 'vendors' : '', ...services.other.map((g) => g.label.toLowerCase())].filter(Boolean)).replace(/^./, (c) => c.toUpperCase())} on record
                  in {z.n}.
                </SectionTitle>
                <ServicesBlock s={services} />
              </section>
            );
          })}

          {guides.length > 0 && (
            <section id="guides" className="scroll-mt-12">
              <SectionTitle title={guides.length === 1 ? 'Guide' : 'Guides'}>{guides.length === 1 ? 'A guide that covers this zone.' : 'Guides that cover this zone.'}</SectionTitle>
              <div className="grid gap-3 md:grid-cols-3">
                {guides.map((g) => (
                  <Link key={g.slug} href={`/guides/${g.slug}`} className="frame block p-5 transition-colors hover:border-gilt/40">
                    <h3 className="text-[1.2rem] leading-snug text-vellum">{g.title}</h3>
                    <p className="mt-1.5 line-clamp-3 text-[14.5px] leading-relaxed text-mist">{g.description}</p>
                    <p className="num mt-3 text-[13px] text-fog">{g.minutes} min read</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {next.length > 0 ? (
            <section id="next" className="scroll-mt-12">
              <SectionTitle title="Where to go next" />
              <NextGrid cards={next} />
            </section>
          ) : (
            <Panel gilt className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="max-w-xl">
                <h2 className="text-[1.5rem] leading-tight text-vellum">Zones and dungeons by level</h2>
                <p className="mt-1 text-[16px] text-mist">Every zone on one level ladder, and every dungeon and raid with its levels.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/world">All zones</ButtonLink>
                <ButtonLink href="/dungeons" variant="ghost">
                  Dungeons and raids
                </ButtonLink>
              </div>
            </Panel>
          )}
        </div>
      </Container>
    </>
  );
}
