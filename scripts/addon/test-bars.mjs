#!/usr/bin/env node
// Tests the add-on's Bars.lua in a Lua VM (fengari) against a fake game: a character, action slots and a cursor, spells
// known and learned, combat, the class trainer and the classic talent frame. Loads the add-on's own files (Core, the
// generated Data, Player, Builds, Notify, Bars), so run it after node scripts/addon/build.mjs.
//
//   node scripts/addon/test-bars.mjs
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
function Frame:GetID() return self.id or 0 end
function Frame:SetID(id) self.id = id end
function Frame:GetFrameLevel() return 1 end
function Frame:GetWidth() return self.width or 0 end
function Frame:SetWidth(w) self.width = w end
function Frame:SetText(t) self.text = t end
function Frame:GetText() return self.text end
function Frame:CreateFontString() return setmetatable({ shown = true }, Frame) end
function Frame:CreateTexture() return setmetatable({ shown = true }, Frame) end
CREATED = {}
function CreateFrame(_, name, parent) local f = setmetatable({ shown = true, parent = parent }, Frame) if name then _G[name] = f end CREATED[#CREATED + 1] = f return f end
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

-- The character
LEVEL, CLASS, COMBAT = 20, "WARRIOR", false
function UnitName() return "Tester" end
function UnitLevel() return LEVEL end
function UnitClass() return "Warrior", CLASS end
function UnitRace() return "Human", "Human", 1 end
function UnitFactionGroup() return "Alliance" end
function InCombatLockdown() return COMBAT end
KNOWN = {}
function IsPlayerSpell(id) return KNOWN[id] == true end
function IsSpellKnown(id) return KNOWN[id] == true end
SPELLS = {} -- id -> name, filled from the data once it is loaded
function GetSpellInfo(x)
	if type(x) == "number" then return SPELLS[x], nil, "Interface\\Icons\\spell" .. x, 0, 0, 0, x end
	local best
	for id, name in pairs(SPELLS) do if name == x and KNOWN[id] and (not best or id > best) then best = id end end
	if best then return x, nil, "icon", 0, 0, 0, best end
end
function GetSpellTexture(id) return "Interface\\Icons\\spell" .. id end

-- Action slots and the cursor
SLOTS, CURSOR, MACROS, BAGS = {}, nil, {}, {}
PAGE, BONUS, FORM = 1, 0, 0
local function clone(t) if not t then return nil end local o = {} for k, v in pairs(t) do o[k] = v end return o end
function HasAction(s) return SLOTS[s] ~= nil end
function GetActionInfo(s) local a = SLOTS[s] if a then return a.kind, a.id, a.sub end end
function GetActionText(s) local a = SLOTS[s] return a and a.text end
function GetActionTexture(s) return SLOTS[s] and "tex" or nil end
function GetCursorInfo() return CURSOR and CURSOR.kind end
function ClearCursor() CURSOR = nil end
function PickupSpell(id) if KNOWN[id] then CURSOR = { kind = "spell", id = id } end end
function PickupMacro(i) if MACROS[i] then CURSOR = { kind = "macro", id = i, text = MACROS[i] } end end
function GetMacroIndexByName(n) for i, m in pairs(MACROS) do if m == n then return i end end return 0 end
function PickupItem(id) if BAGS[id] then CURSOR = { kind = "item", id = id } end end
function PickupAction(s) CURSOR = clone(SLOTS[s]) SLOTS[s] = nil end
function PlaceAction(s) local old = SLOTS[s] SLOTS[s] = clone(CURSOR) CURSOR = clone(old) end
function GetActionBarPage() return PAGE end
function GetBonusBarOffset() return BONUS end
function GetShapeshiftForm() return FORM end
function GetShapeshiftFormInfo() return "icon", true, true, 2457 end
NUM_ACTIONBAR_PAGES = 6

-- The classic talent frame: each tree's talents in an order of the game's own, found by tier and column.
TALENTS, UNSPENT, LEARNED = {}, 0, {}
function GetNumTalents(tab) return TALENTS[tab] and #TALENTS[tab] or 0 end
function GetTalentInfo(tab, i) local t = TALENTS[tab][i] return t.name, "icon", t.tier, t.column, t.rank, t.max end
function LearnTalent(tab, i) LEARNED[#LEARNED + 1] = tab .. ":" .. i if UNSPENT > 0 then TALENTS[tab][i].rank = TALENTS[tab][i].rank + 1 UNSPENT = UNSPENT - 1 end end
function UnitCharacterPoints() return UNSPENT end

-- The class trainer
SERVICES, MONEY = {}, 100000
function GetNumTrainerServices() return #SERVICES end
function GetTrainerServiceInfo(i) local s = SERVICES[i] if s then return s[1], s[2], s[3] end end
function GetTrainerServiceCost(i) return SERVICES[i] and SERVICES[i][4] or 0 end
function IsTradeskillTrainer() return false end
function GetMoney() return MONEY end
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

for _, a in ipairs(ns.abilities.warrior) do SPELLS[a.id] = a.name end
local function ids(key) local out = {} for _, e in ipairs(B.Ladder("warrior").byKey[key]) do out[e.rank] = e.id end return out end
local function know(key, upTo) for r, id in pairs(ids(key)) do if r <= (upTo or 1) then KNOWN[id] = true end end end

-- A level 20 warrior following the Arms leveling build: the trainer spells up to 20, no talent spell yet.
FIRE("ADDON_LOADED", "GrimoireForever")
for _, key in ipairs({ "Battle Shout", "Heroic Strike", "Charge", "Rend", "Thunder Clap", "Hamstring", "Bloodrage", "Overpower", "Slam", "Victory Rush" }) do know(key, 2) end
-- the classic talent frame, each tree listed backwards so its order is not Grimoire's
for tab, tree in ipairs(ns.talents.warrior.trees) do
	TALENTS[tab] = {}
	for i = #tree.talents, 1, -1 do local t = tree.talents[i] table.insert(TALENTS[tab], { id = t.id, name = t.name, tier = t.row + 1, column = t.col + 1, rank = 0, max = t.max }) end
end
FIRE("PLAYER_LOGIN")
ns.SelectBuild("warrior-arms-leveling")
local build = ns.SelectedBuild()
check("follows the Arms leveling build", build and build.id == "warrior-arms-leveling")

-- Layouts ------------------------------------------------------------------------------------------------------
local layout, from = B.Layout(build, "warrior")
eq("a Grimoire build's own bar", from, build)
eq("bar key 4", layout[4], "Mortal Strike")
local _, fromBase = B.Layout({ id = "custom-1", base = "warrior-fury-raid", spec = "fury" }, "warrior")
eq("one of your builds takes its base build's bar", fromBase and fromBase.id, "warrior-fury-raid")
local _, fromSpec = B.Layout({ id = "custom-2", spec = "protection" }, "warrior")
eq("one of yours without a base takes its spec's leveling bar below 60", fromSpec and fromSpec.id, "warrior-protection-leveling")
LEVEL = 60 ns.UpdatePlayer()
_, fromSpec = B.Layout({ id = "custom-2", spec = "protection" }, "warrior")
eq("and its spec's PvE bar at 60", fromSpec and fromSpec.id, "warrior-protection-tank")
LEVEL = 20 ns.UpdatePlayer()
eq("no bar without a spec", B.Layout({ id = "custom-3" }, "warrior"), nil)

-- The plan -----------------------------------------------------------------------------------------------------
local rend, hs, bs, slam, vr = ids("Rend"), ids("Heroic Strike"), ids("Battle Shout"), ids("Slam"), ids("Victory Rush")
MACROS = { [1] = "Pull", [2] = "Mount" }
BAGS = { [6948] = true }
SLOTS = {
	[1] = { kind = "spell", id = rend[1] },                -- Rend, an old rank, where the build wants Rend
	[4] = { kind = "spell", id = hs[1] },                  -- Heroic Strike on Mortal Strike's key: it moves to key 2
	[5] = { kind = "macro", id = 2, text = "Mount" },      -- a macro on Slam's key
	[7] = { kind = "item", id = 6948 },                    -- the Hearthstone on Victory Rush's key
	[9] = { kind = "spell", id = 99999, sub = "pet" },     -- something Undo could not put back, on Bloodrage's key
	[12] = { kind = "spell", id = bs[2] },                 -- Battle Shout already in place
	[30] = { kind = "spell", id = hs[2] },                 -- another bar: never touched
}
local plan = B.Plan(build, "warrior")
eq("main bar starts at slot 1", plan.first, 0)
eq("bar name", plan.bar, "your main bar")
eq("key 1 gets Rend's best rank", plan.slots[1].spell, rend[2])
check("key 1 changes", plan.slots[1].change)
eq("Mortal Strike is not known: no spell", plan.slots[4].spell, nil)
eq("Mortal Strike comes with the build's talent point at 40", plan.slots[4].level, 40)
eq("from a talent", plan.slots[4].how, "talent")
eq("Heroic Strike on key 4 moves to key 2", plan.slots[4].moved, 2)
eq("so key 4 empties", plan.slots[4].after, nil)
eq("Execute is learned at 24", plan.slots[6].level, 24)
eq("from the trainer", plan.slots[6].how, "trainer")
eq("an unknown spell's key keeps what it has", plan.slots[6].after, nil)
check("the pet action's key is kept", plan.slots[9].kept and not plan.slots[9].change)
eq("Battle Shout already in place: no change", plan.slots[12].change, false)
eq("Spearing Strike, key 0, comes with the build's talent point at 25", plan.slots[10].level, 25)
eq("from a talent, so key 0 does not change yet", plan.slots[10].how, "talent")
eq("keys that change", plan.changes, 7)
eq("spells that come later", plan.later, 4)
eq("keys kept", plan.kept, 1)
local caption = B.WhenText(40, "talent")
eq("caption for a spell to come", caption, "at level\n40")
eq("caption for a spell to train now", (B.WhenText(12, "trainer")), "at the\ntrainer")
eq("caption for a talent the build skips", (B.WhenText(nil, "talent")), "not in\nyour build")

-- Apply and Undo -----------------------------------------------------------------------------------------------
local before = {}
for s = 1, 40 do before[s] = SLOTS[s] and (SLOTS[s].kind .. ":" .. tostring(SLOTS[s].id) .. ":" .. tostring(SLOTS[s].text)) or "-" end
local function snapshot() local t = {} for s = 1, 40 do t[s] = SLOTS[s] and (SLOTS[s].kind .. ":" .. tostring(SLOTS[s].id) .. ":" .. tostring(SLOTS[s].text)) or "-" end return t end
COMBAT = true
B.Apply()
check("in combat Apply waits", B.Waiting("bars"))
eq("and nothing moves", SLOTS[1].id, rend[1])
COMBAT = false
FIRE("PLAYER_REGEN_ENABLED")
FLUSH()
check("then it runs when combat ends", not B.Waiting("bars"))
eq("key 1: Rend rank 2", SLOTS[1].id, rend[2])
eq("key 2: Heroic Strike's best rank", SLOTS[2].id, hs[2])
eq("key 4: emptied", SLOTS[4], nil)
eq("key 5: Slam's best rank", SLOTS[5].id, slam[2])
eq("key 7: Victory Rush", SLOTS[7].id, vr[1])
eq("key 9: kept", SLOTS[9].id, 99999)
eq("key 11: Charge's best rank", SLOTS[11].id, ids("Charge")[2])
eq("slot 30 untouched", SLOTS[30].id, hs[2])
eq("nothing left on the cursor", CURSOR, nil)
check("the undo is saved with the character", B.CanUndo() and ns.char.barsUndo.first == 0)
eq("a second Apply with nothing to change keeps the undo", (function() B.Apply() return ns.char.barsUndo ~= nil end)(), true)
-- a macro deleted before Mount changes Mount's number; Undo finds it by name
MACROS = { [1] = "Mount" }
B.Undo()
local after = snapshot()
local same = true
for s = 1, 40 do if s ~= 5 and after[s] ~= before[s] then same = false end end
check("Undo puts every key back", same)
eq("the macro comes back by name", SLOTS[5] and SLOTS[5].text, "Mount")
eq("and at its new number", SLOTS[5] and SLOTS[5].id, 1)
eq("the item comes back", SLOTS[7] and SLOTS[7].id, 6948)
eq("and the undo is spent", B.CanUndo(), false)
-- an item gone from the bags cannot come back, and Undo says so
B.Apply()
BAGS = {}
B.Undo()
check("an item no longer in the bags is reported", B.note and B.note.color == "red", B.note and B.note.text)

-- In a stance the main bar is the stance's ---------------------------------------------------------------------
BONUS, FORM = 1, 1
eq("Battle Stance's bar starts after slot 72", B.MainBar(), 72)
eq("and is named for the stance", B.Plan(build, "warrior").bar, "your Battle Stance bar")
eq("its first key is slot 73", B.Plan(build, "warrior").slots[1].slot, 73)
BONUS, FORM = 0, 0

-- New ranks ----------------------------------------------------------------------------------------------------
SLOTS = { [20] = { kind = "spell", id = rend[2] }, [21] = { kind = "spell", id = rend[1] }, [80] = { kind = "spell", id = rend[2] } }
B.CheckRanks()
KNOWN[rend[3]] = true
FIRE("SPELLS_CHANGED")
FLUSH()
eq("the best rank you had takes the new one", SLOTS[20].id, rend[3])
eq("on every bar", SLOTS[80].id, rend[3])
eq("a lower rank kept on purpose stays", SLOTS[21].id, rend[1])
check("and a line says so", PRINTS[#PRINTS]:find("new rank on your bars", 1, true), PRINTS[#PRINTS])
KNOWN[rend[4]] = true
COMBAT = true
FIRE("SPELLS_CHANGED")
FLUSH()
eq("in combat the swap waits", SLOTS[20].id, rend[3])
COMBAT = false
FIRE("PLAYER_REGEN_ENABLED")
FLUSH()
eq("and happens when combat ends", SLOTS[20].id, rend[4])
ns.db.barRanks = false
KNOWN[rend[5]] = true
FIRE("SPELLS_CHANGED")
FLUSH()
eq("with the setting off, no swap", SLOTS[20].id, rend[4])
ns.db.barRanks = true

-- The trainer --------------------------------------------------------------------------------------------------
ns.UI = {
	colors = { gilt = { 1, 1, 1 }, menu = { 0, 0, 0, 1 }, giltLine = { 1, 1, 1, 1 } },
	Surface = function() return { SetFill = function() end, SetBorder = function() end } end,
	Text = function(parent) return parent:CreateFontString() end,
	TextWidth = function(fs) return #(fs.text or "") * 5 end,
	TextTooltip = function() end,
}
CreateFrame("Frame", "ClassTrainerFrame")
ClassTrainerFrame_Update = function() end
SERVICES = {
	{ "Rend", "Rank 3", "available", 1200 },
	{ "Battle Shout", "Rank 3", "available", 1000 },
	{ "Shield Bash", "Rank 1", "available", 600 },
	{ "Overpower", "Rank 2", "unavailable", 2000 },
	{ "Rend", "Rank 2", "used", 0 },
}
for i = 1, 11 do local b = CreateFrame("Button", "ClassTrainerSkill" .. i) b:SetID(i) b.shown = i <= #SERVICES end
FIRE("ADDON_LOADED", "Blizzard_TrainerUI")
ClassTrainerFrame_Update()
local function tagOf(i)
	local row = _G["ClassTrainerSkill" .. i]
	for _, f in ipairs(CREATED) do if f.parent == row and f.text and f.text.text == "Build" then return f end end
end
local function chip()
	for _, f in ipairs(CREATED) do if f.parent == ClassTrainerFrame and f.text and type(f.text.text) == "string" and f.text.text:find("Your build", 1, true) then return f end end
end
local names = B.TrainerNames()
local n, cost = B.TrainerSummary(names)
eq("the build's spells to learn here now", n, 2)
eq("and their cost", cost, 2200)
eq("money as the site writes it", B.Money(cost), "22s")
eq("gold and silver", B.Money(12050), "1g 20s")
eq("copper alone", B.Money(80), "80c")
check("Rend's row has the gold tag", tagOf(1) and tagOf(1).shown)
check("Battle Shout's row too", tagOf(2) and tagOf(2).shown)
check("Shield Bash, not on the bar, has none", not (tagOf(3) and tagOf(3).shown))
check("the summary line", chip() and chip().shown and chip().text.text:find("Your build: 2 spells, ", 1, true), chip() and chip().text.text)
check("in gold while you can pay", chip().text.text:find(ns.HEX.gold, 1, true))
MONEY = 100
ClassTrainerFrame_Update()
check("in red when you cannot", chip().text.text:find(ns.HEX.red, 1, true))
MONEY = 100000
SERVICES[1][3], SERVICES[2][3] = "used", "used"
ClassTrainerFrame_Update()
check("nothing left to learn says so", chip().text.text:find("nothing to learn here now", 1, true), chip().text.text)
ns.StopFollowing()
ClassTrainerFrame_Update()
check("without a build: no line", not chip().shown)
check("and no tags", not tagOf(1).shown and not tagOf(2).shown)
ns.SelectBuild("warrior-arms-leveling")
build = ns.SelectedBuild()
IsTradeskillTrainer = function() return true end
ClassTrainerFrame_Update()
check("a profession trainer gets neither", not chip().shown and not tagOf(1).shown)
IsTradeskillTrainer = function() return false end

-- Learn next point ---------------------------------------------------------------------------------------------
LEVEL = 12 ns.UpdatePlayer()
local function setRank(id, r) for _, list in pairs(TALENTS) do for _, t in ipairs(list) do if t.id == id then t.rank = r end end end end
local function rankOf(id) for _, list in pairs(TALENTS) do for _, t in ipairs(list) do if t.id == id then return t.rank end end end end
setRank(10002, 2) -- Improved Rend 2 of 3, as the build's first two points
UNSPENT = 1
local step, how = B.NextPoint(build, "warrior")
eq("next point: Improved Rend", step and step.id, 10002)
eq("its third rank", step and step.rank, 3)
eq("through the classic talent frame", how, "classic")
local link = B.LearnLink(step)
check("the level-up note gets a [Learn it] link", link:find("garrmission:grimoire:learn:10002:3", 1, true), link)
B.LearnNext({ id = 10000, rank = 1 })
eq("a stale step learns nothing", #LEARNED, 0)
COMBAT = true
B.LearnNext(step)
eq("in combat it waits", #LEARNED, 0)
COMBAT = false
FIRE("PLAYER_REGEN_ENABLED")
FLUSH()
eq("then learns once, where the game keeps the talent", LEARNED[1], (function() for i, t in ipairs(TALENTS[1]) do if t.id == 10002 then return "1:" .. i end end end)())
eq("Improved Rend is 3 of 3", rankOf(10002), 3)
check("and says so", PRINTS[#PRINTS]:find("learned", 1, true), PRINTS[#PRINTS])
local none, why, upcoming = B.NextPoint(build, "warrior")
eq("no point left to spend", why, "points")
local fourth = build.order[4] -- the point after Improved Rend 3 of 3, as the build orders it
check("the build's fourth point is another talent than Improved Rend", fourth and fourth ~= 10002, fourth)
eq("the next one named", upcoming and upcoming.id, fourth)
eq("no link without a point", B.LearnLink(upcoming), "")
UNSPENT = 1
local _, whyTier = B.NextPoint({ id = "test", order = { 10010 } }, "warrior")
eq("a talent whose row is not open", whyTier, "tier")
-- the chat link spends the point it names, through the game's link handler; a right click or shift-click does not
local chatLink = B.LearnLink((B.NextPoint(build, "warrior"))):match("|H(.-)|h")
SetItemRef(chatLink, "[Learn it]", "RightButton")
IsModifiedClick = function() return true end
SetItemRef(chatLink, "[Learn it]", "LeftButton")
IsModifiedClick = nil
FLUSH()
eq("a right click or a shift-click on the link learns nothing", rankOf(fourth), 0)
SetItemRef(chatLink, "[Learn it]", "LeftButton")
FLUSH()
eq("the chat link learned the build's fourth point", rankOf(fourth), 1)
-- a double click before the game answers spends one point, not two
local asked, realLearn = 0, LearnTalent
LearnTalent = function() asked = asked + 1 end -- the server has not answered yet: the talents still read as before
UNSPENT = 1
local pending = B.NextPoint(build, "warrior")
check("a point to learn for the double click", pending ~= nil)
B.LearnNext(pending)
B.LearnNext(pending)
eq("a second click while the first waits for the game learns nothing", asked, 1)
FLUSH()
LearnTalent = realLearn
-- a client whose talent frame is not Grimoire's trees: no guess
local realMax = TALENTS[1][1].max
TALENTS[1][1].max = 9
local _, whyRead = B.NextPoint(build, "warrior")
eq("trees that do not match are not read", whyRead, "unread")
TALENTS[1][1].max = realMax

if #fails > 0 then
	RESULT = #fails .. " of " .. count .. " checks failed:\n  " .. table.concat(fails, "\n  ")
else
	RESULT = "ok: " .. count .. " checks passed"
end
`, 'tests');

lua.lua_getglobal(L, to_luastring('RESULT'));
const result = lua.lua_tojsstring(L, -1);
console.log(result);
if (!result.startsWith('ok')) process.exitCode = 1;

/* ── The Talents page, drawn with the add-on's own widgets ───────────────── */

// Frames that measure: widths, heights and text sizes for the layout code, and buttons that enable.
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
function GetLocale() return "enUS" end
UIParent = CreateFrame("Frame", "UIParent")
UIParent:SetSize(1920, 1080)
CAPTURED = {}
`, 'measuring frames');
run(readFileSync(path.join(ADDON, 'UI/Widgets.lua'), 'utf8'), 'UI/Widgets.lua', ['GrimoireForever', 'NS']);
for (const f of ['UI/Main.lua', 'UI/Planner.lua']) run(readFileSync(path.join(ADDON, f), 'utf8'), f, ['GrimoireForever', 'NS']);
// the page's own frame, as Main.lua builds it
run('local add = NS.AddTab; NS.AddTab = function(def) CAPTURED[def.key] = def; return add(def) end', 'capture');
run(readFileSync(path.join(ADDON, 'UI/Talents.lua'), 'utf8'), 'UI/Talents.lua', ['GrimoireForever', 'NS']);
run(String.raw`
local ns, B = NS, NS.Bars
local fails, count = {}, 0
local function check(what, ok, detail) count = count + 1 if not ok then fails[#fails + 1] = what .. (detail and (": " .. tostring(detail)) or "") end end
local function click(button) button:GetScript("OnClick")(button, "LeftButton") end

LEVEL, UNSPENT, COMBAT = 20, 0, false
for _, list in pairs(TALENTS) do for _, t in ipairs(list) do t.rank = 0 end end
ns.UpdatePlayer()
SLOTS = {}
ns.char.barsUndo = nil
ns.SelectBuild("warrior-arms-leveling")
ns.Open("talents")
local page = CAPTURED.talents.frame
local right = page.right
check("the Talents page opens on the build you follow", right and right:IsShown())
check("Set up my bars is offered", right.bars:IsShown())
check("the preview starts closed", not right.barsPanel:IsShown())
click(right.bars)
local panel = right.barsPanel
check("Set up my bars opens the preview", panel:IsShown())
check("the button shows it is open", right.bars.selected)
check("the preview names the bar", panel.title.text == "Keys 1 to = on your main bar", panel.title.text)
check("twelve keys, 1 to =", panel.cols[1].key.text == "1" and panel.cols[11].key.text == "-" and panel.cols[12].key.text == "=")
check("a spell to come is greyed with its level", panel.cols[4].caption.text == "at level\n40", panel.cols[4].caption.text)
check("Apply is ready", panel.apply:IsEnabled())
check("Undo has nothing to undo", not panel.undo:IsEnabled())
click(panel.apply)
FLUSH()
check("Apply puts Rend on key 1", SLOTS[1] and SLOTS[1].kind == "spell")
check("Undo is ready after", panel.undo:IsEnabled())
check("and the note says what happened", panel.note.text and panel.note.text:find("Done", 1, true), panel.note.text)
click(panel.undo)
FLUSH()
check("Undo empties the bar again", next(SLOTS) == nil)
click(right.bars)
check("a second click closes the preview", not panel:IsShown())

-- Learn next point, when a point is yours to spend
LEVEL, UNSPENT = 12, 1
ns.UpdatePlayer()
for _, list in pairs(TALENTS) do for _, t in ipairs(list) do if t.id == 10002 then t.rank = 2 end end end
page:Update()
check("Learn next point shows with a point to spend", right.learn:IsShown())
check("and is ready", right.learn:IsEnabled())
check("its tooltip names the point", right.learn.tipTitle == "Improved Rend", right.learn.tipTitle)
click(right.learn)
FLUSH()
check("a click learns it", #LEARNED > 0)
page:Update()
check("with no point left, it goes away", not right.learn:IsShown())

-- Not following: neither shows
ns.StopFollowing()
page:Update()
check("not following: no Set up my bars", not right.bars:IsShown())
check("and no Learn next point", not right.learn:IsShown())

-- The preview's own redraw when the bar changes under it
ns.SelectBuild("warrior-arms-leveling")
LEVEL = 20 ns.UpdatePlayer()
page:Update()
click(right.bars)
SLOTS[3] = { kind = "spell", id = 12345 }
FIRE("ACTIONBAR_SLOT_CHANGED", 3)
FLUSH()
check("the preview redraws when a key changes", panel.cols[3].now.texture and true, "no icon")

if #fails > 0 then
	RESULT = #fails .. " of " .. count .. " page checks failed:\n  " .. table.concat(fails, "\n  ")
else
	RESULT = "ok: " .. count .. " page checks passed"
end
`, 'page tests');
lua.lua_getglobal(L, to_luastring('RESULT'));
const pageResult = lua.lua_tojsstring(L, -1);
console.log(pageResult);
if (!pageResult.startsWith('ok')) process.exitCode = 1;
