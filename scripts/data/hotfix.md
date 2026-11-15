# A new hotfix, in one hour

1. Read Blizzard's list day by day: news.blizzard.com/en-us/article/24315281, or its forum copy (the "WoW: Forever Hotfixes" thread on us.forums.blizzard.com), which fetch tools can read. foreverchanges.pro names the live client build.
2. In `lib/live.mjs`: move `LIVE.date` (and `LIVE_BUILD` if the client changed), then add each fact Grimoire shows to its list: `SPELL_LINES`, `TALENT_LINES`, `RACIAL_LINES`, `QUESTS`, `QUEST_NOTES`, `NPCS`, `GUIDE_TEXT`. Facts no tooltip carries only; label client data that Blizzard did not post.
3. Write `content/news/<date>.md` like the others: `title`, `description`, `source`, `classes`, and `builds`, the builds whose notes or order you change.
4. Carry each fact into what it touches: the build's notes (`static/builds.json`, with `checked` moved to the day), the class guide, `static/item-changes.json` for an item the data holds, a dungeon page, the route note in `lib/forever.mjs`.
5. Run `node scripts/data/live.mjs`, `node scripts/data/forever.mjs`, `node scripts/data/builds.mjs` (no "Builds to check"), `node scripts/data/bars.mjs --check` and `node scripts/data/guides-lint.mjs`; a second `live.mjs` run must print 0 edits.
6. Then `npm run addon`, the add-on tests in `scripts/addon/`, `npx tsc --noEmit` and `npx next build`.
7. Set `GRIMOIRE_VERSION`, `GAME_BUILD` and the header lines of `grimoire.sh` and the version in `package.json`, `package-lock.json`, both `.toc` files, `Core.lua` and a new `CHANGELOG.md` section.
8. Words: say the day ("since November 13"), never "beta", "for now" or "not yet" about something live and checkable.
9. A change to the add-on's Lua ships as a beta (`--beta`) until it has been tried in game.
10. Blizzard tunes classes on Tuesdays "if necessary": check the list every Tuesday evening.
