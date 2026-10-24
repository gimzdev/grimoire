# Notices

Grimoire for World of Warcraft: Forever (the GrimoireForever add-on)
Copyright (C) 2026 gimzdev

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public
License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later
version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the
implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License in
`LICENSE` for more details.

The source, including the script that builds `Data/` (`scripts/addon/build.mjs`), is at
https://github.com/gimzdev/grimoire.

Grimoire is not affiliated with or endorsed by Blizzard Entertainment or by any of the projects below.

## Data

Every file in `Data/` is generated from Grimoire's data files, which are built from the projects below and from
Grimoire's own work (the recommended builds, the guides, the order of each dungeon's bosses, and the leveling routes,
which Grimoire's own script works out from the data below: `scripts/data/lib/guide.mjs`). Each data file stays under the
terms of the source it was made from.

### talentsforever.com (CC BY 4.0)

Data from talentsforever.com (https://talentsforever.com), under the Creative Commons Attribution 4.0 International
licence (https://creativecommons.org/licenses/by/4.0/), read from the Forever beta client. Used for the talents and
their ranks, the trainer abilities with the level each rank is learned at, the racials, the Legacy challenges and perk
trees, and the spell durations and radii in the text of the bosses' abilities. Changes made by Grimoire: reorganised
into Grimoire's own tables, tooltip lines shortened, Grimoire's builds placed on the trees, and the Legacy challenges
grouped into ladders with the dungeons each Spelunker challenge lists.

### LibQuestDB (MIT)

LibQuestDB by Pimptasty (https://www.curseforge.com/wow/addons/questdb). Used for Forever's quest list and quest names,
for the zone each creature stands in, and, for the leveling guide, for where every creature and object stands on its
zone map, the zones' maps and the places exploration quests send you to. LibQuestDB re-expresses its Classic facts from
the CMaNGOS world database (https://github.com/cmangos/classic-db, GPL-3.0), and reads Forever's own quests from the
Forever client (through wago.tools and TOGTools). Changes made by Grimoire (October 2026): read from LibQuestDB's Lua
tables, joined with the VMaNGOS quests and kept to what Forever lists.

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

The VMaNGOS world database (https://github.com/brotalnia/database, with the migrations in
https://github.com/vmangos/core). The dump has no licence file of its own; VMaNGOS is free software under the GNU
General Public License, version 2 or (at your option) any later version, and Grimoire uses this data on those terms,
under version 3. Used for Classic's items, their sources and drop chances, creatures, vendors, dungeons and zones, at
patch 1.12; for the bosses of each dungeon and raid, their abilities, what they summon and their loot, with the server's
spell overrides and facts read from the C++ boss scripts of the VMaNGOS core (spells cast, creatures summoned and what
the fight scripts do, in Grimoire's words; commit 4c51bb7, no code copied); and, for the leveling guide, for the quests
(givers, objectives, chains, experience, and what the quests a script completes ask for, read from its scripts and
escort paths), the flight masters, the class trainers and the boats, and for the world positions the guide's distances
are measured in. Changes made by Grimoire (October 2026): converted from SQL, kept to
what Forever keeps, drop chances worked out from the loot tables, the bosses' abilities written out at each boss's
level, and each dungeon's notable trash drops chosen.

## Fonts and pictures

`Media/` holds two font families, copied unchanged, each under the SIL Open Font License 1.1 (https://openfontlicense.org)
with its licence beside it:

- Mona Sans 2.027 (`MonaSans-Regular.ttf`, `MonaSans-Medium.ttf`, `MonaSans-SemiBold.ttf`), Copyright 2022 The Mona Sans
  Project Authors (https://github.com/github/mona-sans), Reserved Font Name "Mona": `Media/MonaSans-OFL.txt`.
- IM FELL English SC 3.00 (`IMFeENsc28P.ttf`), Copyright 2007 Igino Marini, Reserved Font Name "IM FELL English SC", from
  Google Fonts: `Media/IMFellEnglishSC-OFL.txt`.

The `.tga` pictures in `Media/` are Grimoire's own (rounded shapes, marks and the emblem), drawn by
`scripts/addon/media.mjs` in the source, under Grimoire's licence.

## Blizzard Entertainment

World of Warcraft, Warcraft and Blizzard Entertainment are trademarks or registered trademarks of Blizzard
Entertainment, Inc. in the U.S. and/or other countries. Game names, text, icons and art are © Blizzard Entertainment,
Inc. The add-on draws the game's own icons from the game client and ships none of Blizzard's files.
