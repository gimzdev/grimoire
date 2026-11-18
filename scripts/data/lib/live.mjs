// What Blizzard has changed that the talentsforever.com export does not carry, and what its hotfix list since launch changes in
// the rest of Grimoire's data. The export of 10 November 2026 (client build 1.60.1.70755 with the server's hotfixes, up to
// 10 November for the Hunter, Shaman and Warlock) already has the class changes a tooltip shows. This adds:
//
//   - from Blizzard's "WoW: Forever Hotfixes" list (news.blizzard.com/en-us/article/24315281, the entries of 5 to 17
//     November; it has none for 7, 8, 12, 14 and 15): the rules no tooltip shows (Incinerate for Destruction only, Nature's Swiftness on Wild Growth, the pets'
//     health, Bane of Havoc on the global cooldown, ranged Judgement, Frost Nova and Blizzard, Wild Growth on the move and the
//     rest), a quest's turn-in, quests' facts, a creature's level, an item and the leveling guide's note on dungeons;
//   - one fact read from the client of 13 November by foreverchanges.pro, which Blizzard has not posted (Wild Growth's ranks
//     share one cooldown), labelled as client data;
//   - from Blizzard's beta development notes, three facts no tooltip carries: how Attack Power adds to two poisons, Eureka! in
//     stealth and the player level Cultivation needs.
//
// build.mjs calls it before writing; scripts/data/live.mjs and scripts/data/classes.mjs do the same to a finished data/.
// Only what Blizzard states is taken over. Fixes that change nothing Grimoire shows (a respawn, a loot bug, the Cooldown
// Manager) are left out. Every edit looks for what it replaces first, so a second run changes nothing.

export const LIVE = { name: 'Blizzard’s WoW: Forever hotfixes', url: 'https://news.blizzard.com/en-us/article/24315281', date: '2026-11-17' };
/** The live client build the data is checked against: 1.60.1.70959 replaced 1.60.1.70938 (live from 13 November) with the
 * weekly maintenance of 17 November, 18 in Europe (wowforevertalents.com's patch notes of 18 November name it). */
export const LIVE_BUILD = '1.60.1.70959';

// The class data writes Blizzard's with a straight apostrophe, the site's notes (quests, the guide) with a curly one.
const HF = (day) => `Blizzard's hotfixes of ${day} November`;
const HF_NOTE = (day) => `Blizzard’s hotfixes of ${day} November`;
const NOTES = (date) => `Blizzard's development notes of ${date}`;

/** Wordings the list corrects: [class, ability, old piece, new piece]. */
export const SPELL_TEXT = [
  // 6 November: "Fixed the tooltip for Swiftmend to no longer incorrectly mention consuming the effect." (the export has it)
  ['druid', 'Swiftmend', 'the full duration of the periodic effect of the consumed spell.', 'the full duration of the periodic effect.'],
];

/** A line for every rank of an ability: [class, ability, line]. */
export const SPELL_LINES = [
  ['warlock', 'Incinerate', `Destruction only: ${HF(9)} closed it to the other specializations.`],
  ['warlock', 'Summon Imp', `Since ${HF(10)}, the Imp has about 15% more base health, and the first four ranks of its Firebolt deal more base damage.`],
  ['warlock', 'Summon Voidwalker', `Since ${HF(6)}, the Voidwalker has about 40 more base health at every level, and since those of 10 November about 15% more again.`],
  ['warlock', 'Summon Succubus', `Since ${HF(10)}, the Succubus has about 15% more base health.`],
  ['warlock', 'Summon Incubus', `Since ${HF(10)}, the Incubus has about 15% more base health.`],
  ['warlock', 'Bane of Havoc', `Since ${HF(10)}, it triggers the global cooldown.`],
  ['druid', "Nature's Swiftness", `Since ${HF(10)}, it also makes Wild Growth instant.`],
  ['hunter', 'Tame Beast', `Since ${HF(10)}, a pet has 115% of its normal health; it had 150% by mistake.`],
  ['hunter', 'Summon Hawk', `Since ${HF(10)}, the hawks deal about 80% more melee damage.`],
  ['shaman', 'Windfury Totem', `Since ${HF(10)}, it works together with a Shaman's weapon imbue.`],
  ['shaman', 'Flametongue Totem', `Since ${HF(10)}, it works together with a Shaman's weapon imbue.`],
  // The client's tooltips still say the imbue turns the matching totem off for you; the hotfix changed that.
  ['shaman', 'Windfury Weapon', `Since ${HF(10)}, a Windfury Totem works for you as well: your attacks get a chance at both.`],
  ['shaman', 'Flametongue Weapon', `Since ${HF(10)}, a Flametongue Totem works for you as well.`],
  ['warrior', 'Sweeping Strikes', `Since ${HF(10)}, a swing that hits no second target keeps its charge.`],
  // 9 November
  ['priest', 'Shadowform', `Since ${HF(9)}, casting Fear Ward no longer ends it.`],
  ['hunter', 'Tame Beast', `Since ${HF(9)}, Vulgara the Insatiable and the Shrieklings of Zephras belong to the right pet families.`],
  // 11 November
  ['paladin', 'Judgement', `Since ${HF(11)}, it is a ranged attack: it uses your ranged hit chance and no longer triggers melee procs. Since those of 13 November, Judgement of Command is a melee attack again and triggers on-hit effects; the other Judgements stay ranged.`],
  ['paladin', 'Seal of Command', `Since ${HF(13)}, its Judgement is a melee attack again: it uses your melee hit chance and triggers on-hit effects.`],
  ['hunter', 'Volley', `Since ${HF(11)}, it no longer triggers procs and stops when you move.`],
  ['priest', 'Confounding Flash', `Since ${HF(11)}, it can be used in Shadowform.`],
  ['shaman', 'Flametongue Totem', `Rank 2 works since ${HF(11)}.`],
  // 13 November
  ['mage', 'Frost Nova', `Since ${HF(13)}, Blizzard's damage and damage from procs break the freeze too.`],
  ['druid', 'Wild Growth', `Since ${HF(13)}, it cannot be cast while moving, and it gains 6.6% of your healing power (was 3.3%).`],
  ['druid', 'Wild Growth', 'Client data (build 1.60.1.70938, read by foreverchanges.pro on 13 November, not in Blizzard’s notes): its three ranks share one cooldown.'],
  ['shaman', 'Windfury Totem', `Since ${HF(13)}, it triggers from every melee ability: the main-hand strike of an ability can trigger it, the off-hand strike (Whirlwind, Mutilate) cannot.`],
  ['warlock', 'Siphon Life', `Since ${HF(13)}, rank 1 can no longer be cast while silenced.`],
  ['warrior', 'Berserker Rage', `Since ${HF(13)}, it also removes Sap.`],
  ['priest', 'Divine Spirit', `Since ${HF(13)}, the Legacy perk The Quick and the Dead lowers its mana cost as it should.`],
  // 16 November
  ['druid', 'Wild Growth', `Since ${HF(16)}, each of its ranks goes on cooldown as it should.`],
  [
    'priest',
    'Vampiric Embrace',
    "Blizzard's hotfix notes of 16 November, for the weekly maintenance of 17 November (18 in Europe): party members are healed for 10% of your Shadow damage (was 20%), and you receive twice as much from it, so a Priest alone loses nothing. On 18 November the client's own files still read 20% (wowforevertalents.com).",
  ],
  ['rogue', 'Shank', `Since ${HF(16)}, using it on a target without your combo points no longer removes the combo points you have on other targets.`],
  [
    'shaman',
    'Windfury Totem',
    `Since ${HF(16)}, its extra attacks no longer ignore armor, have an internal cooldown and generate Rage; Mutilate and Execute get no second try at it, and Shield Slam, Shield Bash and a Holy Strike empowered by Shieldworn cannot trigger it.`,
  ],
  ['warrior', 'Cleave', `Since ${HF(16)}, it activates Unbridled Wrath and Reckless Swings and no longer uses up Flurry.`],
  ['warrior', 'Heroic Strike', `Since ${HF(16)}, it activates Unbridled Wrath and Reckless Swings and no longer uses up Flurry.`],
  ['rogue', 'Deadly Poison', `Since ${NOTES('2 November')}, Attack Power adds twice as much to it (0.009 per point, was 0.0045).`],
  ['rogue', 'Instant Poison', `Since ${NOTES('2 November')}, Attack Power adds twice as much to it (0.01 per point, was 0.005).`],
];

/** A sentence added to every rank of a talent: [class, talent, sentence]. */
export const TALENT_LINES = [
  // 6 November: "Fixed the tooltip for Reckless Swings to mention that it activates Gore Drinker."
  ['warrior', 'Reckless Swings', 'Also activates Gore Drinker.'],
  ['warrior', 'Sweeping Strikes', `A swing that hits no second target keeps its charge (${HF(10)}).`],
  [
    'mage',
    'Arcane Concentration',
    `A spell that hits more than once, like Arcane Missiles, splits this chance between its cast and its bolts (${HF(9)}; it gave the full chance on the cast and on every bolt).`,
  ],
  ['druid', "Nature's Swiftness", `It also makes Wild Growth instant (${HF(10)}).`],
  ['paladin', 'Consecrated Ground', `It keeps working after an enemy inside the Consecration dies or despawns (${HF(9)}).`],
  ['druid', 'Rend and Tear', `Pounce's bleed counts (${HF(11)}).`],
  ['priest', 'Twilight Focus', `It works in Shadowform too (${HF(11)}).`],
  ['paladin', 'Unsealed Wrath', `Its stored seals no longer echo from Windfury Totem attacks (${HF(11)}, which call the talent Unsealed Fury).`],
  ['druid', 'Wild Growth', `It cannot be cast while moving and gains 6.6% of your healing power, was 3.3% (${HF(13)}).`],
  ['warlock', 'Siphon Life', `Rank 1 can no longer be cast while silenced (${HF(13)}).`],
  // 16 November
  ['druid', 'Wild Growth', `Each of its ranks goes on cooldown as it should (${HF(16)}).`],
  ['druid', 'Genesis', `It also raises the damage of Pounce's bleed (${HF(16)}).`],
  ['priest', 'Dark Inspiration', `It no longer stacks when several Shadow Priests are in the party (${HF(16)}).`],
  [
    'priest',
    'Vampiric Embrace',
    "Blizzard's hotfix notes of 16 November, for the weekly maintenance of 17 November (18 in Europe): party members are healed for 10%, was 20%, and you receive twice as much, so a Priest alone loses nothing. On 18 November the client's own files still read 20% (wowforevertalents.com).",
  ],
  ['shaman', 'Maelstrom Weapon', `It can no longer benefit two casts (${HF(16)}).`],
  ['shaman', 'Thundering Strikes', `Its critical strike chance no longer needs a weapon equipped (${HF(16)}).`],
  ['warrior', 'Unbridled Wrath', `Cleave and Heroic Strike activate it too (${HF(16)}).`],
  ['warrior', 'Flurry', `Cleave and Heroic Strike no longer use up its stacks (${HF(16)}).`],
  ['warrior', 'Reckless Swings', `Cleave and Heroic Strike activate it too (${HF(16)}).`],
  // 17 November
  ['shaman', 'Flurry', `Windfury Totem attacks no longer use up its stacks (${HF(17)}).`],
];

/** A racial's wording replaced: [racial, old piece, new piece]. */
export const RACIAL_TEXT = [
  // Blizzard's notes of 15 October, in place of a remark of the export's about the Mage tooltip.
  ['Eureka!', " The Mage's own tooltip is the one that leaves out non-periodic.", ' It cannot be used in stealth or invisibility.'],
  // Blizzard's notes of 24 September, which the client tooltip does not carry.
  [
    'Cultivation',
    'Each herb may only be cultivated once.',
    "Each herb may only be cultivated once, and only from the player level of the herb's Herbalism requirement divided by 5 (level 60 for herbs that need more than 300 skill).",
  ],
];

/** A sentence added to a racial: [racial, sentence]. */
export const RACIAL_LINES = [
  ['Plainsrunning', `In a battleground it no longer builds up during the preparation phase or while you carry a flag, and picking one up ends it (${HF(5)}).`],
  ['Cultivation', `Since ${HF(9)}, the cooldown starts only once the cast completes.`],
  ['Cultivation', `Since ${HF(17)}, it works on Mageroyal.`],
];

/** Quest facts the list changes: [quest id, field, old value, new value]. */
export const QUESTS = [
  [2039, 'z', 1537, 38], // 9 November: "Find Bingles" is filed under Loch Modan, not Ironforge
  [97288, 'r', 0, 15], // 6 November: the Baron's Abominable Head offers "Unending Torment" to the Horde from level 15 (was 16)
  // 17 November: "The Battle for Alterac Valley quests now require level 58 to accept." (Classic's asked for 51)
  [1878, 'xp', 380, 0], // 16 November: "The repeatable quest Water Pouch Bounty no longer grants experience."
  [7141, 'r', 51, 58], // The Battle of Alterac
  [7142, 'r', 51, 58], // The Battle for Alterac
];

/** A line in a quest's "What Forever changed" box: [quest id, line]. */
export const QUEST_NOTES = [
  // 17 November
  [7141, `Since ${HF_NOTE(17)} it asks for level 58, like the other Battle for Alterac Valley quests.`], // The Battle of Alterac
  [7142, `Since ${HF_NOTE(17)} it asks for level 58, like the other Battle for Alterac Valley quests.`], // The Battle for Alterac
  [6681, `Since ${HF_NOTE(17)} Mathias Shaw has the letter for it again.`], // The Manor, Ravenholdt
  [94483, `Since ${HF_NOTE(17)} it shows on your map as it should.`], // Show Them How It's Done
  [275, `Since ${HF_NOTE(17)} more Fen Creepers are out in the Wetlands for it.`], // Blisters on the Land
  [95183, `Since ${HF_NOTE(17)} its rock piles are tracked by Find Minerals while you are on it (it was Find Treasure).`], // Step One: Rock
  [1153, `Since ${HF_NOTE(17)} more Gravelsnout Diggers and Surveyors are out for it.`], // A New Ore Sample
  [96018, `Since ${HF_NOTE(17)} a pylon you repair counts for party members nearby.`], // Powering the Pylons
  [93125, `Since ${HF_NOTE(17)} Rokren runs more slowly, so he is easier to keep up with.`], // Going Home
  [93604, `Since ${HF_NOTE(17)} it is no longer a dungeon quest: it can be done in the elite area outside Razorfen Downs.`], // Agamaggan's Blood
  [2756, `Since ${HF_NOTE(17)} it gives the Orcish War Leggings plans as an item; if you did not get them or lost them, Sumi in the blacksmithing hut nearby has a replacement once the quest is done.`], // The Old Ways
  [95975, `Since ${HF_NOTE(17)} Find Herbs tracks its wildflowers only while you are on the quest.`], // Her World
  // 16 November
  [80411, `Since ${HF_NOTE(16)} Witch Doctor Zum’rah spawns for it as he should; those of 13 November fixed rogues entering the wrong version of Zul’Farrak.`], // The Talisman of Kazdor
  [94888, `Since ${HF_NOTE(16)} a scout prisoner freed in Twilight’s Shroud counts for the whole party.`], // No Soldier Left Behind
  [3520, `Since ${HF_NOTE(16)} its Vale Screamers are on the coast of the Isle of Dread.`], // Screecher Spirits
  [1878, `Since ${HF_NOTE(16)} this repeatable quest gives no experience.`], // Water Pouch Bounty, the one you can repeat
  [95198, `Since ${HF_NOTE(16)} it can no longer get stuck.`], // The Return of the King?
  [96334, `Since ${HF_NOTE(16)} Blood Red Bandanas drop more often.`], // Blood Red Bandanas
  [97968, `Since ${HF_NOTE(10)} it is handed in at Shen’dar Village, not Valanaar.`], // Camping 101: Herbalism (Zephras Isle)
  // 13 November
  [2987, `Several of its problems were fixed in ${HF_NOTE(13)}.`], // Gordunni Cobalt
  // 11 November
  [5096, `Since ${HF_NOTE(11)} you can use the Command Tent again.`], // Scarlet Diversions
  [2969, `Since ${HF_NOTE(11)} the Cage Door resets as it should.`], // Freedom for All Creatures
  // 10 November
  ...[63, 96, 100, 220, 1103, 1528, 1529, 1530, 1534, 1535, 1536, 2985, 2986, 94494, 94495, 94497, 94499, 94500, 94501, 94502, 94503, 94505].map((id) => [id, `Since ${HF_NOTE(10)} the events at the end of the Call of Water quests play out every time.`]),
  [2842, `Since ${HF_NOTE(10)} Sovik offers it once you pick his gossip option.`], // Chief Engineer Scooty
  [2767, `It could not be started at launch; ${HF_NOTE(10)} fixed that.`], // Rescue OOX-22/FE!
  ...[173, 221, 222, 223].map((id) => [id, `Since ${HF_NOTE(10)} more Nightbane Vile Fangs and Nightbane Tainted Ones are out for these quests.`]), // Worgen in the Woods
  // 9 November
  ...[3631, 4487, 4488, 4489, 4490].map((id) => [id, `Since ${HF_NOTE(9)} finishing it also teaches the riding skill. If you finished it before, summon the Felsteed once to get it.`]), // Summon Felsteed
  [91740, `Since ${HF_NOTE(9)} the head drops for everyone in the party.`], // Croaky’s Head
  [91746, `Since ${HF_NOTE(9)} the head drops for everyone in the party.`], // Elmpaw’s Head
  ...[1886, 1899].map((id) => [id, `Since ${HF_NOTE(9)} mistreating Astor Hadren angers him, so you can fight him.`]), // The Deathstalkers
  [95508, `Since ${HF_NOTE(9)} Terry Longdrink no longer stays alive by mistake during it.`], // Unwelcome Guests
  [1100, `Since ${HF_NOTE(9)} Henrig Lonebrow’s Journal respawns more quickly, so more players can start it.`], // Lonebrow's Journal
  [2478, `Since ${HF_NOTE(9)} it can be restarted if you fail it.`], // Mission: Possible But Not Probable
  // 6 November
  [6641, `Since ${HF_NOTE(6)} Vorsha no longer lashes everyone in the zone.`], // Vorsha the Lasher
  [5321, `Since ${HF_NOTE(6)} Kerlonian Evershade falls asleep less often.`], // The Sleeper Has Awakened
  [91751, `Since ${HF_NOTE(6)} the quest is cancelled if you unlearn Skinning.`], // Rough Wolf Pelts
  [90902, `Since ${HF_NOTE(6)} the people it asks you to heal can always be healed.`], // Rediscovering the Light
  [5541, `Since ${HF_NOTE(6)} its loot shows even right after another player looted.`], // Ammo for Rumbleshot
  [95212, `Since ${HF_NOTE(6)} its creatures and quest items are more plentiful.`], // Never Saddle on Quality
  // 5 November
  [98391, `Its text was corrected in ${HF_NOTE(5)}.`], // The Sisterhood of Elune
  [435, `Since ${HF_NOTE(5)} Deathstalker Erland comes back much sooner after someone else escorted him.`], // Escorting Erland
];

/** Creature levels the list gives: [creature id, old [lo, hi], new [lo, hi]]. */
export const NPCS = [
  [9162, [49, 50], [51, 52]], // 9 November: Young Diemetradons are level 51 to 52 in Forever
];

/** The leveling guide's note on dungeons (lib/forever.mjs writes the new one): [old, new]. */
export const GUIDE_TEXT = [
  [
    'Forever pays most of a dungeon’s experience through its quests, and most of that on the first run. Take all of its quests before you go in, run it once, then carry on questing: a second run is no faster than the world.',
    'Forever pays most of a dungeon’s experience through its quests, and most of that on the first run, though since Blizzard’s hotfixes of 9 November every kill inside pays 50% more. Take all of its quests before you go in, run it once, then carry on questing.',
  ],
  [
    'and most of that on the first run, though since Blizzard’s hotfixes of 9 November every kill inside pays 50% more. Take all of its quests',
    'and most of that on the first run. Since Blizzard’s hotfixes of 9 November every kill inside pays 50% more, and since those of 13 November a kill pays no one when the enemy is trivial to anyone in the group, so a high-level friend can no longer pull you through for experience. Take all of its quests',
  ],
];

const addLine = (desc, line) => (desc.includes(line) ? desc : `${desc}\n\n${line}`);
const addSentence = (desc, s) => (desc.includes(s) ? desc : `${desc} ${s}`);

/** Every string in a JSON value, rewritten by fn. */
function rewrite(value, fn) {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => rewrite(v, fn));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v, fn)]));
  return value;
}

/**
 * Applies the lists to the data in place and returns what it changed (nothing the second time).
 * @param d { abilities, talents, races, quests, npcs, guide } as in data/
 */
export function applyLive(d) {
  const done = [];
  const abilities = (cls, name) => {
    const list = d.abilities[cls].filter((a) => a.name === name);
    if (!list.length) throw new Error(`live: ${cls} has no ${name}`);
    return list;
  };
  for (const [cls, name, from, to] of SPELL_TEXT) {
    for (const a of abilities(cls, name)) {
      if (!a.desc.includes(from)) continue;
      a.desc = a.desc.replace(from, to);
      done.push(`${cls}/${name}: wording`);
    }
  }
  for (const [cls, name, line] of SPELL_LINES) {
    for (const a of abilities(cls, name)) {
      const next = addLine(a.desc, line);
      if (next === a.desc) continue;
      a.desc = next;
      done.push(`${cls}/${name}${a.rank ? ` (${a.rank})` : ''}: line`);
    }
  }
  for (const [cls, name, sentence] of TALENT_LINES) {
    const t = d.talents[cls].trees.flatMap((tree) => tree.talents).find((x) => x.name === name);
    if (!t) throw new Error(`live: ${cls} has no talent ${name}`);
    const next = t.desc.map((x) => addSentence(x, sentence));
    if (next.every((x, i) => x === t.desc[i])) continue;
    t.desc = next;
    done.push(`${cls}/${name}: talent`);
  }
  const racials = (name) => {
    const found = d.races.flatMap((r) => r.racials).filter((x) => x.name === name);
    if (!found.length) throw new Error(`live: no racial ${name}`);
    return found;
  };
  for (const [name, from, to] of RACIAL_TEXT) {
    for (const x of racials(name)) {
      if (!x.desc.includes(from)) continue;
      x.desc = x.desc.replace(from, to);
      done.push(`racial/${name}: wording`);
    }
  }
  for (const [name, sentence] of RACIAL_LINES) {
    for (const x of racials(name)) {
      const next = addSentence(x.desc, sentence);
      if (next === x.desc) continue;
      x.desc = next;
      done.push(`racial/${name}`);
    }
  }
  const quest = (id) => {
    const q = d.quests.find((x) => x.i === id);
    if (!q) throw new Error(`live: no quest ${id}`);
    return q;
  };
  for (const [id, field, from, to] of QUESTS) {
    const q = quest(id);
    if ((q[field] ?? 0) !== from) continue;
    q[field] = to;
    done.push(`quest ${id} (${q.n}): ${field} ${from} -> ${to}`);
  }
  for (const [id, line] of QUEST_NOTES) {
    const q = quest(id);
    if (q.cl?.includes(line)) continue;
    q.cl = [...(q.cl ?? []), line];
    done.push(`quest ${id} (${q.n}): note`);
  }
  for (const [id, from, to] of NPCS) {
    const n = d.npcs[String(id)];
    if (!n) throw new Error(`live: no creature ${id}`);
    if (n[2] !== from[0] || n[3] !== from[1]) continue;
    [n[2], n[3]] = to;
    done.push(`creature ${id} (${n[0]}): level ${to.join('-')}`);
  }
  if (d.guide) {
    let n = 0;
    const next = rewrite(d.guide, (s) => GUIDE_TEXT.reduce((t, [from, to]) => (t.includes(from) ? (n++, t.replace(from, to)) : t), s));
    if (n) {
      Object.assign(d.guide, next);
      done.push(`guide: ${n} notes on dungeons`);
    }
  }
  return done;
}

/** data/meta.json: the hotfix list as a source, the date the data goes up to and the live client build it was checked on. */
export function liveMeta(meta) {
  meta.sources.hotfixes = { ...LIVE };
  if (meta.extracted < LIVE.date) meta.extracted = LIVE.date;
  // the newer of the export's build and the live one (1.60.1.70755 < 1.60.1.70938)
  const n = (b) => String(b ?? '').split('.').map(Number);
  const newer = n(LIVE_BUILD).some((x, i) => x !== n(meta.build)[i]) && n(LIVE_BUILD).find((x, i) => x !== n(meta.build)[i]) > n(meta.build)[n(LIVE_BUILD).findIndex((x, i) => x !== n(meta.build)[i])];
  if (!meta.build || newer) meta.build = LIVE_BUILD;
}
