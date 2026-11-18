#!/usr/bin/env node
// Tests /grim go (Core.lua's slash command) in a Lua VM (fengari): the line "Copy for the add-on" gives under a map on
// the site must send the guide's arrow to that place, and anything else must leave the arrow alone and say why. The fake
// game is the one test-sayge.mjs builds (its first Lua block), with a guide of one zone and an arrow that records where
// it was sent.
//
//   node scripts/addon/test-go.mjs
//
// fengari is not one of the site's dependencies: install it next to the repo (npm install --no-save fengari) or point
// FENGARI at a copy.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let fengari;
for (const p of [process.env.FENGARI, 'fengari', '/tmp/luap/node_modules/fengari'].filter(Boolean)) {
  try {
    fengari = require(p);
    break;
  } catch {}
}
if (!fengari) {
  console.error('This test needs fengari: npm install --no-save fengari, or FENGARI=/path/to/fengari.');
  process.exit(2);
}
const { lua, lauxlib, lualib, to_luastring } = fengari;
const here = path.dirname(fileURLToPath(import.meta.url));
const ADDON = path.resolve(here, '..', '..', 'addon', 'GrimoireForever');

const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);
function run(code, name, args = []) {
  if (lauxlib.luaL_loadbuffer(L, to_luastring(code), null, to_luastring(name)) !== lua.LUA_OK) throw new Error(lua.lua_tojsstring(L, -1));
  for (const a of args) {
    if (a === 'NS') lua.lua_getglobal(L, to_luastring('NS'));
    else lua.lua_pushstring(L, to_luastring(a));
  }
  if (lua.lua_pcall(L, args.length, 0, 0) !== lua.LUA_OK) throw new Error(`${name}: ${lua.lua_tojsstring(L, -1)}`);
}

// the fake game of test-sayge.mjs: its first Lua block
const sayge = readFileSync(path.join(here, 'test-sayge.mjs'), 'utf8');
const game = /run\(String\.raw`([\s\S]*?)`, 'fake game'\);/.exec(sayge)?.[1];
if (!game) throw new Error('test-sayge.mjs no longer holds its fake game as its first Lua block');
run(game, 'fake game');
run(readFileSync(path.join(ADDON, 'Core.lua'), 'utf8'), 'Core.lua', ['GrimoireForever', 'NS']);

run(String.raw`
local ns = NS
local fails, count = {}, 0
local function check(what, ok, detail) count = count + 1 if not ok then fails[#fails + 1] = what .. (detail and (": " .. tostring(detail)) or "") end end
local function eq(what, got, want) check(what, got == want, "got " .. tostring(got) .. ", want " .. tostring(want)) end
local function printed(pattern) for _, line in ipairs(PRINTS) do if line:find(pattern) then return true end end return false end

FIRE("ADDON_LOADED", "GrimoireForever")
FIRE("PLAYER_LOGIN")

-- a guide of one zone, and an arrow that records where it was sent
local SENT = "nothing"
ns.guide = { zones = { [12] = { "Elwynn Forest", 1429, 0, 1535.4, -1935.4, -7939.6, -10254.2 } } }
ns.Guide = { GoTo = function(place) SENT = place end }
local function go(line) SENT = "nothing" PRINTS = {} SlashCmdList.GRIMOIREFOREVER(line) return SENT end

-- the line the site copies
local p = go("go 12 48.9 36.4 Kobold Vermin")
check("the site's line sends the arrow", type(p) == "table")
if type(p) == "table" then
	eq("zone", p.area, 12) eq("x", p.x, 48.9) eq("y", p.y, 36.4) eq("name", p.title, "Kobold Vermin") eq("label", p.label, "Go to")
	eq("the card's second line", p.sub, "Elwynn Forest 48.9, 36.4")
end
check("it says where the arrow leads", printed("Kobold Vermin") and printed("Elwynn Forest 48.9, 36.4"))
-- as people type it: capitals, a comma, spaces, no name, an apostrophe
p = go("GO 12 48.9, 36.4")
check("capitals and a comma", type(p) == "table" and p.x == 48.9 and p.y == 36.4 and p.title == "Map point")
p = go("  go   12  7 99.5  Hogger's Den ")
check("spaces around, an apostrophe in the name", type(p) == "table" and p.x == 7 and p.y == 99.5 and p.title == "Hogger's Den")
p = go("go 12 0 100 Corner")
check("the map's corner", type(p) == "table" and p.x == 0 and p.y == 100)
-- back to the route
eq("go off sends nil", go("go off"), nil)
check("and says so", printed("back to your route"))
eq("go stop too", go("go stop"), nil)
-- what must not move the arrow
eq("a zone the guide has no map of", go("go 999 10 10 Nowhere"), "nothing")
check("is said", printed("no map of that zone"))
eq("past the map's edge", go("go 12 148 10 x"), "nothing")
eq("no numbers", go("go 12 abc"), "nothing")
eq("a dot is not a number", go("go 12 .5 . x"), "nothing")
eq("nothing after go", go("go"), "nothing")
check("the usage is shown", printed("Copy for the add%-on"))
eq("gold is another word", go("gold"), "nothing")
check("an unknown command, not go", printed("unknown command") or not printed("Copy for the add%-on"))
-- without the leveling guide loaded there is no arrow, and no error
ns.Guide = nil
eq("no guide", go("go 12 48.9 36.4 Kobold Vermin"), "nothing")
check("is said too", printed("not loaded"))

if #fails > 0 then error(#fails .. " of " .. count .. " checks failed:\n  " .. table.concat(fails, "\n  "), 0) end
RESULT = count
`, 'tests');
lua.lua_getglobal(L, to_luastring('RESULT'));
console.log(`ok: ${lua.lua_tonumber(L, -1)} checks passed`);
