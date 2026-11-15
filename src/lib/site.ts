/**
 * The site's public address, no trailing slash: APP_URL (a bare host gets https://), else the production domain
 * Vercel provides, else the local server.
 */
export function siteUrl(): string {
  const raw = (process.env.APP_URL || '').trim();
  if (raw) return (/^https?:\/\//.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (process.env.VERCEL && vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

/** The in-game add-on: its CurseForge page (where players install it) and its code in the repository. */
export const ADDON = {
  name: 'Grimoire Field Guide',
  url: 'https://www.curseforge.com/wow/addons/grimoire-field-guide',
  source: 'https://github.com/gimzdev/grimoire/tree/master/addon',
};

/** Where people can support Grimoire, linked from the website only: the add-on asks for nothing (Blizzard's add-on policy). */
export const PATREON = 'https://www.patreon.com/gimzdev';

/** Where players talk about Grimoire: the Discord server (the add-on shows it as a link to copy, on its About page). */
export const DISCORD = 'https://discord.gg/gY5PsymH';

/** The studio behind Grimoire, tagged so its analytics can tell a visit came from here. */
export const STUDIO = {
  made: 'https://gimzdev.com/?utm_source=grimoire',
  hire: 'https://gimzdev.com/?utm_source=grimoire#contact',
  support: 'https://gimzdev.com/support?utm_source=grimoire',
};

/** Whether a link leaves the site (it then opens in a new tab). */
export const external = (href: string) => /^https?:\/\//.test(href);

export const SITE = {
  name: 'Grimoire',
  tagline: 'Guides, talents and data for World of Warcraft: Forever',
  description:
    'Talent calculator, item and quest database with drop chances, class guides, leveling routes and planning tools for World of Warcraft: Forever.',
};

/** Launch milestones from Blizzard's announcements (times in UTC). */
export const MILESTONES = [
  { key: 'names', label: 'Name reservation', date: '2026-10-27T17:00:00Z', detail: 'Create and customize up to three characters ahead of launch, through November 3.' },
  { key: 'launch', label: 'Launch', date: '2026-11-04T23:00:00Z', detail: 'Worldwide at 3:00 p.m. PST, included with a WoW subscription or game time.' },
  { key: 'raids', label: 'First raids open', date: '2026-12-09T15:00:00Z', detail: 'Barrow Deeps for 10, Hyjal Summit for 20 and Onyxia’s Lair for 40.' },
] as const;

export interface NavItem {
  key: 'talents' | 'database' | 'guides' | 'tools' | 'forever';
  href: string;
  label: string;
  description?: string;
  /** Paths that belong to this item, for the active state. */
  owns: string[];
  children?: { href: string; label: string; description?: string; icon?: string }[];
}

export const NAV: NavItem[] = [
  {
    key: 'talents',
    href: '/talents',
    label: 'Talents',
    description: 'Plan a build for every class',
    owns: ['/talents', '/builds', '/classes', '/abilities', '/races'],
    children: [
      { href: '/talents', label: 'Talent calculator', description: 'Every rebuilt tree, with point order and sharing', icon: 'ability_marksmanship' },
      { href: '/builds', label: 'Builds', description: 'Leveling, raid and PvP builds for every spec', icon: 'inv_misc_book_11' },
      { href: '/classes', label: 'Classes', description: 'Roles, races and what changed', icon: 'achievement_general' },
      { href: '/abilities', label: 'Trainer abilities', description: 'Every rank, by level', icon: 'inv_misc_book_09' },
      { href: '/races', label: 'Races and racials', description: 'Including the new Skyborne', icon: 'inv_elemental_primal_air' },
    ],
  },
  {
    key: 'database',
    href: '/items',
    label: 'Database',
    description: 'Items, quests, NPCs, zones and dungeons',
    owns: ['/items', '/quests', '/npcs', '/sets', '/world', '/dungeons', '/search'],
    children: [
      { href: '/items', label: 'All items', description: 'Search and filter every known item', icon: 'inv_chest_plate16' },
      { href: '/sets', label: 'Item sets', description: 'Every set, its pieces and where they drop', icon: 'inv_chest_plate03' },
      { href: '/quests', label: 'All quests', description: 'Every quest, giver, objective and reward', icon: 'inv_misc_note_01' },
      { href: '/quests?change=new', label: 'New quests', description: 'Quests added for Forever', icon: 'inv_scroll_03' },
      { href: '/world', label: 'Zones', description: 'Every zone by level, with its quests', icon: 'inv_misc_map_01' },
      { href: '/dungeons', label: 'Dungeons and raids', description: 'Bosses in order, with abilities and loot', icon: 'achievement_dungeon_classicdungeonmaster' },
    ],
  },
  { key: 'guides', href: '/guides', label: 'Guides', description: 'Classes, leveling and systems', owns: ['/guides'] },
  {
    key: 'tools',
    href: '/tools',
    label: 'Tools',
    description: 'Planners for gear, leveling, raids and Legacy',
    owns: ['/tools'],
    children: [
      { href: '/tools/gear', label: 'Gear planner', description: 'The best item for every slot at your level', icon: 'inv_chest_chain_15' },
      { href: '/tools/leveling', label: 'Leveling route', description: 'Every race and class, every quest in order', icon: 'inv_misc_map02' },
      { href: '/tools/raid', label: 'Raid composer', description: 'Buff and debuff coverage, group by group', icon: 'inv_banner_02' },
      { href: '/tools/legacy', label: 'Legacy planner', description: 'Challenges, points and perks', icon: 'inv_shield_06' },
      { href: '/tools/addon', label: 'In-game add-on', description: 'The guide and its arrow, your build and bars, dungeon maps', icon: 'inv_misc_book_09' },
      { href: '/tools/tooltips', label: 'Tooltips for your site', description: 'One script tag for your guild site', icon: 'inv_letter_15' },
    ],
  },
  { key: 'forever', href: '/forever', label: 'What’s new', description: 'Everything Forever changes', owns: ['/forever'] },
];
