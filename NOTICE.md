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
licence (https://creativecommons.org/licenses/by/4.0/), read from the Forever beta client (build 1.60.1.70425).

- Used for: talents and their ranks, trainer abilities with their levels and tooltips, racials, and the Legacy
  challenges and perk trees; and the spell durations and radii in the text of the bosses' abilities (read off the
  client's tooltips for spells it marks as unchanged since Classic). The Classic side of the talent comparison is
  Classic's own tooltip text, which talentsforever.com took from Wowhead's Classic pages.
- Files: `data/talents.json`, `abilities.json`, `races.json`, `classes.json`, `builds.json`, `legacy.json`, `meta.json`,
  `encounters.json`.
- Changes made by Grimoire: reorganised into Grimoire's own files and ids; tooltip lines joined and shortened;
  Grimoire's builds placed on the trees; the level each rank was taught at in Classic (VMaNGOS) added; the Legacy
  challenges grouped into ladders, with the dungeons each Spelunker challenge lists.

### LibQuestDB (MIT)

LibQuestDB by Pimptasty (https://www.curseforge.com/wow/addons/questdb), version QuestDB-v0.1.0.

- Used for: Forever's quest list (with the quests it marks unobtainable or retired), its quest XP table, Forever's own
  new quests (titles, levels, objectives), the zone each creature and object stands in, and, for the leveling routes,
  where each creature and object stands on its zone map, the zones' maps and the places exploration quests send you.
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

### VMaNGOS (GPL-2.0-or-later)

The VMaNGOS world database: the dump at https://github.com/brotalnia/database (June 14, 2021) with the VMaNGOS migrations
(https://github.com/vmangos/core) up to 20260913120518. The dump has no licence file of its own; VMaNGOS is free software
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
  (Classic trainer levels), `encounters.json`, `guide.json`, and `scripts/data/static/boss-scripts.json`.
- Also used: the C++ creature scripts of the VMaNGOS core (https://github.com/vmangos/core, commit 4c51bb7,
  GPL-2.0-or-later), from which `scripts/data/boss-scripts.mjs` extracts facts only (the spells each script casts, the
  creatures it summons and whether the creature's own spell list still runs), and its spell overrides (`spell_mod`,
  `spell_effect_mod`), applied to the bosses' abilities; the short texts of fight mechanics in
  `scripts/data/static/encounters.json` describe what that code does, in Grimoire's words. No code is copied.
- The leveling routes in `data/guide.json` are Grimoire's own: `scripts/data/lib/guide.mjs` works them out from this
  data and LibQuestDB's (no other guide's route is used).
- Changes made by Grimoire (October 2026): converted from SQL to JSON, kept to what Forever keeps, drop chances worked
  out from the loot tables, item and spell text filled in from the spell data, the bosses' abilities written out at each
  boss's level, each dungeon's notable trash drops chosen (Uncommon or better items whose droppers mostly stand in that
  dungeon), and Classic's dungeons' level ranges worked out from the creatures inside. The order of the bosses and the
  wings are Grimoire's own (`scripts/data/static/encounters.json`).

## Fonts

Mona Sans (https://github.com/github/mona-sans), Copyright 2022 The Mona Sans Project Authors, Reserved Font Name
"Mona", and IM FELL English SC, Copyright 2007 Igino Marini, Reserved Font Name "IM FELL English SC", both under the SIL
Open Font License 1.1 (https://openfontlicense.org). The site serves them unmodified from their Fontsource packages. The
add-on ships them unmodified in `addon/GrimoireForever/Media/`, with their licences: Mona Sans 2.027 (the static TTFs
from github.com/github/mona-sans) and IM FELL English SC 3.00 (from Google Fonts).

## Blizzard Entertainment

World of Warcraft, Warcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard
Entertainment, Inc. in the U.S. and/or other countries. Game names, text, icons and art are © Blizzard Entertainment,
Inc. All rights reserved. Icons load from Blizzard's own icon server. The pictures in `public/img/` are Blizzard's World
of Warcraft: Forever art, some cropped or resized by Grimoire; they are used as a non-commercial fan site and are not
covered by Grimoire's licence.
