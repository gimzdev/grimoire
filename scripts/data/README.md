# Rebuilding the game data

`build.mjs` writes every file in `data/` from three openly licensed sources and the hand-written facts in `static/`, then applies what Blizzard has changed since that the sources do not carry (`lib/live.mjs`, see below).
Grimoire takes nothing from World of Warcraft database sites itself (`NOTICE.md` at the top of the repo says where a source
did, and has the credits and licence texts).

```bash
node scripts/data/build.mjs --vmangos mangos.sqlite --talents data.json --libquestdb path/to/QuestDB --questiedb path/to/QuestieDB
```

Node.js 22.5 or newer is needed (it reads the database with the built-in `node:sqlite`). Add `--out somewhere` to
write the files elsewhere than `data/`.

## The three sources

| Flag | Source | Licence | Where to get it |
| --- | --- | --- | --- |
| `--talents` | talentsforever.com export | CC BY 4.0 | Download https://talentsforever.com/data.json. The build refuses an export whose `license` is not `CC-BY-4.0`. |
| `--libquestdb` | LibQuestDB by Pimptasty | MIT | Download the addon from https://www.curseforge.com/wow/addons/questdb and unzip it; pass the `QuestDB` folder (the one with `QuestDB.toc` and `Data/Forever`). |
| `--vmangos` | VMaNGOS world database | GPL-2.0-or-later | A SQLite copy of the VMaNGOS world database, made as below. |
| `--questiedb` | QuestieDB | GPLv3 | `git clone https://github.com/Questie/QuestieDB` (1.1.1 on 14 November 2026). Optional for `build.mjs`. |

### Making the VMaNGOS SQLite file

VMaNGOS publishes its world database as a MySQL dump plus migrations. The steps below are the ones its own CI uses,
then a conversion to SQLite:

```bash
git clone --depth 1 https://github.com/brotalnia/database
git clone --depth 1 -b development https://github.com/vmangos/core vmangos
7z e database/world_full_14_june_2021.7z                 # world_full_14_june_2021.sql
mysql -e "CREATE DATABASE mangos DEFAULT CHARSET utf8 COLLATE utf8_general_ci"
mysql --max_allowed_packet=128M mangos < world_full_14_june_2021.sql
(cd vmangos/sql/migrations && ./merge.sh)                 # writes world_db_updates.sql
mysql --max_allowed_packet=128M mangos < vmangos/sql/migrations/world_db_updates.sql
git clone --depth 1 https://github.com/dumblob/mysql2sqlite
mysqldump --skip-extended-insert --compact --default-character-set=utf8 mangos > mangos.sql
./mysql2sqlite/mysql2sqlite mangos.sql | sqlite3 mangos.sqlite
```

Any MySQL or MariaDB server works for the import. The SQLite file is only an input: it is not part of the repo.

## What each source gives

- **talentsforever.com:** talents with every rank, the trainer spellbook of each class with the level of every rank
  and its tooltip, spell icons, racials and the Priest racials, and the Legacy system: its 65 challenges and the three
  perk trees with every rank, point gate and prerequisite. Read from the World of Warcraft: Forever beta client.
- **LibQuestDB:** which quests exist in Forever (and which it marks as unobtainable or retired), the quest XP table of
  Forever's client, Forever's own new quests (title, level, objective text), and the zone of each creature and object.
- **VMaNGOS:** everything Forever keeps from Classic at patch 1.12: quests with their text, givers and rewards,
  creatures, objects, items and their stats, loot tables, vendors, trainers, factions and zones, the bosses' spells and
  the spell lists and scripts that cast them, and the flight masters, boats and world positions the leveling routes
  use.

- **QuestieDB:** Forever's own quests as Questie's players met them (names, levels, sides, zones, experience, objectives,
  givers, takers and chains), the creatures, objects and items they name, the givers and takers Forever added to Classic's
  quests, the new dungeons' quests and entrances, and for the leveling routes where every creature and object stands on
  Forever's maps, Forever's map rectangles, the quest relations and the places exploration quests send you. Its own docs
  (`docs/forever.md`, `docs/forever-delta-base.md`) say what is incomplete: objectives can be missing and carry no counts,
  and the four new zones' maps have no rectangles, so the routes cannot place them.

## QuestieDB on a finished `data/`, and the routes again

```bash
node scripts/data/questiedb.mjs --questiedb path/to/QuestieDB [--dry]
node scripts/data/routes.mjs --vmangos mangos.sqlite --questiedb path/to/QuestieDB [--only human-warrior] [--out file]
node scripts/data/routes-report.mjs [--guide file] [--thin]
node scripts/data/routes.mjs ... --why /tmp/why.json && node scripts/data/routes-why.mjs --why /tmp/why.json [--routes a,b]
node scripts/data/routes.mjs ... --grind /tmp/grind.json && node scripts/data/routes-grind.mjs --reasons /tmp/grind.json [--before old/guide.json]
node scripts/data/routes.mjs ... --only a,b,c --choose /tmp/rules.json   (the rule of each route again; see "Grinding less")
```

- `questiedb.mjs` (`lib/questiedb.mjs`) reads QuestieDB through its layers (raw base, inherited corrections, delta-base,
  traces, quest relations, authored fixes) and merges it into `data/`: Classic's quests keep VMaNGOS's text and gain the
  givers and takers only Forever has; Forever's own quests take everything from QuestieDB (and keep the group size
  LibQuestDB recorded and the lines `lib/live.mjs` writes); the creatures, objects and items they name are added, and the
  new dungeons' quests go on their lists. It records QuestieDB's version, commit and date in `data/meta.json` and prints
  how complete QuestieDB is, zone by zone and for each new dungeon. Running it twice changes nothing.
- `routes.mjs` works the leveling routes out again on the finished `data/` (its quests, creatures, objects, drops and
  items, as `build.mjs` wrote them), with VMaNGOS for the flight masters, trainers, boats and scripts and QuestieDB for
  where everything stands, then adds what `lib/forever.mjs` and `lib/live.mjs` add, as `build.mjs` does. The same inputs
  give the same `data/guide.json`, byte for byte.
- `routes.mjs --why <file>` also writes why each quest the routes cannot take is left out (not placed, class or
  profession, repeatable, dungeon, elite, reputation), and `routes-why.mjs` counts, for every "kill to the next level"
  step, the quests open at that level that no step of the route takes, by reason. A quest counts for a route's side by the
  side players meet it on (`fs`): a quest open to every race whose giver is the other faction's is not that route's.
- `routes.mjs --only a,b,c` works out those routes alone; `--rules stay2,was+stayHalf` (with `--out`, `--dry` or
  `--choose`) works the routes out by other rules of `lib/guide.mjs` (`RULES`; `was+` before a stay rule lays its stays
  over the rule the route had as released) in place of the rule chosen for each (`static/route-rules.json`), each route
  keeping the one that grinds least within `static/route-release.json`, else its released rule; `--no-gate` holds them
  to nothing; `--rules released --no-gate` gives 1.0.6's routes as first built. `--choose <file>` tries every rule of
  `ROUTE_RULES` (or of `--rules`) on each route and writes the routes' rules to the file; `--grind <file>` writes every
  "kill to the next level" step with the engine's reason for it, and `routes-grind.mjs` lists them with the stretches
  ground a level or more in a row. See "Grinding less" below.
- A zone step names the zones crossed on foot on the way, each with where it is entered (`["Z", zone, area, x, y, level,
  [[zone, x, y], ...]]`): one instruction, and the add-on's arrow still leads from zone line to zone line. A "kill to the
  next level" step carries the share of the level still to go, in percent (`["L", ..., level, share]`).
- `routes-report.mjs` prints every route against the bar the routes are held to (`lib/route-bar.mjs`); `check-routes.mjs`
  fails when a route misses a line its table of waivers does not excuse, and `check-questiedb.mjs` proves QuestieDB's
  places against VMaNGOS and that `data/` holds QuestieDB. Both need `GRIMOIRE_VMANGOS` and `GRIMOIRE_QUESTIEDB` where
  they read a source, and say what they skipped without them.
- `check-places.mjs` fails when a quest, a creature or an object in `data/` is filed under a place the site cannot name
  (`categoryName` in `src/lib/quests.ts`: a zone, a named area, a quest category or a dungeon's own area), and holds the
  new dungeons' areas in `src/lib/data.ts` to the data build's. With `GRIMOIRE_VMANGOS` it also compares the names given
  to Classic's areas with VMaNGOS's.

## Grimoire's own facts (`static/`)

- `classes.json`: colours, armour and weapons, and each tree's role.
- `races.json`: race ids, starting zones and which talentsforever race each one is.
- `legacy.json`: which Legacy Challenges form a ladder (levels, skills, honor ranks, Field of Honor weeks), the dungeons
  each Spelunker challenge lists, the tradeskills' skill lines, the battleground factions, and Grimoire's four perk
  builds (the build checks each one spends 16 points, every point open at its turn).
- `builds.json`: the recommended builds, written as talent names in the order the points go in; the build turns them
  into talent codes for the current trees and prints any that no longer fit or had to be reordered.
- `bars.json`: each build's suggested action bar, an ability name or null for each key from 1 to =. `node
  scripts/data/bars.mjs` checks every name against the build's class and talents and copies it to `data/bars.json`
  (`--check` only checks); run it after the builds or spells change. The site and the add-on read `data/bars.json`.
- `dungeons.json`: dungeon, raid and battleground pages. The new dungeons' levels follow Blizzard's announced list;
  Classic's dungeons get theirs from the creatures inside (`build.mjs`: from one under the lowest quarter of them to
  three over the last boss). The new dungeons' and the first tier's raids' entrances, and the bosses QuestieDB's traces rank
  inside them, come from QuestieDB (`lib/questiedb-dungeons.mjs`, run by `questiedb.mjs` and `build.mjs --questiedb`): a boss is
  a creature the traces place inside the instance with rank 3 (QuestieDB's only boss rank, cmangos' "World Boss"), a level,
  and hostile to both sides. In QuestieDB a five-player dungeon's bosses are elites like their trash, so the rule names none of
  them; with the traces of November 13 it names no creature in Forever's new dungeons and raids. `check-dungeons.mjs` holds data/ and the two guides to it.
- `encounters.json`: the bosses of each dungeon and raid in the order of a run, by wing, with flags (rare spawn, event,
  optional) and notes; the build checks every creature id and name against VMaNGOS.
- `boss-scripts.json`: for each C++ creature script of the VMaNGOS core, the spells it casts, the creatures it summons
  and whether the creature's spell list still runs. Generated by `node scripts/data/boss-scripts.mjs --core <vmangos
  core checkout>` (facts only, no code); run it again when the core changes.
- `route.json`: the leveling routes' plan: each starting zone with the flight paths a new character knows, the zones
  each route quests in with the level to leave each one at, the boats, zeppelins, tram and Darnassus's portal with
  their times, and the gates: where two zones meet on foot (a road, a pass, a bridge, a tunnel), each side placed on
  spawns that stand there, with the walk through when it is longer than the step across (Deadwind Pass, Blackrock
  Mountain, Timbermaw Hold). On foot a route crosses a zone in a straight line and leaves it only by a gate, with a
  step for each zone on the way. The build works out a route for every race and class the starting zone has (46 in
  all) with `lib/guide.mjs`: it simulates a character of that race and class who takes the quests at its level, hands
  in and takes everything at a hub before leaving it, orders each zone's work into a short path (`lib/tour.mjs`: every
  quest taken before its objectives and handed in after them, the next quests of a chain planned with the one that
  opens them, and the path drawn toward where the zone's work goes on), does its class's quests that teach a spell or
  give a totem wherever they lead (with the druid's and the mage's teleports), trains at its own class trainer, binds
  its Hearthstone where it has the most to do, and picks the next zone by what its quests pay for the time they take
  (the plan's zones for the level first). It kills things to the next level only when no quest pays. Each route is worked
  out by the newest of its rules that leave it no worse than it was ("Grinding less" below), and under stricter travel rules first (a visit to another zone hands in three quests, the sea is crossed only for a good
  deal of work, the way to another zone counts three times) and keeps them
  unless they make it slower than before the QuestieDB rebuild (`static/route-hours.json`); then the earlier rules, where those are quicker. A quest's server
  condition is followed when it speaks only of other quests (a trainer's errand offered until its quest is started);
  a quest that names another as its next is one more way to it; a quest started by an item another quest hands out is
  taken where that one is handed in.
- what Forever adds to the routes (`lib/forever.mjs`, run by the build after the routes are worked out; `node scripts/data/forever.mjs` does the same on a finished
  `data/`): the notes ("I" steps) for Forever's own systems and zones; the dungeons ("D" steps), optional and meant to be run once with their quests, because
  Forever pays a dungeon's experience through its quests and Blizzard keeps repeats below questing: at most one in each stretch of levels (13 to 19, 20 to 27,
  28 to 35, 36 to 43, 44 to 52, 53 to 60), five or six a route, where the route passes the dungeon, Forever's new dungeons first up to level 33 (the beta
  reached 30) and Classic's with the most quests to hand in after that (a new dungeon above 33 only where no Classic one fits: nothing is known of its quests);
  and the ten Skyborne routes, which continue the route of their side's race from the second zone of its plan. Running it twice gives the same guide.
- `quest-events.json`: what the quests a script completes ask for, where the scripts in the database do not say it
  (talk to someone, use an item somewhere, an escort), with the VMaNGOS ids they rest on. `lib/events.mjs` works out
  the rest from VMaNGOS's area triggers, gossip, object, event and creature scripts, escort paths and item spells; a
  quest neither knows is left out of the routes.
- `route-hours.json`: the hours each leveling route took before the QuestieDB rebuild, which no route may exceed (the stricter travel rules
  give way where they would; `check-routes.mjs` holds every route to it).
- `route-release.json`: what each route was in 1.0.6 as released on November 15, 2026 (hours, visits, "Go to" steps,
  changes of continent, short visits, grind steps, the levels they add up to and those ground in a row, and the rule it
  was worked out by), and the bar a rule must keep a route within. See "Grinding less".
  `routes-report.mjs --guide <file> --release` writes the counts from a guide (it keeps each route's `rule`).
- `route-rules.json`: the rule each route is worked out by, chosen by `routes.mjs --choose`. See "Grinding less".
- `route.json`'s `estimated`: Forever's zones whose map no open data places in the world, routed on their own map with
  QuestieDB's places at an estimated width (the median width of Classic's outdoor zone maps, 4250 yards: on those maps it
  is off by a factor of 1.30 at the median and 2.38 at worst; every map is 1.5 times as wide as high), so their distances
  and minutes are estimates. A zone is routed only at the levels where 75% of its quests (`ROUTE_SHARE`, in whole percent)
  have a giver, a taker and every objective placed (`lib/questiedb.mjs`, `routableLevels`), and only its complete quests
  become steps (what follows an incomplete one stays out too): Zephras Isle, Shen'dralas, Riverglades (36 to 50) and Mount
  Hyjal (51 to 60). Gates into them come only from QuestieDB's quests given outside and taken inside (Shen'dralas: Valley
  of Bones; Riverglades: from the Swamp of Sorrows, Arathi Highlands, Stranglethorn Vale and Tanaris; Mount Hyjal: from
  Felwood and Winterspring), with an allowance in seconds marked `estimated`. Such a zone is a destination, never a way
  between two other places: a route goes there only for a visit that hands in three of its quests, and leaves by the gate
  it came in by (`check-routes.mjs` holds every route to it). The two routes with an `until` are the Skyborne's island to level 12: `lib/forever.mjs`
  puts them at the head of the Skyborne's routes. An item VMaNGOS does not have (Forever's own) is collected where QuestieDB
  says it comes from, in the median number of kills Classic's collecting takes at its level: such a quest is marked `est`
  in the guide.
- `zones.json`: Forever's new zones.
- `scripted-spawns.json`: raid bosses the server summons by script (so the database has no spawn for them), with their raid.
- `site.json`: launch dates.

The output lists anything to check, such as a build that no longer places all its points.

## Grinding less: the rules a route takes, and the trials

A route kills its way to the next level where no zone's quests pass its travel rules. The quests are in the data: of the
quests open at a route's grind steps that sit behind a quest the route never takes, 53% follow a quest the engine can
route (the 56 routes together; 21% follow one the data does not place, 8% an elite one). What keeps a route from them is
the way there: a visit must hand in three quests, a sea crossing needs ten typical quests' experience in one zone, and a
zone is weighed alone, for what it offers at this level.

`lib/guide.mjs` works each route out by the rule chosen for it in `static/route-rules.json`, and by its released rule
(`static/route-release.json`: the rule it had in 1.0.6 as released on November 15, 2026) if that one no longer passes
the gate. The gate holds a rule to the route as released: no more hours, fewer levels ground, no more levels ground in
stretches of a level or more in a row unless the route grinds as much less in all, at most three more short visits and
one more for every level the route no longer grinds (counted from the released median of 7 for a route under it; the
visits of the Gelkis's way into Shen'dralas aside), and never over 20 changes of continent, the class's own teleports
aside, unless the route is both faster and grinds less than as released. `check-routes.mjs` holds every route to the
same. `routes.mjs --choose <file>` makes the choice again: it tries every rule of `ROUTE_RULES` on each route, keeps the
one that grinds least within the gate and writes the routes' rules to the file; the engine's log says which limit
refused each of the others.

### The first rework's rules (November 15, 2026, at night)

The rules of 1.0.6 as released; each route's is in `static/route-release.json` (`rule`). They were tried in this order,
and a route kept the first that passed that night's bar against 1.0.6 as first built.

1. `rather`: rather than kill its way through more than a third of a level, a route looks at the zones again: six
   typical quests' experience will do in any zone, across the sea too, at half of grinding's rate, whether or not quests
   open here at the next level. A visit still hands in three quests.
2. `wide`: quests up to four levels above the character (orange in the game; three before), and a visit hands in four
   quests (three before). More gets done on a visit.
3. `plan`: the corrected plan alone (it has only not to grind more than the route did). The correction is on in all
   three: Forever's zones in the plan (`route.json`) no longer move the level the next zone opens at. Since
   Shen'dralas, Riverglades and Mount Hyjal went into the plans, Arathi Highlands opened to the Horde at 42 instead of
   32, Thousand Needles to the Alliance at 42 instead of 36 and the Eastern Plaguelands at 58 instead of 55.
4. `released`: the last resort, where no rule passes: the rules of 1.0.6 as first built (the plan's levels as they
   were), which give that route again.

A boat or zeppelin costs 280 to 320 seconds, waiting included (`route.json`'s `time`), and the way to the dock on top: a
median of 9.8 minutes to the dock and across on six released routes. VMaNGOS's `transports` gives each line one vehicle
with a period of 296 to 356 seconds for the whole round, so a ride plus half the interval is at most the period.

The trials, on ten routes (human-warrior, human-paladin, dwarf-shaman, night-elf-rogue, gnome-mage, orc-shaman,
orc-hunter, tauren-druid, undead-mage, undead-warlock), means, without the gate (November 15, 2026; `wide` then without
the plan's correction):

| rules | grind steps | levels ground | hours | visits | "Go to" | changes of continent |
| --- | --- | --- | --- | --- | --- | --- |
| released | 19.7 | 11.1 | 92.1 | 55.9 | 58.4 | 10.0 |
| `plan` | 18.6 | 10.2 | 90.9 | 58.1 | 61.2 | 10.9 |
| `wide` | 18.1 | 9.4 | 88.8 | 56.3 | 57.7 | 11.4 |
| four levels above, visits of three as before | 18.5 | 9.4 | 89.0 | 59.9 | 62.0 | 11.8 |
| `wide`, and 14 typical quests for a sea crossing | 20.0 | 11.4 | 92.3 | 51.6 | 53.6 | 9.4 |
| `rather` (a second look rather than a grind of over a third of a level: 6 typical quests anywhere) | 15.0 | 7.2 | 87.5 | 66.5 | 69.6 | 15.8 |
| `loose` (the same with 3 typical quests, 4 across the sea) | 15.5 | 7.0 | 87.3 | 70.8 | 74.6 | 16.5 |
| `land` (zones ahead of the plan, the far continent weighed as a whole) | 15.5 | 5.7 | 87.0 | 78.1 | 81.6 | 17.8 |

Every rule that grinds less is quicker by the engine's own hours and changes continent more often: about one more change
of continent for each level no longer ground. `loose` and `land` buy little more than `rather` for many more trips, so
they stay trials. Merging grind steps that follow each other at one place gains nothing: of the 1,073 grind steps of
the routes as first built, 55 follow another and 9 of those stand at the same place.

With these rules (rebuilt November 15, 2026) 42 of the 56 routes changed against 1.0.6 as first built. Of the 46
routes worked out, 21 take `rather`, 11 `wide`, 4 the corrected plan alone and 10 keep their steps. Medians, as first
built and now: grind steps 19 and 17, levels ground 10.7 and 8.7, hours 91.6 and 88.7, visits 56.5 and 62, "Go to" steps
59 and 64, changes of continent 9 and 12, short visits 6 and 7, boats and zeppelins 6 and 8. All 56 together grind 479.7
levels where they ground 589.1. Two tries at the runs of grinding that are left (the Orc Shaman's 30 to 33) made the
routes go back and forth and are not in the code: the plan's zone across the sea with less work on the second look (73
visits and 13 short visits on that route), and a third look when a second level in a row would be ground (18 changes
of continent).

### Staying across the sea (November 15, 2026, the second rework)

The first rework's rules weigh one zone at a time, so a zone across the sea must pay its crossing alone. `stay` weighs
the far continent as a whole: rather than kill its way through more than a third of a level, a route looks first at
this continent's zones the plan has not come to yet, then at what all the far continent's zones offer now and in the
next three levels. When that is a level of quests or more, and one zone there has a visit's work now, it crosses, and
from then on looks only at that continent's zones until none has a visit's work left; then the far look again, and when
that finds nothing worth a stay the first rules look at every zone. One crossing each way pays for several zones over
several levels. The rules tried on each route: `stay` on the corrected plan, `was+stay` (the stays laid over the rule the
route had), and both with `rep`: the quests that ask for a standing with a faction which kills lead to; and the four
careful ones: stays only rather than grind half a level, or only for two levels of quests.

`rep` is Desolace's Gelkis: VMaNGOS's `faction` table starts every race 1,000 short of Friendly with both centaur clans,
and `creature_onkill_reputation` gives 20 with one clan and takes 100 with the other for a kill of the other's centaurs,
so "Gain a Friendly reputation with the Gelkis" is about 50 Magram centaurs, a step in the quest's own words ("Kill
Magram Clan Centaur (about 50) until your reputation with Gelkis Clan Centaur is Friendly"). The standing is kept: the
chain's later quests ask for nothing more. The Magram's quests stay out: a character cannot hold both. Valley of Bones,
which Uthek the Wise gives after Ongeku, is the way into Shen'dralas, and under `rep` its chain is held like a class's
own quests (never dropped, taken wherever met, gone to on the continent the route is on).

With these rules (rebuilt November 15, 2026, 14:42 to 14:48 EST) 43 of the 46 routes worked out take a stay rule (13
`stayRep`, 9 `was+stayRep`, 7 `stay`, 4 `was+stay`, 4 `stayHalfRep`, 3 `stayHalf`, 3 `was+stay2Rep`) and 3 keep their
released steps: human-hunter is slower under all eight rules, orc-mage and human-warrior under most of them and grind
more in a row than they grind less under the others. All 56 routes together, as released and now: 955 and 848 grind
steps, 613 and 324 of them longer than a third of a level, 479.7 and 293.4 levels ground, 272.5 and 115.8 of those in
stretches of a level or more in a row, 4,962 and 4,847 hours, 3,454 and 4,318 visits, 692 and 944 changes of continent.
Medians: grind steps 17 and 15, levels ground 8.66 and 5.15, hours 88.7 and 86.5, visits 62 and 76, changes of continent
12 and 15.5. No route takes more hours and none grinds more. 28 routes have steps in Shen'dralas (at 38 to 44).
`routes-grind.mjs` lists every stretch ground a level or more in a row and, from `routes.mjs --grind`, every grind step
with the engine's reason for it.

Every route was tried by all eight rules, in three parts. The four rules that stay whenever more than a third of a level
would be ground, on each of 44 routes, as two runs side by side on a machine shared with eight other jobs: 32 minutes
(the two other routes, human-warrior and human-paladin, had all eight rules in a first run that was stopped for time);
13 routes passed under none of them as the gate then stood, mostly on hours. The four careful rules on those 13: nine
passed (twelve of them as one run: 9 minutes 20 seconds). The careful rules on the other 32 routes, as two runs side by
side: 14 minutes 11 seconds; a route changed only where a rule passed the gate and beat its choice on levels ground
without taking more hours than it, and two of them changed (dwarf-warrior and gnome-warrior: 6.66 levels ground to
5.37). A rebuild by the chosen rules took between 6 and 16 minutes (the last one 6 minutes 3 seconds), depending on what
else the machine was doing. Three limits of the first rework were changed after they refused routes that were better on
every count the decision names: night-elf-druid at 4.83 levels ground in 86.1 h against 8.27 in 89.9 h (a new stretch of
2.81 levels in a row), tauren-warrior at 3.44 levels in 84.8 h against 8.36 in 88.8 h (15 short visits, one over), and
night-elf-warrior at 6.53 levels in 88.4 h against 9.65 in 90.6 h (22 changes of continent): the cap of 20 no longer
holds a route that is both faster and grinds less than as released (human-warlock then went from 4.53 levels ground to
4.21, with 23 changes).

## A newer talentsforever export: `classes.mjs`

The class data (talents, trainer abilities, races, classes, Legacy and the recommended builds) comes from the
talentsforever.com export alone. Since its export of 10 November 2026 (client build 1.60.1.70755) it carries the launch
client's hotfix cache, Blizzard's development notes of 2 November and the server's hotfixes after launch, class by class
(each class's `talents.source` line names the days), so Grimoire no longer layers snapshots of its own on top.

When talentsforever publishes a newer export, `classes.mjs` rebuilds the class data of a finished `data/` from it, then
Blizzard's hotfix list on top, and leaves the rest of `data/` as it is:

```bash
node scripts/data/classes.mjs --talents data.json --vmangos mangos.sqlite [--dry]
```

It prints every talent that moved, was added, reworded or dropped, every rank that is new, gone or taught at another
level, and every recommended build whose code changed or that no longer fits, before it writes anything (`--dry` writes
nothing). The three facts the classes take from VMaNGOS (the level and price of each rank at a Classic trainer, and the
classes each race had in Classic) come from `--vmangos` as in `build.mjs`; without it they are kept from `data/`, which is
exact for the prices and the races, and for the levels as long as nothing moved a rank since.

## Since launch: Blizzard's hotfix list

Since the launch on 4 November Blizzard keeps one list, "WoW: Forever Hotfixes" (news.blizzard.com/en-us/article/24315281),
and adds to it as fixes go live. `lib/live.mjs` applies what that list says about things Grimoire shows and the export does
not carry (`build.mjs` calls it before writing; `node scripts/data/live.mjs` does the same to a finished `data/`, once, and
`classes.mjs` after it rebuilds the classes). It covers the entries of 5 to 13 November:

- a line on the spells, talents and racials whose rules changed where no tooltip shows it: Incinerate for Destruction
  only, Nature's Swiftness on Wild Growth, the Warlock's demons and the Hunter's pets and hawks, Bane of Havoc on the
  global cooldown, the Shaman's weapon totems with its imbues, Sweeping Strikes, Arcane Concentration, Plainsrunning and
  Cultivation (5 to 10 November); Shadowform and Fear Ward, the pet families of two rare beasts and Consecrated Ground
  (9 November); ranged Judgement, Volley, Rend and Tear with Pounce, Twilight Focus and Confounding Flash in Shadowform,
  Flametongue Totem's second rank and Unsealed Wrath's echoes (11 November); Frost Nova and Blizzard, Wild Growth,
  Judgement of Command, Windfury Totem, Siphon Life, Berserker Rage and Divine Spirit (13 November);
- quests: "Find Bingles" moves to Loch Modan, "Unending Torment" opens at 15, the turn-in of "Camping 101: Herbalism" on
  Zephras Isle, and a line in the box of changes of the quests the list fixes and Grimoire holds; the Young
  Diemetradons' level; and the leveling guide's note on dungeons, whose kills pay 50% more since 9 November and nothing
  to anyone when the enemy is trivial to one member of the group since 13 November.

It also moves `data/meta.json` to the day the list goes up to (`LIVE.date`) and to the live client build
(`LIVE_BUILD`, which foreverchanges.pro reads from the client), and carries one fact that client holds and Blizzard has
not posted, labelled as client data: Wild Growth's three ranks share one cooldown.

It also keeps three facts from Blizzard's beta development notes that no tooltip carries: Attack Power counts twice as
much for Deadly and Instant Poison (2 November), Eureka! cannot be used in stealth (15 October) and Cultivation needs a
player level of a fifth of the herb's skill (24 September).

Fixes to things Grimoire does not show (respawns, loot bugs, the Cooldown Manager, escorts) are left out, as are changes to
Forever's own items, which the item data does not hold; a Classic item Forever changed goes in `static/item-changes.json`
(Gloves of Holy Might, 13 November). Each edit looks for what it replaces first, so a second run, or a newer export that
already has the change, changes nothing. `hotfix.md` beside this file is the routine for the next entry: where the list
is, the three places an entry goes and the checks to run.

## Builds: evidence and the lint

Each build in `static/builds.json` carries its evidence: `checked` (the day), `build` (the client build), `confidence`
(`live`: played or measured at those levels by the sources; `consensus`: two guides make the same main
choices and Grimoire's arithmetic from the tooltips agrees; `theory`: the arithmetic, which no guide confirms point
for point, as every PvP build until there is evidence at 60), `sources`
(guides to compare with: links, shown on the build page and by name in the add-on, never copied) and `for` (who should
pick it). `lateCapstone` gives the reason a leveling build takes its tree's last talent after 40, and `why` the reason
it takes a utility talent of its class's list before 40. `next` (`{ id, at }`) is the respec a build's players make at
level `at` into another build of the class: 21 builds have one (20 leveling builds into their raid or tank build at 60,
Discipline leveling into Shadow leveling at 40).

`lib/builds-lint.mjs` checks all of that, the levels and talents the notes quote against the order, and the words
"beta", "follows the trees" and "not tested"; `builds.mjs` prints what it finds under "Builds to check". `guides-lint.mjs`
checks that every number in a sentence of `content/guides` that links a talent or an ability is in that talent's or
spell's current text (a number after "about" is Grimoire's own arithmetic), and that a level quoted after a link is one
at which a leveling build takes the talent or a rank of the spell is trained.

## Items: Forever's published rules

The items are Classic's (VMaNGOS, patch 1.12). `lib/items-forever.mjs` applies what Blizzard has made public about
Forever's items (`build.mjs` calls it; `node scripts/data/items.mjs` does the same to a finished `data/`, once):

- Hit and Critical Strike are one stat each for spells and attacks, so "with spells" leaves those lines.
- Bonus healing also gives a third as much bonus damage: a healing line becomes "Increases healing done by up to 42 and
  damage done by up to 14 for all magical spells and effects."
- Items with weapon skill give less of it. Where the new amount isn't public the item keeps Classic's number and says so;
  the add-on counts those as +1, Edgemaster's Handguards' new value.
- `static/item-changes.json` holds the items Blizzard has shown, each with its source: lines to replace, add or remove, and
  new base stats, quality or level requirement.

A changed item keeps Classic's value of every field it changed (`cl`, null where Classic had none), what brought it to
Forever (`fr`) and what changed, in words (`ch`), so the item page can show both.

## Maps, item sets and training prices

Three more files come from VMaNGOS. `build.mjs` writes the sets and the prices with everything else; each also has a
script of its own that works on a finished `data/`:

```bash
node scripts/data/maps.mjs --vmangos mangos.sqlite       # data/maps.json
node scripts/data/sets.mjs                               # data/sets.json, from data/items.json
node scripts/data/trainers.mjs --vmangos mangos.sqlite   # the cost of every rank in data/abilities.json
```

- **Maps** (`maps.mjs`): each dungeon's and raid's floor plan, one view per wing. Every creature, patrol point and object
  VMaNGOS places in the instance marks floor; the plan is the outline around them, rooms less than 60 yards apart joined
  by a corridor, and floors that lie over one another drawn apart. Bosses stand where VMaNGOS spawns them (a pooled boss
  at each place it can appear), the entrance where its teleport puts you. A boss's portrait is Blizzard's render of its
  creature display; `static/no-portrait.json` lists the displays the render server has no picture for.
- **Item sets** (`lib/sets.mjs`): VMaNGOS gives each set piece its set's id. A set's name and bonuses live only in the
  game client, so Grimoire names a set after what its pieces share ("Cenarion", "Might", "Warlord's Plate") and the game's
  own tooltip has the bonuses.
- **Training prices** (`lib/trainers.mjs`): Classic's price of each spell at its trainer (build 5875), moved from the
  teaching spell to the spell it teaches. Forever's new spells, talents and quest spells have none. The same file reads the
  level Classic's trainers taught each spell at, which marks a rank Forever teaches at another level.
