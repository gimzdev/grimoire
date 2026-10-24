import Image from 'next/image';
import Link from 'next/link';
import { ArtCard } from '@/components/art-card';
import { HeroSearch } from '@/components/home-client';
import { WowIcon } from '@/components/icon';
import { Timeline } from '@/components/timeline';
import { ItemTooltip } from '@/components/tooltips';
import { BUTTON, Container, SectionTitle } from '@/components/ui';
import { chance } from '@/components/world-links';
import { resolveArt } from '@/lib/art-server';
import { ADDON } from '@/lib/site';
import { getClasses, getDungeons, getGuides, getItem, getMeta, getMinorItem, getNpc, getNpcLoot, getQuests, getRaces, getZones } from '@/lib/data';
import { isLadderZone } from '@/lib/world';
import { itemTipExtra } from '@/lib/item-source';
import { categoryName } from '@/lib/quests';
import { QUALITY_COLOR } from '@/lib/wow';

export const revalidate = 3600;

const fmt = (n: number) => n.toLocaleString('en-US');

/** The window every big picture on this page sits in: inset from the screen edges, rounded. */
const WINDOW = 'relative isolate overflow-hidden rounded-[22px] bg-night sm:rounded-[28px]';
const WINDOW_EDGE = <div aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] ring-1 ring-inset ring-white/[0.08]" />;

/* ── Hero ───────────────────────────────────────────────────────────────── */

function Hero() {
  const a = resolveArt('homeBackground');
  const classes = getClasses();
  const quests = getQuests().length;
  const meta = getMeta();
  const tf = getItem(19019);
  const mage = classes.find((c) => c.slug === 'mage');
  const popular = [
    { href: '/items/19019', label: 'Thunderfury', icon: tf?.ic ?? 'inv_sword_39', color: QUALITY_COLOR[tf?.q ?? 5] },
    { href: '/dungeons/hall-of-thanes', label: 'The Hall of Thanes', icon: 'achievement_dungeon_classicdungeonmaster', color: undefined },
    { href: '/talents/mage', label: 'Mage talents', icon: mage?.icon ?? 'classicon_mage', color: mage?.color },
  ];
  return (
    <section className="relative -mt-[84px] px-2 pt-2 sm:px-2.5 sm:pt-2.5">
      {/* Phones and tablets: the picture on top, the title under it. From lg the picture fills a window as tall as the
          screen, the title sits on its left, the vista stays clear to the right and the classes run along the bottom. */}
      <div className={`${WINDOW} lg:flex lg:h-[max(560px,calc(100svh-20px))] lg:flex-col`}>
        <div className="relative h-[min(480px,60svh)] min-h-[400px] w-full sm:h-[460px] sm:min-h-0 lg:absolute lg:inset-0 lg:-z-10 lg:h-auto lg:min-h-0">
          <Image src={a.src} alt={a.alt} fill priority sizes="100vw" quality={85} className="object-cover object-[54%_50%] sm:object-[52%_50%] lg:object-[38%_50%]" />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(180deg,rgb(8_9_12/0.5)_0%,transparent_16%,transparent_48%,rgb(13_15_19/0.5)_70%,rgb(13_15_19/0.88)_88%,var(--color-night)_100%)] lg:hidden"
          />
          <div aria-hidden className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgb(8_9_12/0.84)_0%,rgb(8_9_12/0.7)_26%,rgb(8_9_12/0.36)_48%,transparent_68%)] lg:block" />
          <div aria-hidden className="absolute inset-0 hidden bg-[linear-gradient(180deg,rgb(8_9_12/0.45)_0%,transparent_17%,transparent_60%,rgb(8_9_12/0.72)_100%)] lg:block" />
        </div>
        {WINDOW_EDGE}

        <div className="relative mx-auto -mt-[130px] flex w-full max-w-[1320px] flex-1 flex-col px-4 sm:-mt-[130px] sm:px-6 lg:mt-0 lg:pt-[92px]">
          <div className="flex flex-1 items-center lg:pt-[clamp(0px,calc(100svh-610px),110px)]">
            <div className="w-full max-w-[640px] lg:w-[560px]">
              <h1 className="text-[2.4rem] leading-[1.02] tracking-[-0.035em] text-vellum sm:text-[3.4rem] lg:text-[3.8rem] xl:text-[4.1rem]">
                <span className="block whitespace-nowrap">The WoW Forever</span>
                <span className="block whitespace-nowrap">field guide</span>
              </h1>
              <div className="mt-8 sm:mt-9">
                <HeroSearch placeholder={`Search ${fmt(meta.counts.items)} items, ${fmt(quests)} quests and every talent`} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[14px] text-mist">Popular</span>
                {popular.map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    className="glass inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-[14px] font-medium text-parch transition-colors hover:border-white/25 hover:text-vellum"
                  >
                    <WowIcon icon={p.icon} size={26} name={p.label} eager rounded />
                    <span style={p.color ? { color: p.color } : undefined}>{p.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* The class dock: like the character screen, one click from each class's talent calculator. Three rows of three on phones. */}
          <div className="pb-4 pt-8 sm:pb-6 sm:pt-10 lg:pt-5">
            <ul className="glass grid grid-cols-3 gap-1 rounded-[20px] p-1.5 sm:grid-cols-9">
              {classes.map((c) => {
                const s = c.talentStats;
                return (
                  <li key={c.slug} className="min-w-0">
                    <Link
                      href={`/talents/${c.slug}`}
                      className="group relative isolate flex h-full flex-col items-center gap-2 overflow-hidden rounded-[14px] px-1 pb-3 pt-3.5 text-center transition-colors duration-200 hover:bg-white/[0.05] lg:px-2 lg:pb-3.5 lg:pt-4"
                      style={{ ['--cc' as string]: c.color }}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-0 -z-10 bg-[radial-gradient(75%_90%_at_50%_110%,color-mix(in_srgb,var(--cc)_30%,transparent),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      />
                      <span aria-hidden className="absolute inset-x-7 bottom-0 h-[2px] rounded-full bg-[var(--cc)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      <WowIcon icon={c.icon} size={44} name={c.name} eager className="transition-transform duration-200 group-hover:-translate-y-0.5 max-lg:!size-10" />
                      <span className="text-[14px] font-semibold leading-none sm:text-[13px] md:text-[14px] lg:text-[15.5px]" style={{ color: c.color }}>
                        {c.name}
                      </span>
                      <span className="hidden whitespace-nowrap text-[12.5px] leading-tight text-fog transition-colors group-hover:text-mist xl:inline">
                        <span className="num">{s.new}</span> new, <span className="num">{s.changed}</span> reworked
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── What's new ─────────────────────────────────────────────────────────── */

function WhatsNew() {
  const dungeons = getDungeons().filter((d) => d.isNew && d.kind === 'dungeon').length;
  const tiles = [
    {
      art: 'zephras',
      href: '/world',
      tag: 'Levels 1 to 60',
      title: 'Four new zones',
      text: 'Zephras Isle, Riverglades, Shen’dralas and Mount Hyjal, with hundreds of new quests between them.',
    },
    {
      art: 'paintedValley',
      href: '/guides/new-dungeons',
      tag: 'Levels 13 to 60',
      title: `${dungeons === 9 ? 'Nine' : dungeons} new dungeons`,
      text: 'From the Hall of Thanes under Ironforge to the Shaper’s Terrace at 60.',
    },
    {
      art: 'legacy',
      href: '/guides/legacy-system',
      tag: 'Account-wide',
      title: 'The Legacy system',
      text: 'Sixty-five challenges that earn perks for every character on your account.',
    },
    {
      art: 'rulesets',
      href: '/guides/rulesets',
      tag: 'At launch',
      title: 'Rulesets, not realms',
      text: 'Normal, PvP and Roleplaying from day one, with Hardcore later.',
    },
  ];
  return (
    <section>
      <SectionTitle title="What’s new in Forever" href="/forever" linkLabel="Everything that changed">
        A new race, four zones, nine dungeons, three raids and rebuilt talent trees.
      </SectionTitle>
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2">
        <ArtCard art="skyborneStill" href="/guides/skyborne" tag="New race, both factions" outerClassName="lg:col-span-2 lg:row-span-2" minH="min-h-[400px] lg:min-h-[580px]" sizes="(min-width: 1024px) 60vw, 100vw">
          <h3 className="text-[2.4rem] leading-none text-vellum sm:text-[2.8rem]">The Skyborne</h3>
          <p className="mt-3 max-w-md text-[16px] leading-relaxed text-parch">
            Highborne exiles who made a pact with the wind. Play the Horde’s Windshapers or the Alliance’s High Order, and begin on Zephras Isle above the clouds.
          </p>
        </ArtCard>
        {tiles.map((t) => (
          <ArtCard key={t.href} art={t.art} href={t.href} tag={t.tag} minH="min-h-[270px]" sizes="(min-width: 1024px) 25vw, 100vw">
            <h3 className="text-[1.5rem] leading-tight text-vellum">{t.title}</h3>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-parch">{t.text}</p>
          </ArtCard>
        ))}
        <Combos />
      </div>
    </section>
  );
}

/* ── New class combinations ────────────────────────────────────────────── */

/** The six new class combinations, the same ones the What's new page lists. The Undead Paladin comes first, and it is the one in the picture. */
function Combos() {
  const races = new Map(getRaces().map((r) => [r.slug, r]));
  const combos = getClasses().flatMap((c) =>
    c.newRaces.flatMap((slug) => {
      const race = races.get(slug);
      return race && !slug.includes('skyborne') ? [{ cls: c, race }] : [];
    })
  );
  const a = resolveArt('undead');
  return (
    <div className="group relative isolate overflow-hidden rounded-[20px] bg-slate lg:col-span-4 lg:grid lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]">
      {/* The whole card opens Races and racials. The combination links sit above this one, so each still goes to its own race. */}
      <Link href="/races" aria-label="Races and racials" className="absolute inset-0 z-20 rounded-[inherit]" />
      {/* The picture melts into the card: down on phones and tablets, to the right beside the text. */}
      <div className="relative h-[280px] overflow-hidden sm:h-[320px] lg:h-auto lg:min-h-[300px]">
        <Image src={a.src} alt={a.alt} fill sizes="(min-width: 1320px) 740px, (min-width: 1024px) 58vw, 100vw" quality={75} className="object-cover transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-[1.03]" style={{ objectPosition: a.focus ?? 'center' }} />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(0deg,var(--color-slate),transparent_50%)] lg:bg-[linear-gradient(270deg,var(--color-slate),transparent_42%)]" />
        <span className="glass absolute left-4 top-4 rounded-full px-3 py-1 text-[12.5px] font-semibold text-vellum">Undead Paladin</span>
      </div>
      <div className="relative flex flex-col justify-center p-6 pt-2 sm:p-8 sm:pt-2 lg:py-8 lg:pl-2 lg:pr-9">
        <h3 className="text-[1.9rem] leading-[1.05] text-vellum sm:text-[2.2rem]">Six new class combinations</h3>
        <p className="mt-2.5 max-w-md text-balance text-[15.5px] leading-relaxed text-mist">These races gained a class they could never play before.</p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {combos.map(({ cls, race }) => (
            <li key={cls.slug + race.slug}>
              <Link
                href={`/races/${race.slug}`}
                className="glass relative z-30 inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-[14px] font-medium text-parch transition-colors hover:border-white/25 hover:text-vellum"
              >
                {/* The race icon, then the class icon tucked against it. The words beside them carry the name. */}
                <span aria-hidden className="flex">
                  <WowIcon icon={race.icon} size={26} name={race.name} rounded />
                  <WowIcon icon={cls.icon} size={26} name={cls.name} rounded className="-ml-1.5" />
                </span>
                <span>
                  {race.name} <span style={{ color: cls.color }}>{cls.name}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] ring-1 ring-inset ring-white/[0.09] transition-colors group-hover:ring-white/25" />
    </div>
  );
}

/* ── Loot ───────────────────────────────────────────────────────────── */

const SHOWCASE_NPC = 639; // Edwin VanCleef, the Deadmines
const SHOWCASE_ITEM = 5191; // Cruel Barb

function Loot() {
  const meta = getMeta();
  const quests = getQuests().length;
  const boss = getNpc(SHOWCASE_NPC);
  const dungeons = getDungeons().filter((d) => d.kind !== 'battleground').length;
  const zones = getZones().filter(isLadderZone).length;
  // Gear and quest items only: cloth and food would crowd the table.
  const loot = getNpcLoot(SHOWCASE_NPC)
    .filter(([id, , quest]) => quest || (getItem(id)?.q ?? getMinorItem(id)?.[1] ?? 0) >= 2 || getMinorItem(id)?.[9])
    .slice(0, 6);
  const barb = getItem(SHOWCASE_ITEM);
  const tiles: { href: string; icon: string; n: number; label: string }[] = [
    {
      href: '/items',
      icon: 'inv_chest_plate16',
      n: meta.counts.items,
      label: 'Items',
    },
    { href: '/quests', icon: 'inv_misc_note_01', n: quests, label: 'Quests' },
    {
      href: '/dungeons',
      icon: 'achievement_dungeon_classicdungeonmaster',
      n: dungeons,
      label: 'Dungeons and raids',
    },
    { href: '/world', icon: 'inv_misc_map_01', n: zones, label: 'Zones' },
  ];
  return (
    <section className="relative isolate overflow-hidden rounded-[28px] border border-white/[0.07] bg-[linear-gradient(180deg,#121419,#0c0d11)] px-5 py-10 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] sm:px-10 sm:py-14 lg:px-14 lg:py-16">
      <div aria-hidden className="absolute -right-24 top-1/2 -z-10 h-[620px] w-[760px] -translate-y-1/2 bg-[radial-gradient(closest-side,rgb(242_182_64/0.09),transparent)]" />
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-10">
        <div>
          <h2 className="text-[2rem] leading-[1.05] text-vellum sm:text-[2.6rem]">Loot tables</h2>
          <ul className="mt-8 grid grid-cols-2 gap-3">
            {tiles.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className="group flex h-full flex-col gap-4 rounded-2xl bg-white/[0.035] p-4 ring-1 ring-inset ring-white/[0.06] transition-colors hover:bg-white/[0.06] hover:ring-white/[0.12] sm:p-5"
                >
                  <WowIcon icon={t.icon} size={36} name={t.label} />
                  <span>
                    <span className="num block text-[1.8rem] font-semibold leading-none tracking-[-0.03em] text-vellum">{fmt(t.n)}</span>
                    <span className="mt-1.5 block text-[14px] text-mist transition-colors group-hover:text-parch">{t.label}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* A real loot table and a real tooltip, straight from the data: the row it describes is shown as hovered. */}
        <div className="relative">
          {boss && (
            <div className="relative overflow-visible rounded-[22px] bg-[#0b0c10] ring-1 ring-white/[0.08] shadow-[0_40px_80px_-40px_rgb(0_0_0/0.95)] lg:ml-auto lg:max-w-[400px] min-[84rem]:ml-0 min-[84rem]:max-w-[390px]">
              <div className="flex items-center gap-3.5 border-b border-white/[0.06] px-5 pb-4 pt-5">
                <WowIcon icon="inv_misc_head_human_01" size={42} name={boss[0]} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/npcs/${SHOWCASE_NPC}`}
                    data-tip={`npc:${SHOWCASE_NPC}`}
                    className="block truncate text-[1.25rem] font-semibold leading-tight tracking-[-0.02em] text-vellum hover:text-gilt-bright"
                  >
                    {boss[0]}
                  </Link>
                  <div className="text-[13.5px] text-mist">
                    Level {boss[2]} boss, {categoryName(boss[6])}
                  </div>
                </div>
                <span className="self-start rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-medium text-mist">Per kill</span>
              </div>
              <ul className="p-2">
                {loot.map(([id, pct, quest]) => {
                  const it = getItem(id);
                  const minor = it ? undefined : getMinorItem(id);
                  const name = it?.n ?? minor?.[0] ?? `Item ${id}`;
                  const q = it?.q ?? minor?.[1] ?? 1;
                  const icon = it?.ic ?? minor?.[2];
                  const w = pct <= 0 ? 0 : Math.max(4, Math.min(100, ((Math.log10(pct) + 2) / 4) * 100));
                  const shown = id === SHOWCASE_ITEM;
                  return (
                    <li key={id} className={`relative grid grid-cols-[minmax(0,1fr)_72px] items-center gap-4 rounded-[14px] px-3 py-2.5 ${shown ? 'bg-white/[0.06] ring-1 ring-inset ring-white/[0.08]' : ''}`}>
                      <Link
                        href={`/items/${id}`}
                        data-tip={`item:${id}`}
                        className="flex min-w-0 items-center gap-3 text-[15px] font-medium hover:underline hover:underline-offset-2"
                        style={{ color: QUALITY_COLOR[q] }}
                      >
                        <WowIcon icon={icon} size={32} quality={q} name={name} />
                        <span className="truncate">{name}</span>
                      </Link>
                      <span className="text-right">
                        <span className={`num block text-[14.5px] font-semibold ${quest ? 'text-leaf-bright' : 'text-vellum'}`}>{chance(pct)}</span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                          <span className={`block h-full rounded-full ${quest ? 'bg-leaf' : 'bg-gilt'}`} style={{ width: `${w}%` }} />
                        </span>
                      </span>
                      {shown && barb && (
                        <div className="pointer-events-none absolute left-full top-1/2 z-10 ml-5 hidden w-[276px] -translate-y-[30%] drop-shadow-[0_30px_40px_rgb(0_0_0/0.85)] min-[84rem]:block">
                          <ItemTooltip item={barb} extra={itemTipExtra(barb)} compact />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="border-t border-white/[0.06] px-5 py-3.5 text-[13.5px] text-fog">Green drops only while you are on the quest.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── The road to 60 ─────────────────────────────────────────────────────── */

type Row = {
  name: string;
  href: string;
  lo: number;
  hi: number;
  approx?: boolean;
  /** No level range announced yet: the row shows a note instead of a bar. */
  tbd?: boolean;
};

function Road() {
  const zones: Row[] = [
    { name: 'Zephras Isle', href: '/world/16593', lo: 1, hi: 12 },
    { name: 'Riverglades', href: '/world/16591', lo: 0, hi: 0, tbd: true },
    { name: 'Shen’dralas', href: '/world/16651', lo: 0, hi: 0, tbd: true },
    { name: 'Mount Hyjal', href: '/world/616', lo: 55, hi: 60, approx: true },
  ];
  const dungeons = getDungeons();
  const dRows: Row[] = dungeons
    .filter((d) => d.isNew && d.kind === 'dungeon' && d.levels)
    .map((d) => ({
      name: d.name,
      href: `/dungeons/${d.slug}`,
      lo: d.levels![0],
      hi: d.levels![1],
    }));
  const raids: Row[] = dungeons
    .filter((d) => d.kind === 'raid')
    .map((d) => ({
      name: `${d.name} (${d.size})`,
      href: `/dungeons/${d.slug}`,
      lo: 60,
      hi: 60,
    }));
  const pos = (lvl: number) => ((lvl - 1) / 59) * 100;
  const group = (title: string, rows: Row[], color: string) => (
    <>
      <div className="col-span-2 mb-1 mt-7 flex items-center gap-2 text-[13.5px] font-medium text-mist first:mt-0">
        <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
        {title}
      </div>
      {rows.map((r) => (
        <div key={r.href} className="contents">
          <Link href={r.href} className="truncate py-1.5 pr-4 text-[15px] text-parch transition-colors hover:text-vellum">
            {r.name}
          </Link>
          {r.tbd ? (
            <div className="flex h-8 items-center text-[12.5px] text-fog">Levels not announced yet</div>
          ) : (
            <div className="relative h-8">
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/[0.06]" />
              <div
                className={`absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full ${r.approx ? 'border border-dashed' : ''}`}
                style={{
                  left: `${pos(r.lo)}%`,
                  width: r.hi === r.lo ? '10px' : `calc(${pos(r.hi) - pos(r.lo)}% + 2px)`,
                  marginLeft: r.hi === r.lo ? '-5px' : undefined,
                  background: r.approx ? 'transparent' : color,
                  borderColor: color,
                }}
                title={`${r.name}: level ${r.lo}${r.hi !== r.lo ? ` to ${r.hi}` : ''}${r.approx ? ' (estimated)' : ''}`}
              />
              {/* The label sits after the bar, or before it when the bar runs to 60. */}
              <span
                className="num absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[12.5px] text-fog"
                style={
                  r.hi >= 56
                    ? {
                        right: `calc(${100 - pos(r.lo)}% + ${r.hi === r.lo ? 12 : 8}px)`,
                      }
                    : { left: `calc(${pos(r.hi)}% + 8px)` }
                }
              >
                {r.lo === r.hi ? r.lo : `${r.lo} to ${r.hi}`}
              </span>
            </div>
          )}
        </div>
      ))}
    </>
  );
  return (
    <section>
      <SectionTitle title="The road to 60" href="/tools/leveling" linkLabel="Open the leveling route">
        New zones, dungeons and raids by level.
      </SectionTitle>
      <div className="frame px-5 py-6 sm:px-8 sm:py-8">
        <div className="scroll-thin overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-[minmax(124px,230px)_1fr] items-center">
            <div />
            <div className="relative mb-4 h-5 text-[12.5px] text-fog">
              {[1, 10, 20, 30, 40, 50, 60].map((l) => (
                <span key={l} className={`num absolute ${l === 1 ? '' : l === 60 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${pos(l)}%` }}>
                  {l}
                </span>
              ))}
            </div>
            {group('New zones', zones, 'var(--color-leaf)')}
            {group('New dungeons', dRows, 'var(--color-gilt)')}
            {group('Raids from December 9', raids, 'var(--color-ember)')}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Guides and tools ───────────────────────────────────────────────────── */

function Guides() {
  const guides = getGuides();
  const featured = ['getting-started', 'leveling', 'talents-overview'].map((s) => guides.find((g) => g.slug === s)).filter((g): g is NonNullable<typeof g> => Boolean(g));
  const classGuides = guides.filter((g) => g.category === 'Classes');
  const classes = getClasses();
  return (
    <section>
      <SectionTitle title="Guides" href="/guides" linkLabel="All guides" />
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        {featured.map((g) => (
          <ArtCard key={g.slug} art={g.art ?? 'paintedVista'} href={`/guides/${g.slug}`} tag={g.category} minH="min-h-[320px]">
            <h3 className="text-[1.5rem] leading-tight text-vellum">{g.title}</h3>
            <p className="mt-1.5 line-clamp-2 text-[14.5px] text-parch">{g.description}</p>
          </ArtCard>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-2 text-[14px] text-mist">Class guides</span>
        {classGuides.map((g) => {
          const c = classes.find((x) => x.slug === g.cls);
          if (!c) return null;
          return (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] py-1 pl-1 pr-4 text-[14px] font-semibold ring-1 ring-inset ring-white/[0.07] transition-colors hover:bg-white/[0.08]"
              style={{ color: c.color }}
            >
              <WowIcon icon={c.icon} size={28} name={c.name} rounded />
              {c.name}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Tools() {
  const tools = [
    {
      href: '/items',
      icon: 'inv_chest_chain_15',
      title: 'Item database',
      text: 'Every piece of gear with its Classic stats, drop chances and sources.',
    },
    {
      href: '/tools/leveling',
      icon: 'inv_misc_map02',
      title: 'Leveling route',
      text: 'A route for every race and class: every quest to 60 in order, with map coordinates, flights and trainer visits.',
    },
    {
      href: '/tools/raid',
      icon: 'inv_banner_02',
      title: 'Raid composer',
      text: 'Drop in a roster and see which buffs and roles are missing.',
    },
    {
      href: '/tools/legacy',
      icon: 'inv_shield_06',
      title: 'Legacy planner',
      text: 'All sixty-five challenges, and a planner for the perk trees.',
    },
  ];
  return (
    <section>
      <SectionTitle title="Planning tools" href="/tools" linkLabel="All tools" />
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {tools.map((t) => (
          <Link key={t.href} href={t.href} className="frame group block p-6 transition-colors hover:border-white/[0.16]">
            <WowIcon icon={t.icon} size={46} name={t.title} />
            <div className="mt-5 text-[1.2rem] font-semibold leading-tight tracking-[-0.018em] text-vellum">{t.title}</div>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-mist">{t.text}</p>
          </Link>
        ))}
      </div>
      <a
        href={ADDON.url}
        target="_blank"
        rel="noopener noreferrer"
        className="frame group mt-3 flex flex-col gap-4 p-6 transition-colors hover:border-white/[0.16] sm:mt-4 sm:flex-row sm:items-center sm:gap-5"
      >
        <WowIcon icon="inv_misc_book_09" size={46} name="Grimoire add-on" />
        <div className="min-w-0 flex-1">
          <div className="text-[1.2rem] font-semibold leading-tight tracking-[-0.018em] text-vellum">Grimoire in game</div>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-mist">The leveling route with an arrow to every step, your build point by point, gear upgrades in every tooltip and the route on your world map, inside WoW Forever.</p>
        </div>
        <span className={`${BUTTON.base} ${BUTTON.primary} shrink-0 self-start sm:self-auto`}>Get it on CurseForge</span>
      </a>
    </section>
  );
}

/* ── The close: launch day and the first raids, under the World Tree ──── */

function Launch() {
  const a = resolveArt('worldTree');
  return (
    <section className="px-2 sm:px-2.5">
      <div className={WINDOW}>
        <Image
          src={a.src}
          alt={a.alt}
          fill
          sizes="100vw"
          quality={75}
          className="-z-20 object-cover"
          style={{
            objectPosition: '48% 34%',
            transform: a.zoom ? `scale(${a.zoom})` : undefined,
          }}
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(8_9_12/0.25)_0%,rgb(8_9_12/0.2)_40%,rgb(8_9_12/0.85)_100%)]" />
        {WINDOW_EDGE}
        {/* Tall enough on wide screens for the World Tree's crown to clear the timeline. */}
        <Container className="flex min-h-[560px] flex-col justify-end pb-6 pt-24 sm:pb-8 lg:min-h-[700px]">
          <Timeline onArt />
        </Container>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Container className="space-y-24 pt-20 sm:space-y-28 sm:pt-24">
        <WhatsNew />
        <Loot />
        <Road />
        <Guides />
        <Tools />
      </Container>
      <div className="mt-24 sm:mt-28">
        <Launch />
      </div>
    </>
  );
}
