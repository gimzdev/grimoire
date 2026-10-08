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
    owns: ['/talents', '/classes', '/abilities', '/races'],
    children: [
      { href: '/talents', label: 'Talent calculator', description: 'Every rebuilt tree, with point order and sharing', icon: 'ability_marksmanship' },
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
      { href: '/items?change=new', label: 'New items', description: 'Items that did not exist in Classic', icon: 'inv_misc_gem_pearl_04' },
      { href: '/sets', label: 'Item sets', description: 'Set pieces and bonuses', icon: 'inv_helmet_74' },
      { href: '/quests', label: 'All quests', description: 'Every quest, giver, objective and reward', icon: 'inv_misc_note_01' },
      { href: '/quests?change=new', label: 'New quests', description: 'Quests added for Forever', icon: 'inv_scroll_03' },
      { href: '/world', label: 'Zones', description: 'Every zone by level, with its quests', icon: 'inv_misc_map_01' },
      { href: '/dungeons', label: 'Dungeons and raids', description: 'Nine new dungeons, three raids at launch', icon: 'achievement_dungeon_classicdungeonmaster' },
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
      { href: '/tools/gear', label: 'Gear planner', description: 'Best item per slot for your stats', icon: 'inv_chest_chain_15' },
      { href: '/tools/leveling', label: 'Leveling route', description: 'Zones, quests and dungeons, 1 to 60', icon: 'inv_misc_map02' },
      { href: '/tools/raid', label: 'Raid composer', description: 'Buffs, debuffs and roles at a glance', icon: 'inv_banner_02' },
      { href: '/tools/legacy', label: 'Legacy planner', description: 'Challenges, points and perks', icon: 'inv_shield_06' },
    ],
  },
  { key: 'forever', href: '/forever', label: 'What’s new', description: 'Everything Forever changes', owns: ['/forever'] },
];
