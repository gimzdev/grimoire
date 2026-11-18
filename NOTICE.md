# Notices

Grimoire, a fan site for World of Warcraft: Forever
Copyright (C) 2026 gimzdev

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public
License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later
version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the
implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License in
`LICENSE` for more details.

Grimoire is not affiliated with or endorsed by Blizzard Entertainment or by any of the projects below.

## Data

`scripts/data/build.mjs` builds every file in `data/` from the sources below and from Grimoire's own facts in
`scripts/data/static/` (dungeons, recommended builds, Legacy ladders and builds). Grimoire takes nothing from World of
Warcraft database sites itself; where a source did, it says so below. Each data file stays under the terms of the source
it was made from.

### talentsforever.com (CC BY 4.0)

Data from talentsforever.com (https://talentsforever.com), under the Creative Commons Attribution 4.0 International
licence (https://creativecommons.org/licenses/by/4.0/): its export of 10 November 2026, read from the Forever client (build
1.60.1.70755) and the server's hotfixes after it.

- Used for: talents and their ranks, trainer abilities with their levels and tooltips, racials, and the Legacy
  challenges and perk trees; and the spell durations and radii in the text of the bosses' abilities (read off the
  client's tooltips for spells it marks as unchanged since Classic). The Classic side of the talent comparison is
  Classic's own tooltip text, which talentsforever.com took from Wowhead's Classic pages. talentsforever.com reads the
  server's hotfixes from the client's hotfix cache and checks them against Blizzard's notes or Wowhead's tooltips.
- Files: `data/talents.json`, `abilities.json`, `races.json`, `classes.json`, `builds.json`, `legacy.json`, `meta.json`,
  `encounters.json`.
- Changes made by Grimoire: reorganised into Grimoire's own files and ids; tooltip lines joined and shortened;
  Grimoire's builds placed on the trees; the level each rank was taught at in Classic (VMaNGOS) added; the Legacy
  challenges grouped into ladders, with the dungeons each Spelunker challenge lists.

### wowforevertalents.com (no licence stated)

Facts about the Forever launch client (build 1.60.1.70707), as published by wowforevertalents.com
(https://wowforevertalents.com), a fan site run by Paul Alexandru. The site states no licence for its data and says its game
data is © Blizzard Entertainment. Grimoire copies no text, tables or design from it, only game facts, and credits it here
and on the site. If its author asks, Grimoire will remove or replace this data.

- Used for: the profession facts in `content/guides/professions.md` that are marked as coming from the client. (Until
  10 November 2026 Grimoire also took the class changes of the client's hotfix cache of 30 October from it; the
  talentsforever.com export carries them since.)

- Since Grimoire 1.0.8, two facts from its patch notes of 18 November 2026 as well: the client build live since the weekly
  maintenance of 17 November, 1.60.1.70959, which `data/meta.json` and `grimoire.sh` name, and that the client's files
  still gave Vampiric Embrace 20% on that day, where Blizzard's notes of 16 November announce 10%.

### Blizzard's development notes and hotfix list

What Blizzard has posted about Forever that the sources above do not carry is written out by Grimoire from Blizzard's own
posts, each named where it is used: the World of Warcraft: Forever beta development notes
(https://us.forums.blizzard.com/en/wow/t/2360696) for three facts no tooltip shows (two poisons' Attack Power, Eureka! in
stealth, Cultivation's level), and the "WoW: Forever Hotfixes" list (https://news.blizzard.com/en-us/article/24315281) for
the changes since launch (5 to 17 November 2026). `scripts/data/lib/live.mjs` holds them and applies them to
`data/talents.json`, `abilities.json`, `races.json`, `quests.json`, `npcs.json` and `guide.json`.

### foreverchanges.pro (no licence stated)

Two facts read from the Forever client by foreverchanges.pro (https://foreverchanges.pro), as it showed them on
13 November 2026: the live client build of that day, 1.60.1.70938 (`data/meta.json` and `grimoire.sh` named it until
Grimoire 1.0.8), and one change
Blizzard has not posted (Wild Growth's three ranks share one cooldown), which Grimoire labels as client data where it
shows it. The site states no licence; Grimoire takes these two facts, in its own words, and nothing else.

### LibQuestDB (MIT)

LibQuestDB by Pimptasty (https://www.curseforge.com/wow/addons/questdb), version QuestDB-v0.1.0.

- Used for: Forever's quest list (with the quests it marks unobtainable or retired), its quest XP table, Forever's own
  new quests (titles, levels, objectives) and the zone each creature and object stands in. (Until November 14, 2026 the
  leveling routes also took from it where each creature and object stands; QuestieDB gives that since.)
- LibQuestDB's own sources: Classic facts re-expressed from the CMaNGOS world database
  (https://github.com/cmangos/classic-db, GPL-3.0); the quest XP table as wago.tools exports it from the Forever client;
  Forever's quest text from TOGTools' walk of the Forever client.
- Code: the quest XP rounding in `scripts/data/lib/world.mjs` is adapted from `LibQuestDB-1.0.lua`.
- Files: `data/quests.json`, `npcs.json`, `objects.json`, `items.json` (zones), `meta.json`, `guide.json`.
- Changes made by Grimoire (October 2026): read from LibQuestDB's Lua tables into JSON, joined with the VMaNGOS quests
  and kept to what Forever lists.

```
MIT License

Copyright (c) 2026 Pimptasty

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### QuestieDB (GPLv3)

QuestieDB (https://github.com/Questie/QuestieDB), the database behind Questie's Forever support, version 1.1.3 (commit
8b8df2d, November 18, 2026), its traces generated on November 17, 2026. Its `QuestieDB.toc` credits the code to Logonz
and the data to Muehe, TheCrux (BreakBB), Drejjmit, Dyaxler, Cheeq, TechnoHunter, Yttrium and everyone else. Its
`LICENSE.md` says the Questie team allows forking and copying it under the GNU General Public License, version 3
(https://www.gnu.org/licenses/gpl-3.0.html; the text is in `LICENSE`), lists the contributors who put their work under
that licence (Muehe, Logon, TheCrux/BreakBB, Drejjmit, Cheeq, TechoHunter, Yttrium), and notes that the content it imported
from Questie (https://github.com/Questie/Questie) is subject to Questie's licensing. Grimoire uses QuestieDB's data on the
GPLv3 terms, keeps it under that licence, and uses neither the Questie name as its own nor its logo.

- Used for: Forever's own quests (names, levels, sides, zones, experience, objectives, who gives and takes them and the
  chains between them), the creatures, objects and items they name, the givers and takers Forever added to Classic's
  quests, the new dungeons' quests and entrances, and, for the leveling routes, where every creature and object stands on
  Forever's zone maps, Forever's map rectangles (`data/Forever/conversion.json`), the quest relations and the places
  exploration quests send you; and, for the maps on the creature, quest and zone pages, where every creature and object
  stands (`data/spawns.json`) and the ground each zone map is drawn around (`data/zone-maps.json`, with VMaNGOS).
- QuestieDB's own sources: Questie's Classic database; traces of real play gathered by Questie's players (206,378 trace
  files on November 13, 2026); a delta-base its authors generated from Wowhead's Forever pages
  (`src/corrections/Forever/generated`); and the Forever client's map data for its coordinates. Grimoire reads
  QuestieDB's files and nothing from those sources directly.
- Files: `data/quests.json`, `npcs.json`, `objects.json`, `minor-items.json`, `dungeons.json` (the new dungeons' quests),
  `meta.json`, `guide.json`, `spawns.json`, `zone-maps.json`.
- Changes made by Grimoire (November 2026): read from QuestieDB's Lua tables through its layers (raw base, inherited
  corrections, delta-base, traces, quest relations, authored fixes) into Grimoire's JSON (`scripts/data/lib/questiedb.mjs`).

### VMaNGOS (GPL-2.0-or-later)

The VMaNGOS world database: the dump at https://github.com/brotalnia/database (June 14, 2021) with the VMaNGOS migrations
(https://github.com/vmangos/core) up to 20261117202712 for the leveling routes and the zone maps, and 20260913120518 for the rest of `data/`. The dump has no licence file of its own; VMaNGOS is free software
under the GNU General Public License, version 2 or (at your option) any later version, and Grimoire uses this data on
those terms, under version 3.

- Used for: the Classic world Forever keeps, at Classic's last patch (1.12): quests and their text, creatures, objects,
  items and their stats, loot tables, vendors, trainers, factions and zones; the bosses of each dungeon and raid, their
  spells, scripts and summons; and, for the leveling routes, the flight masters, the class trainers, the transport
  routes, the world positions the routes measure distances in, and what the quests a script completes ask for (read
  from its area triggers, gossip, event and creature scripts, escort paths and item spells by
  `scripts/data/lib/events.mjs`).
- Files: `data/quests.json`, `npcs.json`, `objects.json`, `items.json`, `minor-items.json`, `drops.json`,
  `npc-loot.json`, `vendors.json`, `zones.json`, `zone-names.json`, `factions.json`, `races.json`, `abilities.json`
  (Classic trainer levels and prices, `scripts/data/lib/trainers.mjs`), `encounters.json`, `guide.json`, `sets.json`
  (each set's pieces, from the items' set ids: `scripts/data/lib/sets.mjs`; names are Grimoire's, from the pieces),
  `maps.json`, `zone-maps.json` (the ground beside each zone, the named places of its teleport list as its area table
  spells them, and the capitals' points of interest: `scripts/data/zone-maps.mjs`) and
  `scripts/data/static/boss-scripts.json`.
- The dungeon and raid maps in `data/maps.json` (and the add-on's map textures drawn from them) are Grimoire's own
  drawings: `scripts/data/maps.mjs` traces each instance's floor plan around where VMaNGOS places its creatures, their
  patrol points and its objects, and puts each boss where VMaNGOS spawns it. No game map art is used.
- Also used: the C++ creature scripts of the VMaNGOS core (https://github.com/vmangos/core, commit 4c51bb7,
  GPL-2.0-or-later), from which `scripts/data/boss-scripts.mjs` extracts facts only (the spells each script casts, the
  creatures it summons and whether the creature's own spell list still runs), and its spell overrides (`spell_mod`,
  `spell_effect_mod`), applied to the bosses' abilities; the short texts of fight mechanics in
  `scripts/data/static/encounters.json` describe what that code does, in Grimoire's words. No code is copied.
- The leveling routes in `data/guide.json` are Grimoire's own: `scripts/data/lib/guide.mjs` works them out from this
  data, LibQuestDB's and QuestieDB's (no other guide's route is used).
- Changes made by Grimoire (October 2026): converted from SQL to JSON, kept to what Forever keeps, drop chances worked
  out from the loot tables, item and spell text filled in from the spell data, the bosses' abilities written out at each
  boss's level, each dungeon's notable trash drops chosen (Uncommon or better items whose droppers mostly stand in that
  dungeon), and Classic's dungeons' level ranges worked out from the creatures inside. The order of the bosses and the
  wings are Grimoire's own (`scripts/data/static/encounters.json`). November 2026: the item rules Blizzard has published
  for Forever applied to the items' text (one Hit and one Critical Strike stat, healing that adds a third as much damage),
  plus the few items Blizzard has shown (`scripts/data/lib/items-forever.mjs`, `scripts/data/static/item-changes.json`);
  each changed item keeps Classic's values beside Forever's.

## Fonts

Mona Sans (https://github.com/github/mona-sans), Copyright 2022 The Mona Sans Project Authors, Reserved Font Name
"Mona", and IM FELL English SC, Copyright 2007 Igino Marini, Reserved Font Name "IM FELL English SC", both under the SIL
Open Font License 1.1 (https://openfontlicense.org). The site serves them unmodified from their Fontsource packages. The
add-on ships them unmodified in `addon/GrimoireForever/Media/`, with their licences: Mona Sans 2.027 (the static TTFs
from github.com/github/mona-sans) and IM FELL English SC 3.00 (from Google Fonts).

## Blizzard Entertainment

World of Warcraft, Warcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard
Entertainment, Inc. in the U.S. and/or other countries. Game names, text, icons and art are © Blizzard Entertainment,
Inc. All rights reserved. Icons load from Blizzard's own icon server, and the bosses' portraits on the dungeon maps from
Blizzard's own render server (render.worldofwarcraft.com), by each boss's creature display id from VMaNGOS; in the add-on
the game draws them itself. The pictures in `public/img/` are Blizzard's World
of Warcraft: Forever art, some cropped or resized by Grimoire; they are used as a non-commercial fan site and are not
covered by Grimoire's licence.
