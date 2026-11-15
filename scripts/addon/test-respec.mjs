#!/usr/bin/env node
// Tests a build's respec in the add-on (Bars.lua's FollowPath and NextPoint, Notify.lua's level-up note and /grim next, the
// Talents page) in a Lua VM (fengari) against a fake game: a priest who follows the Discipline leveling build, which respecs
// into Shadow leveling at 40 (data/builds.json next), with the classic talent frame, unspent points and the talent
// window's events. A respec is a choice: the build's own points go on until the talents fit the next build.
// Loads the add-on's own files (Core, the generated Data, Player, Builds, Notify, Bars, the Talents page), so run it after
// node scripts/addon/build.mjs.
//
//   node scripts/addon/test-respec.mjs
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
function result(label) {
  lua.lua_getglobal(L, to_luastring('RESULT'));
  const r = lua.lua_tojsstring(L, -1);
  lua.lua_pop(L, 1);
  console.log(r);
  if (!r.startsWith('ok')) process.exitCode = 1;
  return label;
}

/* ── The fake game ───────────────────────────────────────────────────────── */

run(String.raw`
NS = {}
PRINTS = {}
print = function(...) local t = {} for i = 1, select("#", ...) do t[#t + 1] = tostring((select(i, ...))) end PRINTS[#PRINTS + 1] = table.concat(t, " ") end
SlashCmdList = {}
UISpecialFrames = {}
unpack = unpack or table.unpack
strtrim = function(s) return (s:gsub("^%s+", ""):gsub("%s+$", "")) end
function geterrorhandler() return function(e) error(e, 0) end end

-- Frames: any method a test does not care about does nothing (methods are the capitalised keys; fields stay fields).
local events = {}
local function noop() end
Frame = {}
Frame.__index = function(_, k)
	local v = rawget(Frame, k)
	if v ~= nil then return v end
	if type(k) == "string" and k:match("^%u") then return noop end
end
function Frame:RegisterEvent(e) events[e] = events[e] or {} table.insert(events[e], self) end
function Frame:SetScript(k, fn) self.scripts = self.scripts or {} self.scripts[k] = fn end
function Frame:GetScript(k) return self.scripts and self.scripts[k] end
function Frame:HookScript(k, fn) local old = self:GetScript(k) self:SetScript(k, function(...) if old then old(...) end fn(...) end) end
function Frame:Show() local was = self.shown self.shown = true if not was and self:GetScript("OnShow") then self:GetScript("OnShow")(self) end end
function Frame:Hide() self.shown = false end
function Frame:SetShown(on) if on then self:Show() else self:Hide() end end
function Frame:IsShown() return self.shown end
function Frame:IsVisible() return self.shown end
function Frame:GetWidth() return self.width or 0 end
function Frame:SetWidth(w) self.width = w end
function Frame:SetText(t) self.text = t end
function Frame:GetText() return self.text end
function Frame:CreateFontString() return setmetatable({ shown = true }, Frame) end
function Frame:CreateTexture() return setmetatable({ shown = true }, Frame) end
function CreateFrame(_, name, parent) local f = setmetatable({ shown = true, parent = parent }, Frame) if name then _G[name] = f end return f end
function FIRE(e, ...) for _, f in ipairs(events[e] or {}) do local h = f:GetScript("OnEvent") if h then h(f, e, ...) end end end
GameTooltip = CreateFrame("Frame")

local timers = {}
C_Timer = { After = function(_, fn) timers[#timers + 1] = fn end }
function FLUSH() for _ = 1, 50 do if #timers == 0 then return end local list = timers timers = {} for _, fn in ipairs(list) do fn() end end end

function hooksecurefunc(a, b, c)
	local t, k, fn = _G, a, b
	if type(a) == "table" then t, k, fn = a, b, c end
	local old = t[k]
	t[k] = function(...) local r = { old(...) } fn(...) return unpack(r) end
end
SetItemRef = function() end

-- The character: a priest out of combat
LEVEL, CLASS, COMBAT = 39, "PRIEST", false
function UnitName() return "Tester" end
function UnitLevel() return LEVEL end
function UnitClass() return "Priest", CLASS end
function UnitRace() return "Human", "Human", 1 end
function UnitFactionGroup() return "Alliance" end
function InCombatLockdown() return COMBAT end
function IsPlayerSpell() return false end
function IsSpellKnown() return false end
function GetSpellInfo() end
function GetCursorInfo() end

-- The classic talent frame: each tree's talents in an order of the game's own, found by tier and column.
TALENTS, UNSPENT, LEARNED = {}, 0, {}
function GetNumTalents(tab) return TALENTS[tab] and #TALENTS[tab] or 0 end
function GetTalentInfo(tab, i) local t = TALENTS[tab][i] return t.name, "icon", t.tier, t.column, t.rank, t.max end
function LearnTalent(tab, i) LEARNED[#LEARNED + 1] = tab .. ":" .. i if UNSPENT > 0 then TALENTS[tab][i].rank = TALENTS[tab][i].rank + 1 UNSPENT = UNSPENT - 1 end end
function UnitCharacterPoints() return UNSPENT end
`, 'fake game');

for (const f of ['Core.lua', 'Data/World.lua', 'Data/Talents.lua', 'Data/Abilities.lua', 'Data/Bars.lua', 'Player.lua', 'Builds.lua', 'Notify.lua', 'Bars.lua']) {
  run(readFileSync(path.join(ADDON, f), 'utf8'), f, ['GrimoireForever', 'NS']);
}

/* ── The tests ───────────────────────────────────────────────────────────── */

run(String.raw`
local ns, B = NS, NS.Bars
local fails, count = {}, 0
local function check(what, ok, detail) count = count + 1 if not ok then fails[#fails + 1] = what .. (detail and (": " .. tostring(detail)) or "") end end
local function eq(what, got, want) check(what, got == want, "got " .. tostring(got) .. ", want " .. tostring(want)) end

FIRE("ADDON_LOADED", "GrimoireForever")
for tab, tree in ipairs(ns.talents.priest.trees) do
	TALENTS[tab] = {}
	for i = #tree.talents, 1, -1 do local t = tree.talents[i] table.insert(TALENTS[tab], { id = t.id, name = t.name, tier = t.row + 1, column = t.col + 1, rank = 0, max = t.max }) end
end
FIRE("PLAYER_LOGIN")
local function each(fn) for _, list in pairs(TALENTS) do for _, t in ipairs(list) do fn(t) end end end
local function rankOf(id) local r each(function(t) if t.id == id then r = t.rank end end) return r end
local function reset() each(function(t) t.rank = 0 end) end
-- the talents a build has after its first n points
local function spend(build, n) reset() for i = 1, n do local id = build.order[i] each(function(t) if t.id == id then t.rank = t.rank + 1 end end) end end
local function same(build, n) local want = {} for i = 1, n do want[build.order[i]] = (want[build.order[i]] or 0) + 1 end local ok = true each(function(t) if t.rank ~= (want[t.id] or 0) then ok = false end end) return ok end
local function printed(fn) local from = #PRINTS + 1 fn() return table.concat(PRINTS, "\n", from) end
local function levelUp(level) LEVEL = level ns.UpdatePlayer() return printed(function() FIRE("PLAYER_LEVEL_UP", level) FLUSH() end) end
local function tal(id) return ns.Talent("priest", id).talent.name end

local disc, shadow, raid = ns.FindBuild("priest-discipline-leveling"), ns.FindBuild("priest-shadow-leveling"), ns.FindBuild("priest-shadow-raid")
check("Discipline leveling respecs into Shadow leveling at 40", disc.next and disc.next.id == shadow.id and disc.next.at == 40)
check("Shadow leveling respecs into Shadow PvE at 60", shadow.next and shadow.next.id == raid.id and shadow.next.at == 60)
eq("the price, as the site says it", disc.next.cost, "1 gold if it is your first reset, 5 if it is your second, never more than 50. Or buy Secondary Talents at 40 for 50 gold and keep both.")
local d = ns.BuildSteps(disc, "priest")

-- Level 39 on Discipline: its own 30th point, no respec yet
ns.SelectBuild(disc.id)
LEVEL = 39 ns.UpdatePlayer()
spend(disc, 29) UNSPENT = 1
local step = B.NextPoint(ns.SelectedBuild(), "priest")
eq("at 39, Discipline's 30th point", step and step.id, d[30].id)
eq("no respec open before 40", B.OpenRespec(disc, "priest"), nil)
B.LearnNext(step) FLUSH()

-- Level 40, the talents still Discipline's: its 31st point, learnable, and the respec beside it
UNSPENT = 1
local note = levelUp(40)
check("the note at 40 names Discipline's 31st point", note:find("level 40 talent point: ", 1, true) and note:find(tal(d[31].id), 1, true), note)
check("with [Learn it]", note:find("garrmission:grimoire:learn:" .. d[31].id .. ":" .. d[31].rank, 1, true), note)
check("and the respec beside it, with its price", note:find("or respec into", 1, true) and note:find(disc.next.cost, 1, true), note)
check("never as a must", not note:find("trainer first", 1, true), note)
eq("Discipline is still the build followed", ns.char.build, disc.id)
eq("the respec is open", B.OpenRespec(disc, "priest"), shadow)
step = B.NextPoint(ns.SelectedBuild(), "priest")
eq("Learn next point offers Discipline's 31st point", step and step.id, d[31].id)
B.LearnNext(step) FLUSH()
eq("and learns it", rankOf(d[31].id), d[31].rank)
local report = printed(ns.ReportNext)
check("/grim next names the point and the respec", report:find("next talent point (Discipline leveling)", 1, true) and report:find("or respec into", 1, true), report)

-- Level 41: Discipline's 32nd point, and not a word of the respec
UNSPENT = 1
note = levelUp(41)
check("the note at 41 names Discipline's 32nd point", note:find("level 41 talent point: ", 1, true) and note:find(tal(d[32].id), 1, true), note)
check("and not the respec", not note:find("respec", 1, true), note)
step = B.NextPoint(ns.SelectedBuild(), "priest")
eq("Learn next point offers it", step and step.id, d[32].id)
B.LearnNext(step) FLUSH()
eq("and learns it", rankOf(d[32].id), d[32].rank)
check("the talents are Discipline's first 32 points", same(disc, 32))

-- The reset at the trainer: every point comes back, and Grimoire follows Shadow leveling
reset() UNSPENT = 32
FIRE("PLAYER_TALENT_UPDATE") FLUSH()
eq("after the reset Shadow leveling is followed", ns.char.build, shadow.id)
check("and a line says so", PRINTS[#PRINTS]:find("now: Discipline leveling respecs into it at 40.", 1, true), PRINTS[#PRINTS])
eq("no respec is open any more", B.OpenRespec(shadow, "priest"), nil)

-- Shadow's points only: 32 clicks spend Shadow leveling's first 32, never a point of Discipline
local wrong
for i = 1, 32 do
	local s = B.NextPoint(ns.SelectedBuild(), "priest")
	if not s or s.id ~= shadow.order[i] then wrong = i .. ": " .. (s and tal(s.id) or "none") break end
	B.LearnNext(s) FLUSH()
end
eq("Learn next point spends Shadow leveling's first 32 points", wrong, nil)
check("the talents are Shadow leveling's first 32 points", same(shadow, 32))
local _, _, upcoming = B.NextPoint(disc, "priest")
eq("asked for Discipline, the next point is still Shadow leveling's 33rd", upcoming and upcoming.id, shadow.order[33])
UNSPENT = 1
note = levelUp(42)
check("level 42's note names Shadow leveling's 33rd point", note:find("level 42 talent point: ", 1, true) and note:find(tal(shadow.order[33]), 1, true), note)
check("and no respec", not note:find("respec", 1, true), note)
B.LearnNext(B.NextPoint(ns.SelectedBuild(), "priest")) FLUSH()

-- Secondary Talents: on the set that holds Discipline, Grimoire follows Discipline; on the other, Shadow leveling
spend(disc, 32) UNSPENT = 1
FIRE("PLAYER_TALENT_UPDATE") FLUSH()
eq("on the Discipline set, Discipline leveling is followed again", ns.char.build, disc.id)
check("and a line says so", PRINTS[#PRINTS]:find("again: your talents hold its points.", 1, true), PRINTS[#PRINTS])
eq("its 33rd point is offered there", (B.NextPoint(ns.SelectedBuild(), "priest") or {}).id, d[33].id)
spend(shadow, 33) UNSPENT = 0
FIRE("PLAYER_TALENT_UPDATE") FLUSH()
eq("on the Shadow set, Shadow leveling", ns.char.build, shadow.id)
ns.SelectBuild("priest-holy-leveling")
spend(disc, 33)
FIRE("PLAYER_TALENT_UPDATE") FLUSH()
eq("a build picked by hand stays, whatever the talents", ns.char.build, "priest-holy-leveling")

-- Talents that cannot be read: Discipline as in 1.0.5, and no word of the respec past 40
ns.SelectBuild(disc.id)
local realMax = TALENTS[1][1].max
TALENTS[1][1].max = 9
UNSPENT = 1
note = levelUp(45)
check("unread talents at 45: the note names a Discipline point", note:find("level 45 talent point: ", 1, true), note)
check("and not the respec", not note:find("respec", 1, true), note)
eq("Discipline stays followed", ns.char.build, disc.id)
TALENTS[1][1].max = realMax

-- Level 60 after a reset on Discipline: both respecs at once, into Shadow leveling and on into Shadow PvE
reset() UNSPENT = 51
LEVEL = 60 ns.UpdatePlayer()
FIRE("PLAYER_TALENT_UPDATE") FLUSH()
eq("at 60 with no point spent, Shadow PvE is followed", ns.char.build, raid.id)
check("the line names the last respec", PRINTS[#PRINTS]:find("now: Shadow leveling respecs into it at 60.", 1, true), PRINTS[#PRINTS])
eq("its first point is offered", (B.NextPoint(ns.SelectedBuild(), "priest") or {}).id, raid.order[1])

-- Level 60 on a leveling build: with its last point to spend, the point and the respec; with none left, the respec
ns.SelectBuild(shadow.id)
LEVEL = 59 ns.UpdatePlayer()
spend(shadow, 50) UNSPENT = 1
note = levelUp(60)
check("at 60 the note names Shadow leveling's 51st point", note:find("level 60 talent point: ", 1, true) and note:find(tal(shadow.order[51]), 1, true), note)
check("and the respec into Shadow PvE beside it", note:find("or respec into", 1, true) and note:find("Shadow PvE", 1, true), note)
check("Secondary Talents without a level at 60", note:find("Or buy Secondary Talents for 50 gold and keep both.", 1, true), note)
eq("Learn next point offers the 51st point", (B.NextPoint(ns.SelectedBuild(), "priest") or {}).id, shadow.order[51])
spend(shadow, 51) UNSPENT = 0
LEVEL = 59 ns.UpdatePlayer()
note = levelUp(60)
check("with every point spent, the respec is the note", note:find("level 60: respec into", 1, true) and note:find("Shadow PvE", 1, true), note)
check("and no talent point", not note:find("talent point", 1, true), note)
check("the build has none left", B.Complete(shadow, "priest"))
report = printed(ns.ReportNext)
check("/grim next answers with the respec", report:find("next (Shadow leveling): respec into", 1, true), report)

-- A build with no respec is not touched
ns.SelectBuild("priest-holy-leveling")
local holy = ns.SelectedBuild()
eq("Holy leveling has none", holy.next, nil)
reset() UNSPENT = 51
eq("its first point at 60", (B.NextPoint(holy, "priest") or {}).id, holy.order[1])
eq("and no respec", B.OpenRespec(holy, "priest"), nil)

if #fails > 0 then
	RESULT = #fails .. " of " .. count .. " checks failed:\n  " .. table.concat(fails, "\n  ")
else
	RESULT = "ok: " .. count .. " checks passed"
end
`, 'tests');
result('tests');

/* ── The Talents page, drawn with the add-on's own widgets ───────────────── */

run(String.raw`
function Frame:SetSize(w, h) self.width, self.height = w, h end
function Frame:SetHeight(h) self.height = h end
function Frame:GetHeight() return self.height or 0 end
function Frame:GetStringWidth() return #(self.text or "") * 6 end
function Frame:GetUnboundedStringWidth() return #(self.text or "") * 6 end
function Frame:GetStringHeight() return self.text and self.text ~= "" and 14 or 0 end
function Frame:SetFont() return true end
function Frame:IsEnabled() return self.enabled ~= false end
function Frame:Enable() self.enabled = true end
function Frame:Disable() self.enabled = false end
function Frame:SetEnabled(on) self.enabled = on and true or false end
function Frame:GetPoint() return "CENTER", nil, "CENTER", 0, 0 end
function Frame:GetMinMaxValues() return 0, 0 end
function Frame:GetValue() return 0 end
function Frame:GetThumbTexture() return setmetatable({ shown = true }, Frame) end
function Frame:CreateMaskTexture() return setmetatable({ shown = true }, Frame) end
function Frame:GetNumLines() return 0 end
function Frame:GetFrameLevel() return 1 end
function GetLocale() return "enUS" end
UIParent = CreateFrame("Frame", "UIParent")
UIParent:SetSize(1920, 1080)
CAPTURED = {}
`, 'measuring frames');
run(readFileSync(path.join(ADDON, 'UI/Widgets.lua'), 'utf8'), 'UI/Widgets.lua', ['GrimoireForever', 'NS']);
for (const f of ['UI/Main.lua', 'UI/Planner.lua']) run(readFileSync(path.join(ADDON, f), 'utf8'), f, ['GrimoireForever', 'NS']);
run('local add = NS.AddTab; NS.AddTab = function(def) CAPTURED[def.key] = def; return add(def) end', 'capture');
run(readFileSync(path.join(ADDON, 'UI/Talents.lua'), 'utf8'), 'UI/Talents.lua', ['GrimoireForever', 'NS']);
run(String.raw`
local ns = NS
local fails, count = {}, 0
local function check(what, ok, detail) count = count + 1 if not ok then fails[#fails + 1] = what .. (detail and (": " .. tostring(detail)) or "") end end
local function each(fn) for _, list in pairs(TALENTS) do for _, t in ipairs(list) do fn(t) end end end
local function tal(id) return ns.Talent("priest", id).talent.name end
local disc, shadow = ns.FindBuild("priest-discipline-leveling"), ns.FindBuild("priest-shadow-leveling")

-- Level 40 on Discipline's 30 points with one to spend: its point, and the respec under it
LEVEL, UNSPENT = 40, 1
ns.UpdatePlayer()
each(function(t) t.rank = 0 end)
for i = 1, 30 do local id = disc.order[i] each(function(t) if t.id == id then t.rank = t.rank + 1 end end) end
ns.SelectBuild(disc.id)
ns.Open("talents")
local page = CAPTURED.talents.frame
local right = page.right
check("the page shows Discipline leveling", right.name.text == "Discipline", right.name.text)
check("its card names the respec", (right.evidence.text or ""):find("At 40: respec into Shadow leveling.", 1, true), right.evidence.text)
check("and gives no mark for a build without two guides behind it", not (right.evidence.text or ""):find("theory", 1, true) and not right.evidence.text:find("guides agree", 1, true), right.evidence.text)
check("Learn next point is offered", right.learn:IsShown() and right.learn:IsEnabled())
check("on Discipline's 31st point", right.learn.tipTitle == tal(disc.order[31]), right.learn.tipTitle)
check("the status names the respec under the point", (right.status.text or ""):find("\nOr respec into", 1, true) and right.status.text:find("class trainer", 1, true), right.status.text)

-- The reset: the page follows Shadow leveling and offers its first point
each(function(t) t.rank = 0 end)
UNSPENT = 31
FIRE("PLAYER_TALENT_UPDATE")
FLUSH()
page:Update()
check("after the reset the page shows Shadow leveling", right.name.text == "Shadow", right.name.text)
check("followed", right.following:IsShown())
check("Learn next point is offered", right.learn:IsShown() and right.learn:IsEnabled())
check("on Shadow leveling's first point", right.learn.tipTitle == tal(shadow.order[1]), right.learn.tipTitle)
check("and the status has no respec", not (right.status.text or ""):find("respec", 1, true), right.status.text)

if #fails > 0 then
	RESULT = #fails .. " of " .. count .. " page checks failed:\n  " .. table.concat(fails, "\n  ")
else
	RESULT = "ok: " .. count .. " page checks passed"
end
`, 'page tests');
result('page tests');
