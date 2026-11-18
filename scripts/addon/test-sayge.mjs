#!/usr/bin/env node
// Tests the add-on's count for Sayge's fortune (Sayge.lua) in a Lua VM (fengari) against a fake game: a clock, the
// player's buffs, the played time the game answers with, the chat frames it mutes and the alarm it rings. Only time
// played on the character counts, so the test logs out for hours and checks nothing moved.
//
//   node scripts/addon/test-sayge.mjs
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
const ADDON = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'addon', 'GrimoireForever');

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

/* ── The fake game ───────────────────────────────────────────────────────── */

run(String.raw`
NS = {}
PRINTS = {}
print = function(...) local t = {} for i = 1, select("#", ...) do t[#t + 1] = tostring((select(i, ...))) end PRINTS[#PRINTS + 1] = table.concat(t, " ") end
SlashCmdList = {}
unpack = unpack or table.unpack
strtrim = function(s) return (s:gsub("^%s+", ""):gsub("%s+$", "")) end
function geterrorhandler() return function(e) error(e, 0) end end

-- The clock: GetTime and time() move together, and only ADVANCE moves them.
NOW = 1000
function GetTime() return NOW end
time = function() return 1794000000 + math.floor(NOW) end

local events, updates = {}, {}
local function noop() end
Frame = {}
Frame.__index = function(_, k)
	local v = rawget(Frame, k)
	if v ~= nil then return v end
	if type(k) == "string" and k:match("^%u") then return noop end
end
function Frame:RegisterEvent(e) events[e] = events[e] or {} self.reg = self.reg or {} if not self.reg[e] then self.reg[e] = true table.insert(events[e], self) end end
function Frame:UnregisterEvent(e) if self.reg then self.reg[e] = nil end for i, f in ipairs(events[e] or {}) do if f == self then table.remove(events[e], i) break end end end
function Frame:IsEventRegistered(e) return self.reg and self.reg[e] or false end
function Frame:SetScript(k, fn) self.scripts = self.scripts or {} self.scripts[k] = fn if k == "OnUpdate" then updates[#updates + 1] = self end end
function Frame:GetScript(k) return self.scripts and self.scripts[k] end
function CreateFrame(_, name) local f = setmetatable({}, Frame) if name then _G[name] = f end return f end
function FIRE(e, ...) local list = {} for i, f in ipairs(events[e] or {}) do list[i] = f end for _, f in ipairs(list) do local h = f:GetScript("OnEvent") if h then h(f, e, ...) end end end

-- Timers run once their time has come: FLUSH runs those due now, ADVANCE those due as the clock moves.
local timers = {}
C_Timer = { After = function(delay, fn) timers[#timers + 1] = { due = NOW + (delay or 0), fn = fn } end }
function FLUSH()
	for _ = 1, 50 do
		local due, rest = {}, {}
		for _, t in ipairs(timers) do if t.due <= NOW then due[#due + 1] = t else rest[#rest + 1] = t end end
		timers = rest
		if #due == 0 then return end
		for _, t in ipairs(due) do t.fn() end
	end
end
-- Time going by in the game, logged in: timers come due and OnUpdate scripts tick each second.
function ADVANCE(seconds) for _ = 1, seconds do NOW = NOW + 1 FLUSH() for _, f in ipairs(updates) do local fn = f:GetScript("OnUpdate") if fn then fn(f, 1) end end end end
-- Logged out: the clock moves, the add-on does not run.
function OFFLINE(seconds) NOW = NOW + seconds end

-- The character
function UnitName() return "Tester" end
function GetRealmName() return "Realm" end
function UnitClass() return "Warrior", "WARRIOR" end
function UnitLevel() return 60 end

-- The chat frames: two listen for the played time, one does not.
CHAT_FRAMES = { "ChatFrame1", "ChatFrame2", "ChatFrame3" }
for i = 1, 3 do local cf = CreateFrame("Frame", "ChatFrame" .. i) if i < 3 then cf:RegisterEvent("TIME_PLAYED_MSG") end end

-- Spells and buffs
local SPELL_NAMES = { [23735] = "Sayge's Dark Fortune of Strength", [23768] = "Sayge's Dark Fortune of Damage" }
C_Spell = { GetSpellName = function(id) return SPELL_NAMES[id] end }
AURAS = {}
C_UnitAuras = { GetBuffDataByIndex = function(unit, i) if unit == "player" then return AURAS[i] end end }
-- A fortune on the player, given age seconds ago; the aura change settles half a second later.
function FORTUNE(age, id) AURAS = { { name = SPELL_NAMES[id or 23768], spellId = id or 23768, icon = "Interface\\Icons\\fortune", duration = 7200, expirationTime = NOW + 7200 - (age or 0) } } FIRE("UNIT_AURA", "player") NOW = NOW + 0.5 PLAYED = PLAYED + 0.5 FLUSH() end

-- The game's played time: ASKS counts the questions; PLAYED is what the server has counted.
ASKS, PLAYED = 0, 500000
function RequestTimePlayed() ASKS = ASKS + 1 end
function ANSWER() FIRE("TIME_PLAYED_MSG", PLAYED, 1000) FLUSH() end
SOUNDKIT = { ALARM_CLOCK_WARNING_3 = 12867 }
RINGS = 0
function PlaySound() RINGS = RINGS + 1 end
`, 'fake game');

for (const f of ['Core.lua', 'Sayge.lua']) {
  run(readFileSync(path.join(ADDON, f), 'utf8'), f, ['GrimoireForever', 'NS']);
}

/* ── The tests ───────────────────────────────────────────────────────────── */

run(String.raw`
local ns, S = NS, NS.Sayge
local fails, count = {}, 0
local function check(what, ok, detail) count = count + 1 if not ok then fails[#fails + 1] = what .. (detail and (": " .. tostring(detail)) or "") end end
local function eq(what, got, want) check(what, got == want, "got " .. tostring(got) .. ", want " .. tostring(want)) end
-- Times within a second: an aura change settles half a second after it happens.
local function near(what, got, want) check(what, type(got) == "number" and math.abs(got - want) <= 1, "got " .. tostring(got) .. ", want " .. tostring(want)) end
local function printed(pattern) for _, line in ipairs(PRINTS) do if line:find(pattern) then return true end end return false end
-- Time played on the character: the server's count moves with the clock.
local function play(seconds) PLAYED = PLAYED + seconds ADVANCE(seconds) end

FIRE("ADDON_LOADED", "GrimoireForever")
FIRE("PLAYER_LOGIN")
FLUSH()
eq("no fortune, no question for the played time", ASKS, 0)
eq("no fortune, no status", S.Status(), nil)

-- A fortune from Sayge: the played time is asked quietly, then the count starts.
FORTUNE(0)
eq("a fortune asks for the played time", ASKS, 1)
eq("the chat frames that listened are muted while Grimoire asks", ChatFrame1:IsEventRegistered("TIME_PLAYED_MSG"), false)
ANSWER()
eq("they listen again after the answer", ChatFrame1:IsEventRegistered("TIME_PLAYED_MSG"), true)
eq("a frame that did not listen is left alone", ChatFrame3:IsEventRegistered("TIME_PLAYED_MSG"), false)
local st = ns.char.sayge
check("the fortune is on record", st ~= nil)
near("counted from the played time when it was given", st and st.played, 500000)
eq("not a guess", st and st.guess, nil)
eq("its buff's name", st and st.name, "Sayge's Dark Fortune of Damage")
near("four hours to play", S.Left(), 4 * 3600)
check("a note in chat", printed("Sayge's Dark Fortune of Damage") and printed("4h 00m"))

-- An hour of play.
play(3600)
near("three hours left after an hour of play", S.Left(), 3 * 3600)
eq("in words", S.Status(), "3h 00m to play")
check("on the clock", S.Clock(S.Left()) == "3:00:00" or S.Clock(S.Left()) == "2:59:59", S.Clock(S.Left()))

-- The same buff seen again (another aura change) starts nothing.
FIRE("UNIT_AURA", "player") FLUSH()
near("the same fortune keeps its count", ns.char.sayge.played, 500000)

-- A logout of ten hours: nothing counts while offline. After the login the game says the played time again.
OFFLINE(10 * 3600)
ANSWER()
near("ten hours offline change nothing", S.Left(), 3 * 3600)

-- The buff wears off; play on until the count runs out.
AURAS = {} FIRE("UNIT_AURA", "player") NOW = NOW + 0.5 PLAYED = PLAYED + 0.5 FLUSH()
play(3 * 3600 - 10)
near("ten seconds to go", S.Left(), 10)
eq("no ring yet", RINGS, 0)
play(11)
eq("due", S.Status(), "ready")
eq("the alarm rings once", RINGS, 1)
check("and chat says so", printed("Sayge will read your fortune again"))
play(5)
eq("only once", RINGS, 1)

-- Every character's count is kept for the others.
local rows = ns.db.sayge
check("this character's count is kept", rows and rows["Tester-Realm"] ~= nil)
rows["Alt-Realm"] = { class = "MAGE", left = 600, seen = time() }
local others = S.Others()
eq("an alt is listed", others[1] and others[1].name, "Alt-Realm")
eq("with its time to play", others[1] and others[1].left, 600)
PRINTS = {}
S.Report()
check("the report says ready", printed("ready"))
check("and names the alt", printed("Alt%-Realm 10m"))

-- The next fortune, once the count is done, starts a new one.
play(600)
FORTUNE(0, 23735)
near("a new fortune restarts the count", S.Left(), 4 * 3600)
eq("with its own name", ns.char.sayge.name, "Sayge's Dark Fortune of Strength")
eq("and a ring to come", ns.char.sayge.told, nil)

-- A fortune Grimoire first sees an hour after it began: counted from the buff's timer, marked as a guess.
ns.char.sayge = nil
FORTUNE(3600)
near("an hour already played", S.Left(), 3 * 3600)
eq("marked as a guess", ns.char.sayge and ns.char.sayge.guess, true)

-- The minimap's line and /grim sayge.
check("status for the minimap", S.Status() == "3h 00m to play" or S.Status() == "2h 59m to play", S.Status())
PRINTS = {}
SlashCmdList.GRIMOIREFOREVER("sayge")
check("/grim sayge reports", printed("the next one after"))

-- Turned off in Options: the count goes on, without chat notes.
ns.db.saygeTimer = false
ns.char.sayge = nil
PRINTS = {}
FORTUNE(0)
near("still counted", S.Left(), 4 * 3600)
check("no chat note when turned off", not printed("Grimoire counts it"))

if #fails > 0 then
	error(#fails .. " of " .. count .. " checks failed:\n  " .. table.concat(fails, "\n  "), 0)
end
print("ok: " .. count .. " checks passed")
RESULT = "ok: " .. count .. " checks passed"
`, 'tests');

lua.lua_getglobal(L, to_luastring('RESULT'));
console.log(lua.lua_tojsstring(L, -1));
