/**
 * Raid composer rules. Every provider names a real trainer ability or talent from the beta data
 * (checked by a test script when the data is rebuilt). "party" effects only reach the provider's group.
 */

export interface RaidSpec {
  cls: string;
  spec: string;
  label: string;
  role: 'tank' | 'healer' | 'melee' | 'ranged';
}

export const RAID_SPECS: RaidSpec[] = [
  { cls: 'warrior', spec: 'arms', label: 'Arms', role: 'melee' },
  { cls: 'warrior', spec: 'fury', label: 'Fury', role: 'melee' },
  { cls: 'warrior', spec: 'protection', label: 'Protection', role: 'tank' },
  { cls: 'paladin', spec: 'holy', label: 'Holy', role: 'healer' },
  { cls: 'paladin', spec: 'protection', label: 'Protection', role: 'tank' },
  { cls: 'paladin', spec: 'retribution', label: 'Retribution', role: 'melee' },
  { cls: 'hunter', spec: 'beast-mastery', label: 'Beast Mastery', role: 'ranged' },
  { cls: 'hunter', spec: 'marksmanship', label: 'Marksmanship', role: 'ranged' },
  { cls: 'hunter', spec: 'survival', label: 'Survival', role: 'melee' },
  { cls: 'rogue', spec: 'assassination', label: 'Assassination', role: 'melee' },
  { cls: 'rogue', spec: 'combat', label: 'Combat', role: 'melee' },
  { cls: 'rogue', spec: 'subtlety', label: 'Subtlety', role: 'melee' },
  { cls: 'priest', spec: 'discipline', label: 'Discipline', role: 'healer' },
  { cls: 'priest', spec: 'holy', label: 'Holy', role: 'healer' },
  { cls: 'priest', spec: 'shadow', label: 'Shadow', role: 'ranged' },
  { cls: 'shaman', spec: 'elemental', label: 'Elemental', role: 'ranged' },
  { cls: 'shaman', spec: 'enhancement', label: 'Enhancement', role: 'melee' },
  { cls: 'shaman', spec: 'restoration', label: 'Restoration', role: 'healer' },
  { cls: 'mage', spec: 'arcane', label: 'Arcane', role: 'ranged' },
  { cls: 'mage', spec: 'fire', label: 'Fire', role: 'ranged' },
  { cls: 'mage', spec: 'frost', label: 'Frost', role: 'ranged' },
  { cls: 'warlock', spec: 'affliction', label: 'Affliction', role: 'ranged' },
  { cls: 'warlock', spec: 'demonology', label: 'Demonology', role: 'ranged' },
  { cls: 'warlock', spec: 'destruction', label: 'Destruction', role: 'ranged' },
  { cls: 'druid', spec: 'balance', label: 'Balance', role: 'ranged' },
  { cls: 'druid', spec: 'feral', label: 'Feral cat', role: 'melee' },
  { cls: 'druid', spec: 'bear', label: 'Feral bear', role: 'tank' },
  { cls: 'druid', spec: 'restoration', label: 'Restoration', role: 'healer' },
];

export interface Provider {
  cls: string;
  /** Limit to these specs; omit for every spec of the class. */
  specs?: string[];
  /** The ability or talent name, as in the game. */
  name: string;
  via: 'ability' | 'talent';
}

export interface Effect {
  key: string;
  name: string;
  kind: 'buff' | 'debuff' | 'utility';
  scope: 'raid' | 'party' | 'target';
  text: string;
  providers: Provider[];
  note?: string;
}

const P = (cls: string, name: string, specs?: string[], via: 'ability' | 'talent' = 'ability'): Provider => ({ cls, name, specs, via });

export const EFFECTS: Effect[] = [
  // Buffs
  { key: 'kings', name: 'Blessing of Kings', kind: 'buff', scope: 'raid', text: '10% to all stats. A trainer spell for every paladin in Forever.', providers: [P('paladin', 'Blessing of Kings')] },
  { key: 'might', name: 'Blessing of Might', kind: 'buff', scope: 'raid', text: 'Attack power for melee and hunters.', providers: [P('paladin', 'Blessing of Might')] },
  { key: 'wisdom', name: 'Blessing of Wisdom', kind: 'buff', scope: 'raid', text: 'Mana regeneration for casters and healers.', providers: [P('paladin', 'Blessing of Wisdom')] },
  { key: 'salvation', name: 'Blessing of Salvation', kind: 'buff', scope: 'raid', text: 'Lower threat for damage dealers and healers.', providers: [P('paladin', 'Blessing of Salvation')] },
  { key: 'fort', name: 'Power Word: Fortitude', kind: 'buff', scope: 'raid', text: 'Stamina for everyone.', providers: [P('priest', 'Power Word: Fortitude')] },
  { key: 'spirit', name: 'Divine Spirit', kind: 'buff', scope: 'raid', text: 'Spirit for everyone. A trainer spell for every priest from level 30.', providers: [P('priest', 'Divine Spirit')] },
  { key: 'wild', name: 'Mark of the Wild', kind: 'buff', scope: 'raid', text: 'Armor, stats and resistances for everyone.', providers: [P('druid', 'Mark of the Wild')] },
  { key: 'int', name: 'Arcane Intellect', kind: 'buff', scope: 'raid', text: 'Intellect for every mana user.', providers: [P('mage', 'Arcane Intellect')] },
  { key: 'shout', name: 'Battle Shout', kind: 'buff', scope: 'party', text: 'Attack power for the warrior’s party.', providers: [P('warrior', 'Battle Shout')] },
  { key: 'trueshot', name: 'Trueshot Aura', kind: 'buff', scope: 'party', text: 'Ranged attack power for the hunter’s party. A Marksmanship talent that all three Grimoire hunter builds take.', providers: [P('hunter', 'Trueshot Aura', undefined, 'talent')] },
  { key: 'crit', name: 'Leader of the Pack or Moonkin Form', kind: 'buff', scope: 'party', text: '3% crit for the druid’s party. The two auras do not stack.', providers: [P('druid', 'Leader of the Pack', ['feral', 'bear'], 'talent'), P('druid', 'Moonkin Form', ['balance'], 'talent')] },
  { key: 'earth', name: 'Strength of Earth and Grace of Air', kind: 'buff', scope: 'party', text: 'Strength and Agility totems for the shaman’s party.', providers: [P('shaman', 'Strength of Earth Totem'), P('shaman', 'Grace of Air Totem')] },
  { key: 'windfury', name: 'Windfury Totem', kind: 'buff', scope: 'party', text: 'Extra melee attacks for the shaman’s party.', providers: [P('shaman', 'Windfury Totem')] },
  { key: 'manaspring', name: 'Mana Spring Totem', kind: 'buff', scope: 'party', text: 'Mana regeneration for the shaman’s party.', providers: [P('shaman', 'Mana Spring Totem')] },
  { key: 'aura', name: 'Paladin aura', kind: 'buff', scope: 'party', text: 'Devotion, Retribution, Concentration or a resistance aura for the paladin’s party.', providers: [P('paladin', 'Devotion Aura')] },
  { key: 'vigil', name: 'Light’s Vigil', kind: 'buff', scope: 'party', text: 'Turns the next Holy Shock on its target into a heal for that whole party.', providers: [P('paladin', "Light's Vigil", ['holy'], 'talent')] },
  { key: 've', name: 'Vampiric Embrace', kind: 'buff', scope: 'party', text: 'Heals the Shadow priest’s party for part of their Shadow damage.', providers: [P('priest', 'Vampiric Embrace', ['shadow'], 'talent')] },
  { key: 'pi', name: 'Power Infusion', kind: 'buff', scope: 'target', text: '20% spell damage and healing on one ally for 15 seconds.', providers: [P('priest', 'Power Infusion', ['discipline'], 'talent')] },
  { key: 'manatide', name: 'Mana Tide Totem', kind: 'buff', scope: 'party', text: 'Restores mana to the shaman’s party every few seconds.', providers: [P('shaman', 'Mana Tide Totem', ['restoration', 'elemental'], 'talent')] },
  { key: 'innervate', name: 'Innervate', kind: 'buff', scope: 'target', text: 'A burst of mana regeneration for one healer.', providers: [P('druid', 'Innervate')] },

  // Debuffs
  { key: 'armor', name: 'Armor reduction', kind: 'debuff', scope: 'target', text: 'Sunder Armor or Expose Armor, plus Faerie Fire and Curse of Recklessness.', providers: [P('warrior', 'Sunder Armor'), P('rogue', 'Expose Armor'), P('druid', 'Faerie Fire'), P('warlock', 'Curse of Recklessness')] },
  { key: 'elements', name: 'Curse of the Elements', kind: 'debuff', scope: 'target', text: 'Lowers magic resistances and raises magic damage taken. Every caster wants it.', providers: [P('warlock', 'Curse of the Elements')] },
  { key: 'mark', name: 'Hunter’s Mark', kind: 'debuff', scope: 'target', text: 'More ranged attack power against the marked target.', providers: [P('hunter', "Hunter's Mark")] },
  { key: 'judgement', name: 'Judgement of Wisdom or Light', kind: 'debuff', scope: 'target', text: 'Attackers regain mana or health. Judgement no longer consumes the seal in Forever.', providers: [P('paladin', 'Seal of Wisdom'), P('paladin', 'Seal of Light')] },
  { key: 'crusader', name: 'Seal of the Crusader judgement', kind: 'debuff', scope: 'target', text: 'More Holy damage taken by the boss.', providers: [P('paladin', 'Seal of the Crusader')] },
  { key: 'demo', name: 'Attack power reduction', kind: 'debuff', scope: 'target', text: 'Demoralizing Shout or Demoralizing Roar makes the boss hit softer.', providers: [P('warrior', 'Demoralizing Shout'), P('druid', 'Demoralizing Roar')] },
  { key: 'tc', name: 'Thunder Clap', kind: 'debuff', scope: 'target', text: 'Slows the boss’s attack speed.', providers: [P('warrior', 'Thunder Clap')] },
  { key: 'weakness', name: 'Curse of Weakness', kind: 'debuff', scope: 'target', text: 'Lowers the boss’s attack power.', providers: [P('warlock', 'Curse of Weakness')] },
  { key: 'hitdown', name: 'Lower boss hit chance', kind: 'debuff', scope: 'target', text: 'Insect Swarm or Scorpid Sting make the boss miss more.', providers: [P('druid', 'Insect Swarm', ['balance'], 'talent'), P('hunter', 'Scorpid Sting')] },

  // Utility
  { key: 'decurse', name: 'Remove curses', kind: 'utility', scope: 'raid', text: 'Mages and druids remove curses.', providers: [P('mage', 'Remove Lesser Curse'), P('druid', 'Remove Curse')] },
  { key: 'dispel', name: 'Dispel magic', kind: 'utility', scope: 'raid', text: 'Priests and paladins remove harmful magic.', providers: [P('priest', 'Dispel Magic'), P('paladin', 'Cleanse')] },
  { key: 'poison', name: 'Cure poison', kind: 'utility', scope: 'raid', text: 'Shamans, druids and paladins remove poisons.', providers: [P('shaman', 'Cure Poison'), P('druid', 'Cure Poison'), P('paladin', 'Purify')] },
  { key: 'disease', name: 'Cure disease', kind: 'utility', scope: 'raid', text: 'Priests, shamans and paladins remove diseases.', providers: [P('priest', 'Cure Disease'), P('shaman', 'Cure Disease'), P('paladin', 'Purify')] },
  { key: 'tranq', name: 'Tranquilizing Shot', kind: 'utility', scope: 'target', text: 'Removes Frenzy effects from enemies.', providers: [P('hunter', 'Tranquilizing Shot')] },
  { key: 'fear', name: 'Fear protection', kind: 'utility', scope: 'party', text: 'Tremor Totem breaks fear for the shaman’s party.', providers: [P('shaman', 'Tremor Totem')] },
  { key: 'interrupt', name: 'Interrupts', kind: 'utility', scope: 'target', text: 'Kick, Pummel, Shield Bash, Counterspell and Earth Shock.', providers: [P('rogue', 'Kick'), P('warrior', 'Pummel'), P('warrior', 'Shield Bash'), P('mage', 'Counterspell'), P('shaman', 'Earth Shock')] },
  { key: 'bres', name: 'Battle resurrection', kind: 'utility', scope: 'raid', text: 'Rebirth in combat, or a Soulstone placed before the pull.', providers: [P('druid', 'Rebirth'), P('warlock', 'Create Soulstone')] },
  { key: 'summon', name: 'Summoning', kind: 'utility', scope: 'raid', text: 'Ritual of Summoning brings the late arrivals.', providers: [P('warlock', 'Ritual of Summoning')] },
  { key: 'cc', name: 'Crowd control', kind: 'utility', scope: 'target', text: 'Polymorph, Sap, Shackle Undead, Banish, Hibernate or Freezing Trap for trash packs.', providers: [P('mage', 'Polymorph'), P('rogue', 'Sap'), P('priest', 'Shackle Undead'), P('warlock', 'Banish'), P('druid', 'Hibernate'), P('hunter', 'Freezing Trap')] },
];

/** Party-wide effects that changed in Forever and no longer stack across players. */
export const PERSONAL_NOW = [
  { name: 'Shadow Weaving', cls: 'priest', text: 'now raises only the Shadow priest’s own damage' },
  { name: 'Improved Scorch', cls: 'mage', text: 'now raises only the Fire mage’s own damage' },
  { name: "Winter's Chill", cls: 'mage', text: 'now raises only the Frost mage’s own crit chance' },
  { name: 'Improved Shadow Bolt', cls: 'warlock', text: 'now raises only the warlock’s own Shadow damage' },
];

export const ROLE_TARGETS: Record<number, { tank: [number, number]; healer: [number, number] }> = {
  10: { tank: [2, 2], healer: [2, 3] },
  20: { tank: [2, 3], healer: [4, 5] },
  40: { tank: [3, 5], healer: [9, 12] },
};

export function provides(p: Provider, cls: string, spec: string) {
  return p.cls === cls && (!p.specs || p.specs.includes(spec));
}
