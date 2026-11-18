/**
 * Icons for the things the game gives none of its own: dungeons and raids, zones, quests, creatures, item sets and the
 * site's own pages. Every name here was checked against Blizzard's icon server, so nothing is drawn as an empty frame.
 */
import { getClasses, getItem } from './data';
import { questClasses } from './quests';
import type { DungeonInfo, ItemSet, Quest } from './types';

export const ICON = {
  dungeon: 'achievement_dungeon_classicdungeonmaster',
  raid: 'achievement_dungeon_classicraider',
  battleground: 'inv_banner_02',
  zone: 'inv_misc_map_01',
  quest: 'inv_misc_note_01',
  questNew: 'inv_scroll_03',
  set: 'inv_helmet_74',
  unknown: 'inv_misc_questionmark',
} as const;

/** The top-level pages in the menu, for search results. */
export const PAGE_ICON: Record<string, string> = {
  talents: 'ability_marksmanship',
  database: 'inv_chest_plate16',
  guides: 'inv_misc_book_11',
  tools: 'trade_engineering',
  forever: 'inv_misc_gem_pearl_04',
};

const PLACE_ICON: Record<string, string> = {
  'hyjal-summit': 'achievement_boss_archimonde-',
  'onyxias-lair': 'achievement_boss_onyxia',
  'warsong-gulch': 'achievement_bg_winwsg',
  'arathi-basin': 'achievement_bg_winab',
  'alterac-valley': 'achievement_bg_winav',
};

export function dungeonIcon(d: Pick<DungeonInfo, 'slug' | 'kind'>) {
  return PLACE_ICON[d.slug] ?? (d.kind === 'raid' ? ICON.raid : d.kind === 'battleground' ? ICON.battleground : ICON.dungeon);
}

/** A picture for each creature type (by the type number in the NPC data), since the game's portraits are 3D models. */
export const CREATURE_ICON = [
  'inv_misc_questionmark',
  'ability_hunter_beasttaming',
  'inv_misc_head_dragon_01',
  'spell_shadow_summonfelhunter',
  'spell_frost_summonwaterelemental',
  'ability_warrior_charge',
  'spell_shadow_raisedead',
  'inv_misc_head_human_01',
  'spell_nature_polymorph',
  'inv_gizmo_02',
  'inv_misc_questionmark',
  'spell_nature_stoneskintotem',
];
export const creatureIcon = (type: number | undefined) => CREATURE_ICON[type ?? 0] ?? ICON.unknown;

/** A quest's picture: its class for a class quest, else what kind of quest it is. */
export function questIcon(q: Pick<Quest, 'rc' | 'ty' | 'ch'>) {
  const classes = questClasses(q.rc);
  const classIcon = classes.length === 1 ? getClasses().find((c) => c.name === classes[0])?.icon : undefined;
  if (classIcon) return classIcon;
  if (q.ty === 81) return ICON.dungeon;
  if (q.ty === 62) return 'inv_misc_head_dragon_01';
  if (q.ty === 41) return ICON.battleground;
  return q.ch === 'n' ? ICON.questNew : ICON.quest;
}

/** An item set shows its first piece. */
export const setIcon = (s: Pick<ItemSet, 'pieces'>) => s.pieces.map((id) => getItem(id)?.ic).find(Boolean) ?? ICON.set;
