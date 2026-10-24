/** Grimoire's own descriptions of classes, specs and races for Forever. */

export const CLASS_COPY: Record<string, { blurb: string; forever: string }> = {
  warrior: {
    blurb: 'Plate, rage and a weapon for every situation. Warriors tank with a shield, cleave with a two-hander or blur two one-handers into a whirlwind.',
    forever:
      'Weaponmaster replaces the four weapon specializations, Spearing Strike punishes Giants, Dragonkin and mounted foes, Whirlwind now strikes with both weapons, and Protection gains Vanguard, Master of Defense and Bastion. Victory Rush is a new trainer spell, and Tactical Mastery moved from the Arms tree to the trainer.',
  },
  paladin: {
    blurb: 'Holy warriors who heal, tank or crusade. Seals and Judgements carry the damage; blessings and auras carry the raid.',
    forever:
      'Forsaken can be Paladins and the class gains a tanking seal, Seal of Fury. Holy is built around Holy Shock and Light’s Vigil, Protection around Templar’s Bulwark and Holy Shield, and Retribution’s capstone Twist of Light turns seal swapping into a mechanic. Consecration and Blessing of Kings are trainer spells, and Holy Strike is a new baseline attack.',
  },
  hunter: {
    blurb: 'Ranged damage with a pet at your side. Hunters kite, trap and pull for the group, and in Forever, Survival fights in melee.',
    forever:
      'Beast Mastery adds Summon Hawk, Marksmanship gains Careful Aim, Lone Wolf and the Sniper Shot capstone, and Survival is rebuilt as a melee spec around Mongoose Bite, Strider Kick and Lacerating Strikes. Humans can now be Hunters.',
  },
  rogue: {
    blurb: 'Stealth, poisons and combo points. Rogues open from the shadows, control the fight with stuns and finish with burst.',
    forever:
      'Mutilate and Venom anchor Assassination. In Combat, Hack and Slash replaces the weapon specializations: axes and swords trigger extra attacks, daggers and fist weapons gain crit, maces ignore armor. Subtlety builds toward Thousand Cuts, Cutthroat and Quietus.',
  },
  priest: {
    blurb: 'The deepest healing toolkit in the game, or a shadow caster who drains the life out of anything that stands still.',
    forever:
      'Discipline gains Penance, Divine Aegis and Renewed Hope; Holy ends in Prayer of Mending with Binding Heal and Litany of Light on the way; Shadow gets Improved Mind Flay, Devouring Contagion and Early Demise. Shadow Word: Death is a new trainer spell, the trainer lists new priest spells such as Chastise and Contingency Plan, and Divine Spirit left the trees for the trainer. Gnomes can be Priests.',
  },
  shaman: {
    blurb: 'Totems, shocks and earth-shaking heals. Shamans cast lightning, swing two-handers with Windfury or heal through chains of water.',
    forever:
      'Dwarves can now be Shamans, so the class is no longer Horde-only. Elemental gains Lava Burst and Lightning Overload, Enhancement gains Maelstrom Weapon, Mental Dexterity and Rage of the Farseer, and Restoration gains Water Shield and Riptide. Totem bars (Call of the Elements, Ancestors and Spirits) and Totemic Recall arrive as trainer spells.',
  },
  mage: {
    blurb: 'Glass-cannon casters who conjure food, open portals and bring Frost, Fire or raw Arcane to bear.',
    forever:
      'Arcane Blast and Missile Barrage reshape Arcane, Heating Up makes Pyroblast part of the Fire rotation, and Frost gains Ice Lance and Fingers of Frost. Frostfire Bolt and Frost Blast are new trainer spells, and Alliance mages get Teleport: Dalaran at 50. Orcs can now be Mages, and the High Order Skyborne bring the class to a new race.',
  },
  warlock: {
    blurb: 'Demons, curses and fire. Warlocks drain, dot and summon, trading health for mana and fear for control.',
    forever:
      'The most rebuilt class in Forever: Curses of Agony and Doom become Banes, Affliction ends in Wrack, Demonology in Demonic Pact and Destruction in Incinerate. Trolls can now be Warlocks.',
  },
  druid: {
    blurb: 'The shapeshifter. Druids tank as a bear, strike as a cat, cast as a moonkin or heal with growing things, sometimes all in one evening.',
    forever:
      'Balance adds Eclipse, Genesis and Nature’s Majesty, Feral gains Primal Bite, Shifting Power and the Berserk capstone, and Restoration ends in Wild Growth. Omen of Clarity and Nature’s Grasp are now trainer spells, and the Skyborne bring new druid forms.',
  },
};

export const SPEC_COPY: Record<string, string> = {
  'warrior/arms': 'Big two-handed swings, Mortal Strike and Weaponmaster bonuses for your weapon type.',
  'warrior/fury': 'Dual-wield Bloodthirst and Whirlwind, with Flurry and Death Wish for burst.',
  'warrior/protection': 'Shield tanking scaled by Block Value: Shield Slam, Bastion and Master of Defense.',
  'paladin/holy': 'Flash of Light, Holy Light and Holy Shock, with Light’s Vigil turning a Shock into a party heal.',
  'paladin/protection': 'Seal of Fury, Holy Shield and a full-health absorb on Templar’s Bulwark.',
  'paladin/retribution': 'Two-handed seal twisting, now an actual talent in Twist of Light.',
  'hunter/beast-mastery': 'Your pet and your hawks do half the work; Bestial Wrath turns the pet loose.',
  'hunter/marksmanship': 'Shots, stings and Sniper Shot, with Careful Aim converting Intellect into Attack Power.',
  'hunter/survival': 'A melee hunter: Mongoose Bite, Strider Kick and bleeding wounds from Lacerating Strikes.',
  'rogue/assassination': 'Mutilate for combo points, Seal Fate for more, Venom to supercharge your poisons.',
  'rogue/combat': 'Sinister Strike and Eviscerate with sword or axe bonuses from Hack and Slash.',
  'rogue/subtlety': 'Hemorrhage and Rupture, with Thousand Cuts making Hemorrhage and Backstab cheaper.',
  'priest/discipline': 'Shields, Penance and Divine Aegis: prevent damage instead of healing it.',
  'priest/holy': 'Raw throughput, Prayer of Mending and Binding Heal.',
  'priest/shadow': 'Shadowform, Mind Flay and Shadow Word: Death, with Shadow Weaving stacking up your own Shadow damage.',
  'shaman/elemental': 'Lightning Bolt, Lava Burst and Lightning Overload.',
  'shaman/enhancement': 'Windfury and Stormstrike, with Maelstrom Weapon for instant bolts.',
  'shaman/restoration': 'Chain Heal and Riptide, totems for the group, Water Shield for mana.',
  'mage/arcane': 'Arcane Blast stacks and Missile Barrage, with Arcane Power for burst.',
  'mage/fire': 'Fireball and Scorch crits feeding Heating Up and Combustion.',
  'mage/frost': 'Frostbolt, Ice Lance and Fingers of Frost; the safest leveling spec.',
  'warlock/affliction': 'Banes, Corruption and Wrack ticking every second.',
  'warlock/demonology': 'Demonic Sacrifice that you keep, with Demonic Pact and a demon still at your side.',
  'warlock/destruction': 'Conflagrate, Shadowburn and Incinerate, with Shadow and Flame linking the schools.',
  'druid/balance': 'Wrath and Starfire tied together by Eclipse, in Moonkin Form.',
  'druid/feral': 'Cat damage or bear tanking from one tree, ending in Berserk.',
  'druid/restoration': 'Rejuvenation, Swiftmend and Wild Growth, with a shorter global cooldown on the core heals.',
};

export const RACE_COPY: Record<string, string> = {
  human: 'Stormwind’s people, now able to be Hunters. Will to Survive breaks stuns and Perception reveals stealth.',
  dwarf: 'Ironforge’s mountain folk. In Forever they can walk the path of the Shaman for the first time.',
  'night-elf': 'Teldrassil’s sentinels. Elune’s Light is a new 15-second crit cooldown alongside Shadowmeld.',
  gnome: 'Gnomeregan’s inventors, now able to become Priests. Eureka! makes their damaging spells and abilities cheaper and 10% stronger for 8 seconds.',
  'high-order-skyborne': 'Highborne scholars of Eldre’Thalas reclaiming their arcane legacy for the Alliance. They glide on Walk on Air and tap leylines for regeneration.',
  orc: 'Durotar’s warriors, now able to be Mages. Shatter Curse strips curses and banes and softens magic damage, alongside Blood Fury.',
  undead: 'The Forsaken of Lordaeron, now able to be Paladins. Touch of the Grave drains health with spells and attacks.',
  tauren: 'Mulgore’s herdsmen. Plainsrunning speeds them up the longer they keep moving.',
  troll: 'The Darkspear, now able to be Warlocks. Rapid Regeneration restores half their health over time.',
  'windshaper-skyborne': 'Shen’dorei who keep faith with the wind spirits, joining the Horde. They glide on Walk on Air and use Skysight to ride elemental blessings.',
};
