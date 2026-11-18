# Changelog

## 1.0.8

A map for every creature, quest and zone on the site, the arrow to any point of them in game, Blizzard's hotfixes of
November 16 and 17, QuestieDB 1.1.3 and the leveling routes worked out again on it.

- **/grim go.** On wowgrimoire.app, every creature page now has a map of where it stands, every quest page a map of
  who gives it, who takes it and where what it asks for is found, and every zone page a map of its flight masters,
  innkeepers, repairs, rares, quest givers, vendors and trainers. Click a point, then "Copy for the add-on", and paste
  the line in the game's chat: `/grim go 12 48.9 36.4 Kobold Vermin`. The guide's arrow and the map pin lead you there,
  as they do for a rare's spot. `/grim go off`, or Current in the guide's window, goes back to your route. It works in
  every zone the leveling guide knows.
- **Hotfixes of November 16 and 17.** Spell and talent pages carry Blizzard's fixes: Windfury Totem's extra attacks no
  longer ignore armor and have an internal cooldown; Cleave and Heroic Strike activate Unbridled Wrath and Reckless
  Swings and no longer use up Flurry; Vampiric Embrace heals the party for 10% with the weekly maintenance (the Priest
  still gets 20%); each rank of Wild Growth goes on cooldown; Genesis raises Pounce's bleed; Cultivation works on
  Mageroyal. 18 quests carry a note on what changed, and the Battle for Alterac Valley quests ask for level 58. The
  guides (/grim guides) say that Upper Blackrock Spire is back at its intended difficulty, that Soulforge Armor has
  Spell Power in place of Strength, and how the Cozy Sleeping Bag and the Fishing Rack changed. The live client is
  build 1.60.1.70959 since the maintenance of November 17.
- **QuestieDB 1.1.3.** Its traces of November 17: 1,733 of Forever's own quests (67 new), with 74 more creatures, 9
  objects and 21 items they name.
- **Routes.** All 56 leveling routes were worked out again on it. 535 of Forever's quests are on at least one route
  (505), between 166 and 270 on each. Together the routes grind 287.5 levels (293.4), and a median route takes 85.6
  hours (86.5): 43 routes are shorter, 4 take as long and 9 are longer, by 1.3 hours at most. Eight routes took another
  of the engine's rules to stay within what they were as released.
- **Add-on code.** One new command, `/grim go`, in the slash handler. Nothing else changed in the Lua.

## 1.0.7

Leveling routes that cross to the other continent rather than grind, the cost of training as Blizzard states it, zone
levels worked out from each zone's quests and creatures, the site's heaviest pages at about half their weight, and a
title of its own for every page.

- **Routes that stay across the sea.** Rather than kill its way through more than a third of a level, a leveling route
  now crosses to the other continent when its zones together hold a level of quests or more, and stays there while
  they last. 53 of the 56 routes changed. Together they grind 293.4 levels where they ground 479.7, in 848 grind steps
  (955), 324 of them longer than a third of a level (613). A median route grinds 5.15 levels (8.66) and takes 86.5
  hours (88.7), with 76 visits (62) and 15.5 changes of continent (12). No route takes longer than in 1.0.6 and none
  grinds more. Three routes keep their 1.0.6 steps (Human Warrior, Human Hunter, Orc Mage): every other way worked
  out for them is slower or grinds longer in a row.
- **The Orc and Troll Shaman's 30s.** Hillsbrad at 30, Arathi at 31, Stranglethorn at 32: levels 30 to 33 were 3.1
  levels of grinding and are 0.3.
- **Shen'dralas.** 28 routes go into Shen'dralas at 38 to 44. The way in is the Gelkis's quests in Desolace, which the
  routes now take; the step reads "Kill Magram Clan Centaur (about 50) until your reputation with Gelkis Clan Centaur is
  Friendly". Each route's note says whether it goes in.
- **Route pages.** A level belongs to one page of a route: "10 to 20", then "21 to 29".
- **Add-on.** The add-on carries the same routes. Its code did not change, apart from the version it names.
- **Training costs.** Training every class ability from 1 to 60 costs between 206 and 207 gold, the same for every
  class; a Warlock pays less than that at the trainer, by what the demons' Grimoires are expected to cost (Blizzard's
  development notes of November 2). The site's Trainer abilities page gave Classic's price for each rank, which adds
  up to 131 gold for a Warlock and 220 for a Priest: it now gives Blizzard's total and no price per rank, because no
  open data has Forever's. "Getting started" and the Warlock guide (/grim guides) say where the number comes from. At
  a trainer, the add-on still adds up the trainer's own prices.
- **Zone levels.** On the site's zone ladder a zone runs from where its quests and its ordinary creatures begin to
  where they end, instead of the levels of most of its quests. Felwood is 49 to 55 (was 54 to 55: 61 of its 84 quests
  are level 55, and its creatures start at 47), Silithus 55 to 60 (was 59 to 60), Darkshore 11 to 20 (was 1 to 20, for
  two quests of level 1), Tanaris 41 to 49 (was 45 to 60), Azshara 46 to 55 (was 52 to 60), Hillsbrad Foothills 21 to
  31 (was 24 to 37) and Searing Gorge 44 to 49 (was 48 to 52). 26 zones changed, and Riverglades (35 to 45) and
  Shen'dralas (40 to 43) are on the ladder, which has 43 zones.
- **Lighter pages.** With the same words, links and pictures, the Professions 1 to 300 guide weighs 0.96 MB (was
  1.88), Naxxramas' zone page 0.92 MB (was 1.54), Dire Maul 0.84 MB (was 1.53) and Item sets 0.95 MB (was 1.31). Item
  sets and every item page are kept once built (both were built again on every visit), and the sets' class and level
  filters work in the browser. A page's title and the sentence under it no longer fade in: they are painted with the
  page, and Lighthouse on a phone puts a class guide's largest paint at 1.2 s, where it was 3.5 s.
- **A title of its own.** No two of the site's 20,491 pages share a title or a description. The 1,978 quests, 509
  items and 138 creatures that share a name say which one they are ("Call of Water (quest 1530)", "Legionnaire's Band
  (item level 63)"), an instance's zone page is titled by what it lists and leaves the plain name to its dungeon
  page, and a class's or a profession's quest is "a level 23 Shaman quest", where it was "a quest in Shaman".
- **Fished items.** An item fished in a lake, on a shore or in another part of a zone names the water and the zone
  around it (Crystal Lake, Elwynn Forest): 123 item pages said "Fishing in Unknown". The tooltips of the 72 items
  whose best source is fishing say "Fished in" and the water; three of them named an unrelated object (Raw Rockscale
  Cod: "Drops from Small Thorium Vein"). The 266 names are those of the VMaNGOS database.
- **Every page read before a release.** A crawl of the built site reads every address of the sitemap and every link
  between them, 29,346 pages: each page answers, has one heading, its own title, description and address, shows no
  value that was never filled in and no empty table, and links to no page that is missing. It found the fished items
  above and two dead links, from Husk of Naraxis to Deadwind Pass and from Demonfork to Blackrock Spire: a zone
  without a page is plain text now.

## 1.0.6

Forever as Blizzard's hotfixes of November 13 left it (game build 1.60.1.70938): every build checked and compared with
the guides, Forever's own quests and zones on the routes (from QuestieDB, GPLv3, the database behind Questie, traces of
November 13), the new dungeons' bosses, respec paths and four new guides.

- **Every build checked.** All 84 builds were checked on November 14 against the live trees, the tooltips and Blizzard's
  hotfixes, and every leveling, raid, tank and healing build was compared with the Icy Veins guide and Wowhead's or
  Mobalytics'. A build's card shows who it is for, the day and game build it was checked on, the guides to compare it
  with, and "two guides agree" on the 22 builds where they do.
- **24 builds reordered.**
  - Warrior: Arms leveling takes Deflection at 13, Improved Overpower at 15, Spearing Strike at 25 and Sweeping Strikes
    at 30, without Improved Heroic Strike, and its bar has Spearing Strike on key 0. Protection leveling takes
    Anticipation from 27 instead of Improved Sunder Armor and Improved Shield Wall. Fury raid takes Improved Overpower
    instead of Improved Charge; the Protection tank Deflection instead of Improved Sunder Armor.
  - Paladin: Retribution leveling opens with Deflection and takes Pursuit of Justice at 20. Protection leveling starts
    with Benediction and Pursuit of Justice, then Holy Shield at 42 and Shieldsworn at 52.
  - Hunter: Beast Mastery leveling takes Deadly Aspects at 10 and Pathfinding at 20. Marksmanship takes Mortal Shots
    (leveling at 28, raid at 43) instead of Surefooted.
  - Rogue: Combat leveling takes Riposte at 20, and Cold Blood instead of Vigor.
  - Priest: Shadow leveling takes Mental Strength 5/5 instead of Shadow Reach. Shadow raid takes Improved Shadow Word:
    Pain at 19, Improved Mind Blast 4/5 and Dark Inspiration 5/5.
  - Shaman: Enhancement leveling reaches Rage of the Farseer at 40; Elemental leveling takes Concussion first.
  - Mage: Arcane leveling starts with Wand Specialization. The Frost and Fire raid builds take Arcane Subtlety, Fire
    raid takes Incineration at 23, and Arcane raid takes Ignite and Pyroblast instead of Arcane Geometry and Magic
    Absorption.
  - Warlock: Affliction leveling takes Pandemic at 22 and Malevolence at 27, without Amplify Curse or Curse of
    Exhaustion. Affliction raid takes Improved Shadow Bolt, Destruction raid Aftermath 5/5, Demonology raid Improved
    Sayaad.
  - Druid: Feral leveling takes Nature's Majesty instead of Shredding Attacks; the bear takes Natural Instinct and
    Genesis instead of Furor.
- **Respecs.** Discipline leveling respecs into Shadow leveling at 40, and 21 leveling builds into their raid or tank
  build at 60. The build card says so, and the level-up note at that level gives the respec and its price beside the
  build's next point, which you can still learn. After a reset at your class trainer, Grimoire follows the new build;
  with Secondary Talents, the build each set holds.
- **Hotfixes of November 9 to 13** in the tooltips and guides: Judgement, Frost Nova, Wild Growth, Windfury Totem,
  Volley, Rend and Tear, what works in Shadowform, Flametongue Totem, Siphon Life, Berserker Rage and The Quick and the
  Dead; and a dungeon kill trivial to anyone in the group gives no one experience.
- **Forever's quests on the routes.** The leveling routes take 488 of Forever's own quests, 141 to 239 on each route,
  and auto-accept and turn-in take them like any other route quest.
- **Steps in Forever's zones.** Every route has steps in Riverglades (at 41 to 45) and Mount Hyjal (at 55 to 59), and
  the ten Skyborne routes start on Zephras Isle (1 to 12). There the steps follow QuestieDB's traced places on each
  zone's own map; distances and times are estimates, because no open data gives the size of those maps; and quests
  QuestieDB does not place completely are not on the routes. Shen'dralas has no steps: its way in follows Desolace's
  centaur reputation quests, which the routes leave out.
- **Routes that read better.** A trip through several zones is one step: "Go to Badlands, through Hillsbrad Foothills,
  Arathi Highlands, ...". A grind step says how much of the level is left, and 499 of the 955 offer a dungeon whose
  quests give part of that level. Medians of the 56 routes: 64 "Go to" steps (was 97.5, with every zone crossed as its
  own step), 12 continent changes (was 16), 7 visits that hand in fewer than three quests (was 23), 17 grind steps (was
  19.5) and 88.7 hours (was 101.1). Rather than kill its way through most of a level, a route now crosses the sea to
  the quests of that level: fewer levels of grinding (a median of 8.7, in 17 grind steps), more boats and zeppelins
  (a median of 8 a route) and fewer hours.
- **The new dungeons and raids.** The Dungeons page names 62 bosses of the nine new dungeons, Barrow Deeps and Hyjal
  Summit, where Blizzard names them or two guide sites agree, and says who names each and how many of a raid's bosses
  are named (Hyjal Summit: 13 bosses, 12 named). It says where each new dungeon's
  entrance is, and lists 45 quests for five of them; "Before you go" names the ones to pick up first.
- **Four new guides:** Hunter pets, Professions 1 to 300, Fishing by skill, and Sayge and the Darkmoon Faire (/grim
  guides).
- **Discord.** Options has Grimoire's Discord invite as a link to copy, beside the source's.
- **CurseForge.** Both .toc files name the add-on's CurseForge project, so the CurseForge app recognizes a copy put in
  the AddOns folder by hand.
- **New dungeons guide.** It says where each Ruins of Lordaeron quest starts (the Undercity, Brill, or an item) and
  that the Horde's Titan Relic from Whelgar's Excavation goes to Muln Earthfury in Mulgore.
- **On the site.** Quest pages name the place of the 400 quests that said "Unknown", the first quests of every race
  among them, and a new dungeon's quests and creatures lead to its page. Search finds the 84 builds by name ("frost
  mage", "arms warrior leveling") and a name with a misspelt word ("thunderfurry"). Each class guide ends with what
  Blizzard's hotfixes changed for the class since launch, and a class's guide, builds, calculator, trainer list and
  leveling routes link to each other. The front page says what Grimoire holds in one sentence, and a link to a day's
  hotfixes shows that day's own card.

## 1.0.5

Forever as Blizzard's hotfixes of November 10 left it, with the talent trees read from the game itself.

- **Vendor and auction prices together.** An item's tooltip shows what a vendor pays next to its auction price again.
  1.0.4 left the vendor price out wherever the game knew it but did not print it, which is almost everywhere away from
  a vendor.
- **Talents from the game.** The trees now come from the game's own files and the server's hotfixes
  (talentsforever.com's data of November 10) instead of Grimoire's own reading of the hotfix cache and Blizzard's notes.
  The talents the notes did not place stand where the game puts them: Reckless Swings, Improved Whirlwind and Flurry in
  Fury, Weapon Expertise, Aggression and Flash of Steel in Combat, Subtlety's first row and Improved Lightning Shield.
  Raging Blows is gone since November 3, the Improved Serpent Sting Grimoire showed is not in the game's tree (Improved
  Stings does its work), and the prerequisites are the game's: Nature's Splendor needs two points in Nature's Majesty,
  Boundless Light needs Holy Shock, and Mutilate, Weapon Expertise, Adrenaline Rush, Quick Getaway and Death Mark need
  Venom, Precision, Blade Flurry, Dirty Tricks and Preparation.
- **Your builds and links keep their talents.** The builds you made keep their talents, and a wowgrimoire.app link, or
  a "Copy link" from an earlier Grimoire, opens on the same talents on today's trees. A point in a talent that left the
  trees, or whose new prerequisite the build lacks, comes back to you. Links now say which trees they were made on.
- **Hotfixes of November 10:** a Hunter's pet has 115% health (the 150% was a mistake), Arcane Shot and Summon Hawk cost
  11% of base mana and the hawk hits about 80% harder. Shaman weapon imbues and totems work together, so Windfury
  Weapon and Windfury Totem both proc; Stormstrike deals 100% weapon damage every 8 seconds, Maelstrom Weapon gives 20%
  a stack and Mental Dexterity up to 100%. Warlock demons have about 15% more health, the Imp's Firebolt ranks 1 to 4
  hit harder, Soul Siphon counts only Corruption, Siphon Life and Bane of Agony, Wrack is reworked and Bane of Havoc
  triggers the global cooldown. Nature's Swiftness also makes Wild Growth instant, and Sweeping Strikes keeps its
  charges when no second target is hit.
- **Recommended builds:** the Warrior builds take Impale or Improved Bloodrage where Raging Blows was, Enhancement uses
  Windfury Weapon with Windfury Totem (its leveling bar too), Balance takes Nature's Majesty before Nature's Splendor,
  and the Warlock, Rogue, Paladin and Hunter notes follow the new numbers.
- **Abilities:** Death Mark has four ranks, Mutilate three (at 40, 50 and 60), Holy Shield a fourth and Ferocious Bite a
  sixth.
- **Dungeons, quests and guides:** the nine new dungeons show as open; "Camping 101: Herbalism" is handed in at
  Shen'dar Village; and the class, Leveling, Professions, New dungeons and other guides cover what changed since launch
  (since November 10 most quests from level 48 also reward gold).

## 1.0.4

- **Vendor price on every item.** An item's tooltip shows what a vendor pays wherever the game itself does not print
  its sell price.
- **Auction prices as you browse.** Besides the Full scan and the selling tab, every price the game's own Buy tab shows
  you, and every item you search there, now goes into the tooltips.

## 1.0.3

- **Sayge's fortune timer.** Sayge gives the Darkmoon Faire's two-hour buff again only after four hours played on the same
  character, and time offline or on another character does not count. Grimoire now counts it: when you get a fortune, a
  small timer shows the play time left, a chat note and the alarm clock's ring say when Sayge will read your fortune
  again, and the timer's tooltip lists your other characters' counts, so you know which alt can get one now. The count
  is kept against the character's played time, so a logout, a reload or a crash does not lose it. Drag the timer
  anywhere; right-click hides it until your next fortune. `/grim sayge` prints every count, and the timer has its own
  switch in Options.
- **Selling tab at the auction house.** A Grimoire tab beside Buy, Sell and Auctions: everything in your bags the auction
  house takes, by kind; pick one and it shows what it sells for now, fills in a price a copper under the cheapest
  auction that is not yours, and posts it with the quantity and duration you choose. Like the game's own window, each
  post is one click of yours; nothing buys, bids or cancels.
- **Auction prices.** The tab's Full scan reads every auction at once (the game allows one every 15 minutes) and keeps
  each item's lowest price for your realm and faction; each item you look up keeps its price fresh.
- **Shorter tooltips.** An item's tooltip now adds three lines at most: what a vendor pays, its auction price and its
  drop rate with the creature it drops from. A creature's tooltip lists its three likeliest drops.

## 1.0.2

Blizzard's WoW: Forever hotfixes of November 5, 6 and 9.

- **Dungeons:** every kill in a dungeon pays 50% more experience (November 9). The leveling guide's dungeon note and the
  Leveling and New dungeons guides say so, with the dungeon fixes: Alcaz Prison's Zarla Ober and the Shaper's Terrace
  bosses drop loot, the Drowned City hits as hard as intended, and the Deathless Marrow encounter is softer.
- **Abilities and talents:** Swiftmend's wording is corrected; Incinerate is Destruction only; the Voidwalker has about 40
  more health; Soul Siphon no longer counts Wrack itself; Arcane Concentration splits its chance across Arcane Missiles'
  bolts; Reckless Swings also activates Gore Drinker. Bear Form's and Ravage's tooltips say that Blizzard found their
  numbers wrong.
- **Racials:** Plainsrunning stops in battlegrounds while you carry a flag; Cultivation's cooldown starts when its cast
  completes.
- **Quests:** "Unending Torment" opens at level 15 for the Horde, and "Find Bingles" is filed under Loch Modan.
- **Professions:** the Tanning Rack needs 125 Leatherworking (was 140).

## 1.0.0

Grimoire for the launch of World of Warcraft: Forever on November 4, 2026, with the game as Blizzard's development notes
of November 2 left it.

- **Leveling guide:** your own route to 60 for your race and class (the Skyborne too), class quests included, in a slim
  window with an arrow, the distance, the walking time and the experience each quest gives. Steps tick themselves, and
  the route's quests are taken and handed in for you (hold Shift to do it yourself).
  - **Your pace:** after a few minutes of play the window shows the experience you gain an hour and the time to your
    next level at that rate, from the last 25 minutes you played (breaks and time away don't count).
  - **Notes** about Forever along the way (the boosters, your first Legacy point, riding, the new zones), and
    **optional dungeons** to run once, each with the quests to take first. Skip them, or turn them off in Options.
- **On your world map:** your next places, and a quest mark at every giver with a quest you can take now.
- **Talents:** 84 Grimoire builds on Forever's trees, a leveling, a PvE and a PvP build for every spec, point by point
  from 10 to 60. Follow one and every level-up tells you where the point goes; **Learn next point** spends it for you.
  Make your own from your talents, a wowgrimoire.app link or the planner.
- **Action bars:** each Grimoire build has a bar to go with it, the rotation on 1 to 6, cooldowns on 7 to 0 and
  utility on - and =. **Set up my bars** shows it first, places what you know on the bar your keys press (your stance
  or form bar where you have one), and Undo puts your bar back as it was. When you learn a higher rank of the spell you
  use, it takes the old rank's place on your bars by itself.
- **Trainer:** at your class trainer, the spells your build uses are marked, with what they cost together.
- **Gear:** upgrade scores in every item tooltip, read from the game's own tooltip so they use Forever's real numbers;
  the quest reward to take; your best upgrade for each slot and where it drops.
- **Dungeons and raids:** a map of each one, drawn by Grimoire, with every boss's portrait where it stands: hover one for
  its abilities and loot (your upgrades marked), click it for the rest. Floors and wings get their own map. **Before you
  go** lists the quests to pick up first, ticked from your quest log; click one and the arrow points at its giver.
- **Rare alerts**, and the **kill bar**: a fine line on your target's health that turns gold when your DoTs will
  finish it (the idea comes from Does It Die by JoeGG; Grimoire's code is its own).
- **Raid check** and **Legacy**: your group's buffs, the challenges across your account and a perk planner.
- **Guides:** every Grimoire guide, readable in game.
- **Light or Complete:** just the essentials, or everything. In Options, or `/grim light` and `/grim complete`.

Credits for the game data are in `NOTICE.md`.
