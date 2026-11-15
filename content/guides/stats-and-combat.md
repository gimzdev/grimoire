---
title: Stats, hit caps and scaling in Forever
description: How hit and crit work in World of Warcraft: Forever, the hit caps against raid bosses and in PvP, weapon skill and glancing blows, armor, resistances and defense, spell power coefficients class by class, and the healing bonus that also adds damage.
category: Systems
art: newPower
icon: inv_misc_book_11
updated: 2026-11-14
order: 14
---

Forever keeps Classic's stats but changes how several of them work. Hit and crit are each one stat for spells and attacks, healing gear also adds damage, weapon skill is rarer, and spell power makes up a bigger share of every spell. This page collects the numbers Grimoire's class guides and builds rely on. Blizzard confirmed the big rules at BlizzCon, the caps are what the character panel shows, and the one estimate on this page is marked as one.

## Hit

**One stat for everything.** Hit Chance covers melee, ranged and spell attacks alike, and it is a flat percentage, not a rating. Talents that name a school or an attack are the exceptions: Shadow Focus only covers Shadow spells and Furious Precision only off-hand attacks.

| Hit you need | Same level, and players | Raid boss (3 levels above you) |
| --- | --- | --- |
| Spells | 4% | 17% |
| Special attacks, ranged attacks and single-weapon auto attacks | 5% | 8% |
| Auto attacks while dual-wielding | about 24% | about 27% |

- The spell and attack caps are what the character panel shows with maxed weapon skill.
- **Estimate:** the dual-wield values and the glancing blows below follow Classic's formulas, because Blizzard has published neither for Forever. A second weapon adds about 19% to the miss chance of auto attacks only, so Sinister Strike, Bloodthirst and every other special attack still stop missing at 8%.
- Spells miss 4% of the time against your own level, 5% one level up and 6% two levels up, then 17% against a raid boss. Against targets far below you the miss chance bottoms out at 1%.
- Players count as your level, so 4% hit caps your spells in PvP and 5% your attacks. Forever has no resilience.
- Hit gear starts to drop around level 50, so talents carry you while you level.

| Class | Hit from talents |
| --- | --- |
| Druid | [[talent:druid:Nature's Reach]], 4% |
| Hunter | [[talent:hunter:Surefooted]], 3%; [[talent:hunter:Survival Tactics]], 10% with traps and Feign Death |
| Mage | [[talent:mage:Precision]], 6% with every spell |
| Paladin | [[talent:paladin:Precision]], 3%; [[talent:paladin:Divine Precision]], 8% with Holy spells |
| Priest | [[talent:priest:Shadow Focus]], 5% with Shadow spells; [[talent:priest:Holy Precision]], 18% with Holy spells |
| Rogue | [[talent:rogue:Precision]], 3% |
| Shaman | [[talent:shaman:Tidal Focus]], 5% |
| Warlock | [[talent:warlock:Suppression]], 5% |
| Warrior | [[talent:warrior:Furious Precision]], 10% with off-hand attacks |

Dwarves add 1% with [[racial:Artisan's Precision]].

## Critical strikes

- Crit is also one stat for spells and attacks. A melee or ranged crit deals 200% damage and a spell crit 150%, and talents raise that: the druid's Vengeance, Arcane Mind, Ice Shards, Elemental Fury, Shadowform, Ruin and Pandemic each double the crit bonus of the spells they name, damage over time included for Pandemic. Impale, Mortal Shots and Lethality add 20 to 30% to the bonus of attacks.
- Early in the beta, crits against players dealt only half their bonus. Since October 8 they deal full damage in PvP too.
- Auto attacks roll on one table: miss, dodge, parry and block from the front, glancing blows, then crit and hit. Once crit fills what misses and glancing blows leave, more crit adds nothing to auto attacks. That ceiling is far away for most characters, but dual-wielders reach it first.

## Weapon skill, expertise and glancing blows

- Weapon skill still matters, but items give much less of it than in Classic, and no racial adds weapon skill any more. Each point you are missing costs about 0.04% hit, 0.04% of the target's dodge and parry, and 0.04% crit.
- Only melee auto attacks glance, and only against targets above your level. Against a raid boss, 40% of auto attacks glance for 35% less damage at maxed skill: Classic's numbers, the estimate marked under Hit.
- **Expertise** is what guides call the items and talents that lower the chance your attacks are dodged or parried; Blizzard has not named the stat. A level 63 boss dodges about 6.5% of your attacks, and from the front it also parries about 14%. Damage dealers attack from behind, so 6.5% is their target, while tanks keep gaining up to 14%. Hit does nothing against dodges and parries, and [[talent:rogue:Weapon Expertise]] gives rogues 2%.

## Armor, resistances and defense

- Armor cuts physical damage by Armor / (Armor + 400 + 85 × the attacker's level), Classic's formula. Against a level 63 boss that is about 46% at 5,000 armor and the 75% maximum at about 17,265 armor.
- 315 of a resistance gives the 75% maximum against a raid boss's spells. There is no Holy resistance.
- 440 Defense makes raid bosses unable to crit you: 140 above a level 60 character's 300, of which Anticipation gives warrior and paladin tanks 20. Each point of Defense also adds 0.04% to your dodge, parry and block and to the chance you are missed. Druids' [[talent:druid:Thick Hide]] turns defense skill beyond five times your level into armor.
- Dodges and parries only work against attacks from the front. A parry speeds up your next swing.

## Spell power

**Coefficients.** A spell adds a share of your spell power, its coefficient: cast time ÷ 3.5 for a direct spell (at most 100%), so 42.9% for an instant or 1.5-second spell. Most damage over time spreads its share across the ticks, and area spells get much less.

**A bigger share than in Classic.** Forever's spells start from lower base damage, so spell power is a larger part of each hit. Shadow Bolt rank 10 averages 268 before gear (510 in Classic) and still adds 85.7% of your spell power.

**Low ranks.** A rank far below your level gets less of your spell power. Testers measure 5% less for each level once you are 18 levels past the rank. Since November 2 low ranks trigger talents normally again; only the mage's Blizzard, cast at a rank learned more than 12 levels ago, still triggers Arcane Concentration, Frostbite and Fingers of Frost less often.

These are the coefficients of the spells the class guides lean on, as the October beta client's spell data and the community's tooltip tables give them:

| Class | Spell power share |
| --- | --- |
| Druid | Wrath 57.1%, Starfire 100%, Moonfire 67%, Insect Swarm 94.8% |
| Paladin | Holy Light 71.4%, Flash of Light 42.9%, Holy Shock 42.9%, Light's Vigil 14.3%; Consecration 75% on the first four targets in it, none beyond |
| Priest | Mind Blast 42.9%, Mind Flay 50%, Shadow Word: Pain 120%, Devouring Plague 80%, Flash Heal 42.9% |
| Shaman | Lightning Bolt 71.4%, Chain Lightning 57.1% before its cast became 2.5 seconds, Healing Wave 85.7%, Chain Heal 71.4%, Lesser Healing Wave 43% |
| Warlock | Shadow Bolt 85.7%, Searing Pain and Shadowburn 42.9%, Incinerate 71.4%, Immolate 20% plus 65% over time, Conflagrate 42.9%, Corruption 120%, Bane of Agony about 160%, Bane of Doom 400%, Siphon Life and Drain Life 50%, Wrack 0.286 per second until Blizzard's hotfixes of November 10 cut its damage by 30% |

**Healing gear adds damage.** Bonus healing now also gives one third as much bonus damage: an item with 42 bonus healing shows 14 bonus damage. Healers keep some damage for questing, and a healer's gear still helps when they level as damage.

## Haste

Haste exists, from Wind Blessed (2%) and Berserking, but it is very rare on gear. It shortens casts and the global cooldown; damage over time keeps its tick speed.

## Attributes

These follow Classic's formulas; Blizzard has announced no change to them:

- **Strength:** 2 Attack Power for warriors, paladins, shamans and druids, 1 for everyone else, and 1 Block Value per 20 with a shield.
- **Agility:** 2 armor per point; 1% crit per 20 for warriors, paladins, shamans and druids, per 29 for rogues and per 53 for hunters; ranged Attack Power for hunters (2 per point), rogues and warriors (1); melee Attack Power for hunters, rogues and druids in Cat Form (1).
- **Intellect:** 15 mana per point, and about 1% spell crit per 60 at level 60.
- **Stamina:** 10 health per point. Warlock pets get 2 health per point of yours since November 2, down from 7.5, and about 15% more base health since November 10.
- **Attack Power:** 14 adds 1 damage per second to your weapon.

Every healer spec has a talent that keeps some mana regeneration going while you cast, which makes Spirit a working stat for all of them.
