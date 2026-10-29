# Grimoire on CurseForge

Everything the CurseForge project page asks for, ready to paste. The file to upload is
`addon/dist/GrimoireForever-<version>.zip` (`npm run addon` builds it).

| Field | Value |
| --- | --- |
| Name | Grimoire Field Guide (curseforge.com/wow/addons/grimoire-field-guide) |
| Summary | Your WoW Forever field guide in game: a leveling guide with an arrow and the route on your map, gear upgrades for your build, dungeon quests, rare alerts, talent builds point by point and a Legacy planner. |
| Game version | WoW Forever, 1.60.1 (interface 16001) |
| Categories | Quests & Leveling (main), Class, Tooltip, Boss Encounters |
| Licence | GNU General Public License version 3 (GPLv3); the add-on says "version 3 or later" |
| Source | https://github.com/gimzdev/grimoire |
| Issues | https://github.com/gimzdev/grimoire/issues |
| Website | https://wowgrimoire.app |
| Logo | Grimoire's gold rune emblem (`addon/GrimoireForever/Media/Emblem.tga`, or the site's logo); not Blizzard's art |

The changelog for each upload is in `addon/GrimoireForever/CHANGELOG.md`.

---

## Description

**Grimoire is the WoW Forever field guide from [wowgrimoire.app](https://wowgrimoire.app), in your game.** Type `/grim` and it opens on your character in 3D, with what matters now beside it: your next talent point, what to train, your next leveling steps, the dungeons that fit, your next upgrades and your Legacy points. Dark rounded panels, the site's own fonts, nothing in your way. Two modes: **Light**, just the guide window, tooltips and level-up notes, or **Complete**, everything below.

### Leveling guide

- **Your own route to 60**, for your race and class, every quest in order, your class quests included (forms, pets, demons, totems, stances, poisons).
- **Nothing to set up**: it starts where you are, at your level, in your zone, past the quests you have done.
- **A slim window** with an arrow to the place, the distance and the walking time, what to do there and the experience each quest gives. Under it your level's experience and what the next hand-ins add. Back and next look ahead without losing your place; the list button opens the route under it.
- **On your world map**: your next places as numbered pins, and a quest mark at every giver with a quest you can take now. Click one and the arrow takes you there.
- **Steps tick themselves** as you accept, finish and hand in quests, travel, train and level. Talk to a quest giver and the guide takes and hands in the route's quests for you (hold Shift to do it yourself).
- **Grind steps** count down the kills left, rested experience included.
- The whole route, zone by zone, is on the Leveling page and on [wowgrimoire.app/tools/leveling](https://wowgrimoire.app/tools/leveling). Every route is worked out by Grimoire from open game data.

### Gear

- **Upgrades in item tooltips**: how much an item adds for your build over what you wear.
- **The quest reward to take**, marked in the quest window.
- **Your best upgrade for each slot** near your level, with where it drops or which quest gives it.

### In the world

- **Every dungeon and raid**: bosses in the order of a run, their abilities and their loot with drop chances, and **all its quests**, those given in town included, with the way to whoever starts them. A button beside the group finder opens them.
- **Rare alerts**: a quiet card when a rare is near, with its level, its best drops and the way to it.
- **Kill bar**: a thin bar on your target's health fills toward a skull as your DoTs come to cover what it has left. Full: they will finish it. Forever hides a creature's health from add-ons; the game draws the bar from it, so Grimoire never reads or guesses it.
- **Tooltips** show where an item comes from and what a creature drops.

### Talents and training

- **Grimoire's builds** for all nine classes, point by point from 10 to 60. Follow one and every level-up tells you where the point goes.
- **Your own builds**: from the talents you have, a wowgrimoire.app calculator link, or the in-game planner.
- **What to train** now, and what every level brings, Forever's new spells included.

### Group and Legacy

- **Raid check**: the buffs, debuffs and utilities your group brings, and what is missing.
- **Legacy**: all 65 challenges, tracked across your account, and a perk planner with Grimoire's builds.

### Commands

| Command | What it does |
| --- | --- |
| `/grim` | Open or close Grimoire |
| `/grim light`, `/grim complete` | Just the essentials, or everything |
| `/grim guide` | Show or hide the leveling guide |
| `/grim next` | Your next talent point and the spells to train |
| `/grim skip`, `/grim back` | The guide's next or previous step |
| `/grim talents`, `abilities`, `leveling`, `dungeons`, `items`, `raid`, `legacy`, `guides` | Open a page |
| `/grim minimap`, `/grim options` | The minimap button, the settings |

Grimoire is also in the add-on compartment under the minimap.

### Good to know

- At a merchant, grey items are sold and your gear repaired (hold Shift to skip it, or turn it off in Options).
- Right-click the guide window for its look, its units and its lock.
- Where Forever has published nothing of its own, item stats, drop chances, boss abilities and quests are Classic's (patch 1.12): treat the numbers as a guide.
- It sends nothing anywhere. It saves only your settings, builds, place in the guide and Legacy progress.

### Credits

- Talents, abilities, racials and Legacy: [talentsforever.com](https://talentsforever.com) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
- Quests and where creatures stand: [LibQuestDB](https://www.curseforge.com/wow/addons/questdb) by Pimptasty (MIT), with Classic facts from [CMaNGOS](https://github.com/cmangos/classic-db) (GPL-3.0).
- Items, loot, creatures and boss abilities: the [VMaNGOS](https://github.com/vmangos/core) world database and scripts (GPL-2.0-or-later).
- Fonts: [Mona Sans](https://github.com/github/mona-sans) and IM FELL English SC (SIL Open Font License).
- The kill bar's idea: [Does It Die](https://www.curseforge.com/wow/addons/does-it-die) by JoeGG. Grimoire's code is its own.

Free software under the GNU GPL, version 3 or later; source and data scripts on [GitHub](https://github.com/gimzdev/grimoire). A fan add-on, not affiliated with or endorsed by Blizzard Entertainment. World of Warcraft and Warcraft are trademarks of Blizzard Entertainment, Inc.
