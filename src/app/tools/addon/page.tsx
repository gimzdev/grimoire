import type { Metadata } from 'next';
import Image from 'next/image';
import { WowIcon } from '@/components/icon';
import { HeartIcon } from '@/components/support';
import { BUTTON, Container, SectionTitle } from '@/components/ui';
import { Vista } from '@/components/vista';
import { AddonButton } from '@/components/addon-button';
import { PATREON } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Grimoire in game',
  description:
    'The Grimoire add-on for World of Warcraft: Forever, in screenshots: a map of every dungeon with its bosses and loot, your leveling route with an arrow, your build point by point, gear upgrades and auction prices. Free on CurseForge.',
  alternates: { canonical: '/tools/addon' },
};

type Shot = { src: string; title: string; text: string; alt: string };

const shot = (file: string, title: string, text: string, alt: string): Shot => ({ src: `/img/addon/${file}.webp`, title, text, alt });

/** Screenshots from WoW Forever with the add-on open (1.0.5, the look has not changed since). Chat is blurred. */
const GROUPS: { title: string; text: string; shots: Shot[] }[] = [
  {
    title: 'Dungeon and raid maps',
    text: 'Forever shows no map inside a dungeon. Grimoire draws one for every dungeon and raid, with each boss where it stands.',
    shots: [
      shot('02-shadowfang-keep-map', 'Every boss where it stands', 'Hover a boss for its abilities and best loot; click it for everything it drops.', 'Grimoire’s map of Shadowfang Keep in game, with Baron Silverlaine’s abilities and loot on hover'),
      shot('03-dire-maul-wings', 'Wings and floors', 'Dire Maul’s three wings and the Capital Gardens’ two floors each get their own map.', 'Grimoire’s map of Dire Maul in game, with a tab for each wing and a boss tooltip'),
      shot('04-deadmines-before-you-go', 'Before you go', 'The dungeon’s quests, ticked when you have done them or have them in your log.', 'The Deadmines in Grimoire, with its quests listed under the map'),
      shot('05-molten-core-loot', 'Raids too', 'Classic’s raids are marked when Forever doesn’t have them. Molten Core: every boss on the map, and its loot with drop chances.', 'Molten Core in Grimoire, its map and its loot list with drop chances'),
    ],
  },
  {
    title: 'The road to 60',
    text: 'The same routes as the leveling tool on this site, followed in game.',
    shots: [
      shot('06-leveling-route', 'Your route, step by step', 'For your race and class, Skyborne included: an arrow to each place, the experience each step gives, and steps that tick themselves.', 'Grimoire’s leveling route in game, each step with its place and experience'),
      shot('07-world-map-quests', 'On your world map', 'A mark at every giver with a quest you can take now, and your next places on the route.', 'The world map of Tanaris with Grimoire’s quest marks'),
    ],
  },
  {
    title: 'Talents and spells',
    text: 'Forever’s trees as they are now, and the spells your trainer has for you.',
    shots: [
      shot('08-talent-planner', 'Your build, point by point', 'A leveling, PvE and PvP build for every spec, or your own: each level-up tells you where the point goes.', 'Grimoire’s talent planner in game, a druid build with its point order'),
      shot('09-what-to-train', 'What to train now', 'Every trainer spell by the level it is learned at, with what you already know.', 'Grimoire’s list of trainer abilities by level in game'),
    ],
  },
  {
    title: 'Gear',
    text: 'Items scored for your build, from the same database as this site.',
    shots: [
      shot('10-gear-upgrades', 'Upgrades for your build', 'Your best upgrade for each slot, with where it drops.', 'Grimoire’s gear window in game, a list of upgrades with their sources'),
      shot('11-item-database', 'Every item you can wear', 'Filter by quality, by what you can use or by your level, and hover any item for its tooltip.', 'Grimoire’s item list in game with an item tooltip'),
    ],
  },
  {
    title: 'And your character',
    text: 'Everything above, gathered where you open it.',
    shots: [
      shot('01-home', 'Type /grim', 'Grimoire opens on your character, with your next talent point, the spells to train, your next steps, the dungeons for your level and your next upgrades.', 'Grimoire’s home page in game, a druid in 3D beside talents, spells, leveling, dungeons and upgrades'),
      shot('12-legacy-perks', 'Legacy', 'All sixty-five challenges across your account, and a planner for the perk trees.', 'Grimoire’s Legacy perk planner in game'),
    ],
  },
];

const MORE = [
  { icon: 'inv_misc_coin_01', title: 'Prices in tooltips', text: 'What a vendor pays and what the auction house asks, side by side.' },
  { icon: 'inv_misc_bag_10', title: 'A selling tab', text: 'At the auction house, priced from what is in your bags. Every post is your own click.' },
  { icon: 'ability_marksmanship', title: 'Bars for your build', text: 'Action bars set up to match a build in one click, and undone in one.' },
  { icon: 'inv_misc_spyglass_02', title: 'Rare alerts', text: 'A card when a rare is near, with its best drops and the way to it.' },
  { icon: 'spell_shadow_lifedrain', title: 'Kill bar', text: 'Turns gold when your damage over time will finish the target.' },
  { icon: 'spell_holy_wordfortitude', title: 'Raid check', text: 'The buffs your raid brings, and which classes bring the rest.' },
  { icon: 'inv_misc_orb_02', title: 'Sayge’s fortune', text: 'A timer for each character during the Darkmoon Faire.' },
  { icon: 'inv_misc_book_11', title: 'Guides in game', text: 'Every guide on this site, readable without leaving the game.' },
  { icon: 'inv_misc_gear_01', title: 'Light or Complete', text: 'Just the guide window, tooltips and level-up notes, or everything.' },
];

function ShotCard({ s, priority = false }: { s: Shot; priority?: boolean }) {
  return (
    <figure className="frame overflow-hidden">
      <a href={s.src} target="_blank" rel="noopener noreferrer" title="Open the full screenshot" className="group relative block aspect-[16/9] bg-night">
        <Image src={s.src} alt={s.alt} fill priority={priority} sizes="(min-width: 1320px) 640px, (min-width: 1024px) 50vw, 100vw" quality={85} className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.015]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />
      </a>
      <figcaption className="px-5 pb-5 pt-4 sm:px-6">
        <div className="text-[1.15rem] font-semibold leading-tight tracking-[-0.016em] text-vellum">{s.title}</div>
        <p className="mt-1.5 text-[15px] leading-relaxed text-mist">{s.text}</p>
      </figcaption>
    </figure>
  );
}

function GetIt({ center = false }: { center?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${center ? 'justify-center' : ''}`}>
      <AddonButton from="addon-page">Get it on CurseForge</AddonButton>
      <a href={PATREON} target="_blank" rel="noopener noreferrer" className={`${BUTTON.base} ${BUTTON.ghost}`}>
        <HeartIcon className="size-4 text-gilt" />
        Support on Patreon
      </a>
    </div>
  );
}

export default function AddonPage() {
  return (
    <>
      <Vista art="camp" title="Grimoire in game" size="compact" aside={<GetIt />}>
        The field guide inside WoW Forever. Type <span className="font-semibold text-vellum">/grim</span>.
      </Vista>
      <Container className="space-y-20 sm:space-y-24">
        {GROUPS.map((g, gi) => (
          <section key={g.title}>
            <SectionTitle title={g.title}>{g.text}</SectionTitle>
            <div className="grid gap-4 lg:grid-cols-2">
              {g.shots.map((s, si) => (
                <ShotCard key={s.src} s={s} priority={gi === 0 && si < 2} />
              ))}
            </div>
          </section>
        ))}

        <section>
          <SectionTitle title="And more" />
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {MORE.map((m) => (
              <div key={m.title} className="frame flex gap-4 p-5">
                <WowIcon icon={m.icon} size={40} name={m.title} />
                <div>
                  <div className="text-[1.05rem] font-semibold leading-tight tracking-[-0.014em] text-vellum">{m.title}</div>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-mist">{m.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="frame px-6 py-10 text-center sm:px-10 sm:py-12">
          <h2 className="text-[2rem] leading-[1.05] text-vellum sm:text-[2.4rem]">Free, with no ads and no paywall</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[16px] leading-relaxed text-mist">
            It sends nothing anywhere and saves only your settings, builds and progress. Item stats, drop chances and boss abilities are Classic’s (patch 1.12) wherever Forever has published nothing of its own.
          </p>
          <div className="mt-7">
            <GetIt center />
          </div>
        </section>
      </Container>
    </>
  );
}
