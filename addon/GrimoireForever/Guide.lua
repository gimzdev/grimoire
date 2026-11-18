-- The leveling guide in game: your starting zone's route from 1 to 60, one step at a time. It follows the quest log,
-- your zone, flight masters, trainers and your level to know when a step is done, and works out where the next place
-- is from where you stand, for the arrow.
local _, ns = ...

local Guide = {}
ns.Guide = Guide

-- Step kinds, as Data/Guide.lua writes them. A step is { kind, a, b, area, x, y, level, c } (see scripts/addon/build.mjs).
-- A note (a its number in ns.guide.info) and an optional dungeon (a its number in ns.guide.dun, and the ids of the quests to
-- take first in step[8]) have no place: no arrow, no pin, no distance.
local ACCEPT, TURNIN, DO, ZONE, FLY, BOAT, FLIGHTPATH, TRAIN, GRIND, HEARTH, BIND, TELEPORT = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
local NOTE, DUNGEON = 13, 14
Guide.ACCEPT, Guide.TURNIN, Guide.DO, Guide.ZONE, Guide.FLY, Guide.BOAT, Guide.FLIGHTPATH, Guide.TRAIN, Guide.GRIND = ACCEPT, TURNIN, DO, ZONE, FLY, BOAT, FLIGHTPATH, TRAIN, GRIND
Guide.HEARTH, Guide.BIND, Guide.TELEPORT = HEARTH, BIND, TELEPORT
Guide.NOTE, Guide.DUNGEON = NOTE, DUNGEON
local HEARTHSTONE = 8690 -- the Hearthstone's spell
-- Objective kinds in a quest's data: kill, use an object, collect an item, explore, talk to someone, escort someone,
-- use an item (on what its sources name).
local KILL, OBJECT, ITEM, EXPLORE, TALK, ESCORT, USE = 1, 2, 3, 4, 5, 6, 7

local atan2 = math.atan2 or function(y, x)
	return math.atan(y, x)
end

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

local function data()
	return ns.guide
end

--- Whether the optional dungeons are in the route (Options, or the guide window's menu). On to start with, and for anything but false.
local function dungeonsOn()
	return ns.db == nil or ns.db.guideDungeons ~= false
end
Guide.DungeonsOn = dungeonsOn

--- Whether a step is left out as the settings stand: a dungeon while Dungeons is off. It is passed over without a word, and
--- no count has it.
local function hidden(step)
	return step ~= nil and step[1] == DUNGEON and not dungeonsOn()
end
Guide.Hidden = hidden

--- Whether a step has no place to go to (a note, a dungeon): no arrow, no map pin, no distance.
local function placeless(step)
	return step ~= nil and (step[1] == NOTE or step[1] == DUNGEON)
end
Guide.Placeless = placeless

-- The quest log, in whichever form the client offers it -------------------------------------------------------------

local function completed(id)
	if C_QuestLog and C_QuestLog.IsQuestFlaggedCompleted then
		return C_QuestLog.IsQuestFlaggedCompleted(id) == true
	end
	return IsQuestFlaggedCompleted and IsQuestFlaggedCompleted(id) == true or false
end

local function onQuest(id)
	if C_QuestLog and C_QuestLog.IsOnQuest then
		return C_QuestLog.IsOnQuest(id) == true
	end
	if C_QuestLog and C_QuestLog.GetLogIndexForQuestID then
		return (C_QuestLog.GetLogIndexForQuestID(id) or 0) > 0
	end
	return GetQuestLogIndexByID and (GetQuestLogIndexByID(id) or 0) > 0 or false
end

local function readyToTurnIn(id)
	if C_QuestLog and C_QuestLog.ReadyForTurnIn then
		return C_QuestLog.ReadyForTurnIn(id) == true
	end
	if C_QuestLog and C_QuestLog.IsComplete then
		return C_QuestLog.IsComplete(id) == true
	end
	return false
end

local function questObjectives(id)
	if C_QuestLog and C_QuestLog.GetQuestObjectives then
		return C_QuestLog.GetQuestObjectives(id) or {}
	end
	return {}
end

local function questCount()
	if C_QuestLog and C_QuestLog.GetNumQuestLogEntries then
		local _, quests = C_QuestLog.GetNumQuestLogEntries()
		return plain(quests) and quests or 0
	end
	return 0
end

Guide.Completed, Guide.OnQuest = completed, onQuest

-- Names ----------------------------------------------------------------------------------------------------------

function Guide.EntityName(e)
	local d = data()
	if not d or not e or e == 0 then
		return nil
	end
	if e > 0 then
		return d.npcs[e]
	end
	return d.objects[-e]
end

function Guide.QuestName(id)
	-- A dungeon's quests are not the route's own: their names are with the quests you can take (G.starts).
	local d = data()
	local q = d and (d.quests[id] or (d.starts and d.starts[id]))
	return q and q[1] or ("Quest " .. tostring(id))
end

function Guide.ZoneName(area)
	local z = data() and data().zones[area]
	return z and z[1] or ""
end

function Guide.TaxiName(node)
	local t = data() and data().taxi[node]
	return t and t[1] or "the flight master"
end

--- "Sentinel Hill, Westfall" -> "Sentinel Hill"; a capital's node keeps its own name.
function Guide.TaxiShort(node)
	local name = Guide.TaxiName(node)
	return name:match("^(.-),") or name
end

-- Where you are and where things are -------------------------------------------------------------------------------

--- A point on a zone map (area, x, y in percent) in world yards: continent, north, west.
function Guide.World(area, x, y)
	local z = data() and data().zones[area]
	if not z or not x or not y then
		return nil
	end
	local left, right, top, bottom = z[4], z[5], z[6], z[7]
	return z[3], top - y / 100 * (top - bottom), left - x / 100 * (left - right)
end

--- Your position in world yards: continent, north, west; nil inside an instance or when the game keeps it from add-ons.
function Guide.PlayerWorld()
	if UnitPosition then
		local north, west, _, instance = UnitPosition("player")
		if plain(north) and plain(west) and plain(instance) then
			return instance, north, west
		end
	end
	if C_Map and C_Map.GetBestMapForUnit and C_Map.GetPlayerMapPosition and C_Map.GetWorldPosFromMapPos then
		local map = C_Map.GetBestMapForUnit("player")
		local pos = plain(map) and C_Map.GetPlayerMapPosition(map, "player")
		if pos then
			local continent, world = C_Map.GetWorldPosFromMapPos(map, pos)
			if plain(continent) and plain(world) and world and plain(world.x) and plain(world.y) then
				return continent, world.x, world.y
			end
		end
	end
	return nil
end

--- Your position on a zone's own map, in the yards of its estimated rectangle (G.zones' 8th field): continent, north, west;
--- nil when you are not on that map. For a zone no open data places in the world, where only its map is known.
local function playerOnZoneMap(z)
	if not (C_Map and C_Map.GetPlayerMapPosition and plain(z[2])) then
		return nil
	end
	local pos = C_Map.GetPlayerMapPosition(z[2], "player")
	local px, py = pos and pos.x, pos and pos.y
	if not (plain(px) and plain(py)) or px <= 0 or py <= 0 or px >= 1 or py >= 1 then
		return nil
	end
	local left, right, top, bottom = z[4], z[5], z[6], z[7]
	return z[3], top - py * (top - bottom), left - px * (left - right)
end

--- From you to a point: yards, and the angle to turn (radians, positive to the left), or nil when it is on another
--- continent or your position is unknown. facing is nil when the game does not say which way you face. In a zone placed
--- on its own map (an estimated size), both ends are read on that map and the yards are an estimate.
function Guide.Toward(area, x, y)
	local map, north, west = Guide.World(area, x, y)
	local z = data() and data().zones[area]
	local pmap, pnorth, pwest
	if z and z[8] then
		pmap, pnorth, pwest = playerOnZoneMap(z)
		if not pmap then
			return nil, "map"
		end
	else
		pmap, pnorth, pwest = Guide.PlayerWorld()
	end
	if not map or not pmap then
		return nil, "unknown"
	end
	if map ~= pmap then
		return nil, "continent"
	end
	local dn, dw = north - pnorth, west - pwest
	local yards = math.sqrt(dn * dn + dw * dw)
	local bearing = atan2(dw, dn)
	local facing = GetPlayerFacing and GetPlayerFacing()
	if not plain(facing) then
		return yards, nil, bearing
	end
	-- Facing runs 0 to 2 pi and the bearing -pi to pi: wrap the difference, so behind you is always near +-pi.
	return yards, (bearing - facing + math.pi) % (2 * math.pi) - math.pi, bearing
end

local function distanceTo(area, x, y)
	local yards = Guide.Toward(area, x, y)
	return yards
end

-- Your route and where you are in it -------------------------------------------------------------------------------

local function state()
	ns.char.guide = ns.char.guide or {}
	local st = ns.char.guide
	st.skip = st.skip or {}
	st.done = st.done or {}
	return st
end

function Guide.Routes()
	return data() and data().routes or {}
end

-- A route's steps come as one string (Data/Guide.lua): read when the route is first opened.
local LETTER = { A = ACCEPT, T = TURNIN, C = DO, Z = ZONE, F = FLY, B = BOAT, P = FLIGHTPATH, R = TRAIN, L = GRIND, H = HEARTH, N = BIND, S = TELEPORT, I = NOTE, D = DUNGEON }
local function number(field)
	if not field or field == "" then
		return 0
	end
	if field:sub(1, 1) == "~" then
		return -(tonumber(field:sub(2), 36) or 0)
	end
	return tonumber(field, 36) or 0
end
local function decode(text)
	local steps = {}
	for token in text:gmatch("[^;]+") do
		local f = {}
		for field in (token:sub(2) .. ","):gmatch("([^,]*),") do
			f[#f + 1] = field
		end
		local kind = LETTER[token:sub(1, 1)] or 0
		local step = { kind, number(f[1]), number(f[2]), number(f[3]), number(f[4]) / 10, number(f[5]) / 10, number(f[6]) }
		if kind == DUNGEON then
			-- A dungeon: the ids of the quests to take first follow its level (none for most of Forever's own).
			local ids = {}
			for k = 7, #f do
				if f[k] ~= "" then
					ids[#ids + 1] = number(f[k])
				end
			end
			step[8] = ids
		elseif kind == ZONE and #f > 7 then
			-- The zones crossed on foot on the way: zone, x, y (tenths of a percent), in order.
			local via = {}
			for k = 8, #f - 2, 3 do
				via[#via + 1] = { number(f[k]), number(f[k + 1]) / 10, number(f[k + 2]) / 10 }
			end
			step[8] = via
		elseif kind == GRIND and #f > 7 then
			-- The mob's level, then a dungeon offered instead: its number, the percent of the level its quests give, their ids.
			if f[7] ~= "" then
				step[8] = number(f[7])
			end
			local ids = {}
			for k = 10, #f do
				if f[k] ~= "" then
					ids[#ids + 1] = number(f[k])
				end
			end
			step[9] = { dun = number(f[8]), pct = number(f[9]), quests = ids }
		elseif f[7] and f[7] ~= "" then
			step[8] = number(f[7])
		end
		steps[#steps + 1] = step
	end
	return steps
end

--- A route's steps, read from its data the first time.
function Guide.Steps(r)
	if r and not r.steps then
		r.steps = r.data and decode(r.data) or {}
		r.data = nil
	end
	return r and r.steps or {}
end

function Guide.RouteById(id)
	for _, r in ipairs(Guide.Routes()) do
		if r.id == id then
			Guide.Steps(r)
			return r
		end
	end
	return nil
end

local RACE_SLUG = { [1] = "human", [2] = "orc", [3] = "dwarf", [4] = "night-elf", [5] = "undead", [6] = "tauren", [7] = "gnome", [8] = "troll" }

--- Your class as the routes name it ("druid"), or nil.
function Guide.PlayerClass()
	local _, file = UnitClass("player")
	return plain(file) and type(file) == "string" and file:lower() or nil
end

--- The routes for your class (all of them when the game does not say it), your faction's first.
function Guide.RoutesForMe()
	local cls = Guide.PlayerClass()
	local faction = ns.player.faction or "alliance"
	local out = {}
	for _, r in ipairs(Guide.Routes()) do
		if (not cls or r.class == cls) and r.faction == faction then
			out[#out + 1] = r
		end
	end
	return out
end

-- The Skyborne have routes of their own, named for their race and class ("high-order-skyborne-druid"). Their race has no
-- token the add-on can count on, so they are told by the race's name in the game's language ("... Skyborne"), its token,
-- or the numbers the data gives them, and their side by the faction the game says.
local SKYBORNE = { alliance = "high-order-skyborne", horde = "windshaper-skyborne" }

--- "high-order-skyborne" or "windshaper-skyborne" when you are a Skyborne, else nil.
function Guide.SkyborneRace()
	local ok, name, file, id = pcall(UnitRace, "player")
	if not ok then
		return nil
	end
	local found = false
	if plain(name) and type(name) == "string" and name:lower():find("skyborne", 1, true) then
		found = true
	elseif plain(file) and type(file) == "string" and file:lower():find("skyborne", 1, true) then
		found = true
	elseif plain(id) and type(id) == "number" and ns.races then
		for _, slug in pairs(SKYBORNE) do
			if ns.races[slug] and ns.races[slug].id == id then
				found = true
			end
		end
	end
	if not found and ns.player and (ns.player.race == SKYBORNE.alliance or ns.player.race == SKYBORNE.horde) then
		found = true
	end
	if not found then
		return nil
	end
	-- Their side: the faction the game says; failing that, the name; failing that, what the add-on made of it.
	local faction = UnitFactionGroup and UnitFactionGroup("player")
	local side = faction == "Alliance" and "alliance" or faction == "Horde" and "horde" or nil
	if not side and plain(name) and type(name) == "string" then
		local lower = name:lower()
		side = lower:find("high order", 1, true) and "alliance" or lower:find("windshaper", 1, true) and "horde" or nil
	end
	side = side or (ns.player and ns.player.faction)
	return SKYBORNE[side]
end

--- Your race and class's route; a Skyborne gets theirs (and where there is none for their class, as for any race the
--- routes do not start, their faction's route for the class).
function Guide.DefaultRoute()
	local cls = Guide.PlayerClass()
	local sky = cls and Guide.SkyborneRace()
	if sky then
		local r = Guide.RouteById(sky .. "-" .. cls)
		if r then
			return r
		end
	end
	local _, _, raceID = UnitRace("player")
	local race = plain(raceID) and RACE_SLUG[raceID]
	if race and cls then
		local r = Guide.RouteById(race .. "-" .. cls)
		if r then
			return r
		end
	end
	local faction = ns.player.faction or "alliance"
	local order = faction == "horde" and { "orc", "troll", "tauren", "undead" } or { "human", "night-elf", "dwarf", "gnome" }
	if cls then
		for _, race2 in ipairs(order) do
			local r = Guide.RouteById(race2 .. "-" .. cls)
			if r then
				return r
			end
		end
	end
	for _, r in ipairs(Guide.Routes()) do
		if r.faction == faction then
			return Guide.RouteById(r.id)
		end
	end
	return Guide.Routes()[1] and Guide.RouteById(Guide.Routes()[1].id)
end

--- Whether your race starts where every route of its side begins: not so for the Skyborne, whose Zephras Isle (to 12) only
--- their own routes take in.
function Guide.OwnStart()
	local _, _, raceID = UnitRace("player")
	return plain(raceID) and raceID >= 1 and raceID <= 8
end

--- A line to show instead of a step while the route has nothing for you yet, or nil. A Skyborne with a route of their
--- own does not wait: it opens with a note about Zephras Isle, then the island's own steps.
function Guide.Waiting()
	if not Guide.OwnStart() and (ns.player.level or 1) < 12 then
		local r = Guide.Route()
		if r and r.group == "skyborne" then
			state().waiting = nil
			return nil
		end
		state().waiting = true
		return "Zephras Isle first", "The Skyborne's starting island (levels 1 to 12) is on the Skyborne's own routes, not on this one. At level 12 this route picks you up on its own."
	end
	return nil
end

-- The guide's zone for where you stand (its area id), from the map the game shows you on, or nil.
local uiToArea
local function hereArea()
	local d = data()
	if not d or not (C_Map and C_Map.GetBestMapForUnit) then
		return nil
	end
	if not uiToArea then
		uiToArea = {}
		for area, z in pairs(d.zones) do
			uiToArea[z[2]] = uiToArea[z[2]] or area
		end
	end
	local map = C_Map.GetBestMapForUnit("player")
	local guard = 0
	while plain(map) and map and map > 0 and guard < 6 do
		if uiToArea[map] then
			return uiToArea[map]
		end
		local info = C_Map.GetMapInfo and C_Map.GetMapInfo(map)
		map = info and info.parentMapID
		guard = guard + 1
	end
	return nil
end
Guide.HereArea = hereArea

-- The capitals: you go there to train and sell, not to quest, so standing in one says nothing of where you are in a route.
local CAPITAL = { [1519] = true, [1537] = true, [1657] = true, [1637] = true, [1638] = true, [1497] = true }

--- The level a note goes at on its own: two levels past its own, or the level of the step after it when that is higher
--- (a note that comes before steps for higher levels waits for them). The Skyborne's routes have Zephras Isle's own steps
--- from level 1 after their opening notes.
local function noteLevel(i, step, r)
	local at = (step[7] or 1) + 2
	r = r or Guide.Route()
	local after = r and r.steps and r.steps[i + 1]
	if after and (after[7] or 0) > at then
		at = after[7]
	end
	return at
end
Guide.NoteLevel = noteLevel

--- Whether a route that opens with a note holds a character of this level on it: the steps after it are for higher levels.
local function holdsOnNote(r, steps, level)
	if not (steps[1] and steps[1][1] == NOTE and steps[2]) then
		return false
	end
	return (steps[2][7] or 0) > level
end

--- Where a route starts for you: at level 1 its first step; later the first of its steps in the zone you stand in, when
--- the route passes there from a level below yours to one above, else its first step at your level. (The next check
--- moves on past what you have done.) Also whether it was the zone that placed you.
local function startIndex(r)
	local steps = Guide.Steps(r)
	local level = ns.player.level or 1
	if level <= 1 then
		return 1, false
	end
	-- A route that opens with a note before steps for a higher level keeps a character below that level on the note.
	if holdsOnNote(r, steps, level) then
		return 1, false
	end
	local first
	for i, step in ipairs(steps) do
		if step[7] >= level and not hidden(step) then
			first = i
			break
		end
	end
	local here = hereArea()
	if here and not CAPITAL[here] then
		for i, step in ipairs(steps) do
			if step[7] > level + 1 then
				break
			end
			-- A note or a dungeon is filed under a zone but is not there.
			if step[7] >= level - 1 and step[4] == here and not placeless(step) then
				return i, true
			end
		end
	end
	return first or #steps, false
end

--- Starts a route over at your level, with nothing skipped or held; the next check moves past what you have done.
local function place(st, r)
	st.route, st.sig = r.id, r.sig
	st.step, st.skip, st.done, st.hold, st.holdDone = (startIndex(r)), {}, {}, nil, nil
end

-- Your race and class's route, worked out again only when they change (a test plays several characters).
local ownKey, ownRoute
local function ownRouteFor()
	local _, file = UnitClass("player")
	local raceName, _, raceID = UnitRace("player")
	local key = tostring(raceID) .. ":" .. tostring(raceName) .. ":" .. tostring(file) .. ":" .. tostring(ns.player.faction)
	if key ~= ownKey then
		ownKey, ownRoute = key, Guide.DefaultRoute()
	end
	return ownRoute
end

--- Your route: the one of your race and class, always (a route picked by hand in an older version gives way to it).
function Guide.Route()
	local st = state()
	local r = st.route and Guide.RouteById(st.route)
	local own = not st.pinned and ownRouteFor()
	if own and (not r or r.id ~= own.id) then
		-- A character met for the first time (past level 1, it starts at its level).
		r = own
		place(st, r)
	elseif not r then
		r = Guide.DefaultRoute()
		if r then
			place(st, r)
		end
	elseif st.sig ~= r.sig then
		-- The route changed with an update of the add-on: its steps moved, so the place saved in the old one (and what
		-- was skipped or ticked there) means nothing now.
		place(st, r)
	end
	return r
end

function Guide.Index()
	local r = Guide.Route()
	if not r then
		return nil
	end
	local st = state()
	st.step = math.max(1, math.min(#r.steps, st.step or 1))
	return st.step, r.steps[st.step], r
end

function Guide.Step(i)
	local r = Guide.Route()
	return r and r.steps[i]
end

--- Whether a step is out of the route: skipped, or a dungeon while Dungeons is off (it is passed over silently, and nothing
--- counts it).
function Guide.IsSkipped(i)
	if state().skip[i] then
		return true
	end
	local r = Guide.Route()
	return r ~= nil and hidden(r.steps[i])
end

function Guide.IsMarkedDone(i)
	return state().done[i] and true or false
end

-- Objectives -----------------------------------------------------------------------------------------------------

local function objectiveName(o)
	local d = data()
	if o[1] == TALK or o[1] == ESCORT then
		return d.npcs[o[2]]
	elseif o[1] == USE then
		return d.items[o[2]]
	end
	if o[4] then
		return o[4]
	end
	if o[1] == KILL then
		return d.npcs[o[2]]
	elseif o[1] == OBJECT then
		return d.objects[o[2]]
	elseif o[1] == ITEM then
		return d.items[o[2]]
	end
	return nil
end

--- An objective's words without its count: "Night Web Spider slain: 0/8" and "0/8 Night Web Spider slain" both give
--- "night web spider".
local function bareObjective(text)
	local t = text:gsub("^%s*%d+%s*/%s*%d+%s+", "")
	t = t:gsub("%s*:%s*%d+%s*/%s*%d+%s*$", "")
	t = t:gsub("%s+slain$", "")
	t = t:gsub("^%s+", "")
	t = t:gsub("%s+$", "")
	return t:lower()
end

--- The live objective of the quest log that matches one of the guide's: the one with its very name; else the only one
--- that names it; else the one at its place among those of its kind. (A quest that asks for Young Night Web Spiders
--- and Night Web Spiders has two objectives that name the second.)
local LOG_TYPE = { [KILL] = "monster", [OBJECT] = "object", [ITEM] = "item", [EXPLORE] = "event" }
local function liveObjective(questId, index)
	local q = data().quests[questId]
	local o = q and q[3][index]
	if not o then
		return nil
	end
	local list = questObjectives(questId)
	if #list == 0 then
		return nil
	end
	local name = objectiveName(o)
	if name then
		local want = name:lower()
		local named, names = nil, 0
		for _, l in ipairs(list) do
			if type(l.text) == "string" then
				local words = bareObjective(l.text)
				if words == want then
					return l
				end
				if words:find(want, 1, true) then
					named, names = l, names + 1
				end
			end
		end
		if names == 1 then
			return named
		end
	end
	local nth = 0
	for i = 1, index do
		if q[3][i][1] == o[1] then
			nth = nth + 1
		end
	end
	local seen = 0
	for _, l in ipairs(list) do
		if l.type == LOG_TYPE[o[1]] then
			seen = seen + 1
			if seen == nth then
				return l
			end
		end
	end
	return list[index]
end

--- The objectives a "do" step covers, each { text, done, have, need }, in the quest's order.
function Guide.Objectives(step)
	local out = {}
	local q = data().quests[step[2]]
	if not q then
		return out
	end
	local inLog = onQuest(step[2])
	local finishedQuest = completed(step[2]) or (inLog and readyToTurnIn(step[2]))
	for i, o in ipairs(q[3]) do
		if math.floor(step[3] / 2 ^ (i - 1)) % 2 == 1 then
			local live = inLog and liveObjective(step[2], i)
			local name = objectiveName(o)
			local need = o[3] or 1
			local have = live and plain(live.numFulfilled) and live.numFulfilled or (finishedQuest and need or 0)
			local done = finishedQuest or (live and live.finished == true) or false
			local text
			if o[1] == KILL then
				text = "Kill " .. (name or "the target")
			elseif o[1] == ITEM then
				text = "Collect " .. (name or "the item")
			elseif o[1] == OBJECT then
				text = o[4] or ("Use " .. (name or "the object"))
			elseif o[1] == TALK then
				text = o[4] or ("Talk to " .. (name or "them"))
			elseif o[1] == ESCORT then
				text = o[4] or ("Escort " .. (name or "them"))
			elseif o[1] == USE then
				text = o[4] or ("Use " .. (name or "the quest's item"))
			else
				text = live and live.text or "Find the place the quest sends you to"
			end
			-- What the quest log cannot count (a word with someone, an escort, an item used) is done with the quest.
			if o[1] >= TALK then
				have, done = finishedQuest and 1 or 0, finishedQuest or false
			end
			out[#out + 1] = { text = text, done = done, have = have, need = need, kind = o[1], live = live, index = i }
		end
	end
	return out
end

-- Experience, for a grind step -----------------------------------------------------------------------------------------

--- Classic's experience for a kill, the mob's level against yours (as scripts/data/lib/guide.mjs works the route out).
function Guide.KillXp(player, mob)
	local base = player * 5 + 45
	if mob >= player then
		return math.floor(base * (1 + 0.05 * math.min(4, mob - player)) + 0.5)
	end
	local zd = player <= 7 and 5 or player <= 9 and 6 or player <= 11 and 7 or player <= 15 and 8 or player <= 19 and 9
		or player <= 29 and 11 or player <= 39 and 12 or player <= 44 and 13 or player <= 49 and 14 or player <= 54 and 15
		or player <= 59 and 16 or 17
	local gray = player <= 5 and 0 or player <= 39 and player - math.floor(player / 10) - 5 or player - math.floor(player / 5) - 1
	if mob <= gray then
		return 0
	end
	return math.max(0, math.floor(base * (1 - (player - mob) / zd) + 0.5))
end

local function thousands(n)
	local s = tostring(math.floor(n + 0.5))
	while true do
		local t, k = s:gsub("^(%d+)(%d%d%d)", "%1,%2")
		s = t
		if k == 0 then
			return s
		end
	end
end
Guide.Thousands = thousands

--- Your rested experience: the pool that doubles what kills give you while it lasts. 0 when you have none, or when the
--- game does not say (no such call, or an answer that is no number).
function Guide.RestedPool()
	if not GetXPExhaustion then
		return 0
	end
	local ok, pool = pcall(GetXPExhaustion)
	if ok and plain(pool) and type(pool) == "number" and pool > 0 then
		return pool
	end
	return 0
end

--- How many kills earn `left` experience at `per` a kill, when `rested` of rested experience doubles the kills' for as
--- long as it lasts: n kills give n * per, and as much again up to the pool, so n has to reach both half of what is
--- left and what the pool leaves over.
function Guide.KillsFor(left, per, rested)
	if type(left) ~= "number" or type(per) ~= "number" or per <= 0 then
		return 1
	end
	rested = (type(rested) == "number" and rested > 0) and rested or 0
	return math.max(1, math.ceil(left / (2 * per)), math.ceil((left - rested) / per))
end

--- What a grind step has left, as a line and its number: "About 9 kills", "12,340 XP" (rested experience
--- doubles a kill's while it lasts), or "2 levels to go"; nil once you are there.
function Guide.GrindText(step)
	local level = ns.player.level or 1
	if level >= step[2] then
		return nil
	end
	if step[2] - level > 1 then
		return (step[2] - level) .. " levels to go", ""
	end
	local xp, max = UnitXP and UnitXP("player"), UnitXPMax and UnitXPMax("player")
	if not plain(xp) or not plain(max) or max <= 0 then
		return "Experience to level " .. step[2], ""
	end
	local left = math.max(0, max - xp)
	local per = Guide.KillXp(level, step[8] or level)
	if per <= 0 then
		return "Experience to level " .. step[2], thousands(left) .. " XP"
	end
	local rested = Guide.RestedPool()
	local kills = Guide.KillsFor(left, per, rested)
	return string.format("About %d %s%s", kills, kills == 1 and "kill" or "kills", rested > 0 and ", rested" or ""), thousands(left) .. " XP"
end

--- The experience a quest gives you now: in full up to five levels over it, then 80, 60, 40, 20 and 10%; nil at the
--- level cap, or for a quest the data gives no experience.
function Guide.QuestXp(id)
	local q = data() and (data().quests[id] or data().starts and data().starts[id])
	if not q then
		return nil
	end
	local xp, ql = q[8], q[2]
	if data().starts and data().starts[id] == q then
		xp = q[12]
	end
	local level = ns.player.level or 1
	if not xp or xp <= 0 or level >= (GetMaxPlayerLevel and GetMaxPlayerLevel() or 60) then
		return nil
	end
	local over = level - (ql or level)
	if over > 5 then
		xp = math.floor(xp * (({ 0.8, 0.6, 0.4, 0.2 })[over - 5] or 0.1) + 0.5)
	end
	return xp
end

--- "1,450 XP" for a quest, or nil.
function Guide.QuestXpText(id)
	local xp = Guide.QuestXp(id)
	return xp and (thousands(xp) .. " XP") or nil
end

--- Spells your trainer has for you now (Player.lua), for a training step.
function Guide.ToTrain()
	return ns.ToTrain and ns.ToTrain(ns.player.level) or {}
end

-- Where the arrow points ------------------------------------------------------------------------------------------

--- Where to go for a step: area, x, y and what stands there. A "do" step points at the nearest camp of what is left to
--- kill, loot or use, from where you stand; a training step at your class's trainer nearest the step's place.
function Guide.Target(step)
	if placeless(step) then
		-- A note and a dungeon have no place: nothing to point at.
		return nil
	end
	local d = data()
	local area, x, y = step[4], step[5], step[6]
	if step[1] == DO then
		local pmap, pn, pw = Guide.PlayerWorld()
		local q = d.quests[step[2]]
		local best, bestD, bestName
		for _, o in ipairs(Guide.Objectives(step)) do
			if not o.done and q then
				local spec = q[3][o.index]
				local sources = (spec[1] == KILL or spec[1] == TALK or spec[1] == ESCORT) and { spec[2] } or spec[1] == OBJECT and { -spec[2] } or (spec[1] == ITEM or spec[1] == USE) and spec[5] or {}
				for _, e in ipairs(sources) do
					local camps = d.camps[e]
					if camps then
						for i = 1, #camps, 3 do
							if camps[i] == area then
								local m, n, w = Guide.World(camps[i], camps[i + 1], camps[i + 2])
								if m and pmap and m == pmap then
									local dd = (n - pn) ^ 2 + (w - pw) ^ 2
									if not bestD or dd < bestD then
										best, bestD, bestName = { camps[i], camps[i + 1], camps[i + 2] }, dd, Guide.EntityName(e)
									end
								end
							end
						end
					end
				end
			end
		end
		if best then
			return best[1], best[2], best[3], bestName
		end
		return area, x, y, step[8] and Guide.EntityName(step[8]) or nil
	elseif step[1] == TRAIN and step[2] ~= 0 and d.npcs[step[2]] then
		-- The trainer the route has you see.
		return area, x, y, d.npcs[step[2]]
	elseif step[1] == TRAIN then
		-- Your class's trainer nearest the place the route trains at, of your faction or neutral.
		local cls = ns.player.class
		local list = cls and d.trainers[cls]
		if list then
			local side = ns.player.faction == "horde" and 2 or 1
			local map, sn, sw = Guide.World(area, x, y)
			local best, bestD
			for i = 1, #list, 5 do
				local react = list[i + 4]
				if react and react:sub(side, side) ~= "h" then
					local m, n, w = Guide.World(list[i + 1], list[i + 2], list[i + 3])
					if m and m == map then
						local dd = (n - sn) ^ 2 + (w - sw) ^ 2
						if not bestD or dd < bestD then
							best, bestD = i, dd
						end
					end
				end
			end
			if best then
				return list[best + 1], list[best + 2], list[best + 3], d.npcs[list[best]]
			end
		end
	elseif step[1] == BOAT then
		-- The step stands at the dock you leave from.
		return area, x, y
	elseif step[1] == ACCEPT or step[1] == TURNIN then
		return area, x, y, Guide.EntityName(step[3])
	elseif step[1] == FLY or step[1] == FLIGHTPATH then
		local t = d.taxi[step[2]]
		return area, x, y, t and d.npcs[t[2]]
	elseif step[1] == GRIND then
		return area, x, y, step[3] ~= 0 and d.npcs[step[3]] or nil
	elseif step[1] == BIND then
		return area, x, y, d.npcs[step[2]]
	elseif step[1] == ZONE and type(step[8]) == "table" and #step[8] > 0 then
		-- Through other zones on the way: the next zone line, as one zone step each used to show it.
		local here = Guide.HereArea and Guide.HereArea()
		for k, v in ipairs(step[8]) do
			if here == v[1] then
				local nxt = step[8][k + 1]
				if nxt then
					return nxt[1], nxt[2], nxt[3]
				end
				return area, x, y
			end
		end
		if here == area then
			return area, x, y
		end
		local first = step[8][1]
		return first[1], first[2], first[3]
	end
	return area, x, y
end

--- The far end of a boat step: area, x, y and its name.
function Guide.BoatEnd(step)
	local t = data().transports[step[2]]
	if not t then
		return nil
	end
	-- { kind, side, area, x, y, name, area, x, y, name }: the end farther from where the step stands.
	local function far(a, x, y)
		return a ~= step[4] or math.abs(x - step[5]) + math.abs(y - step[6]) > 1
	end
	if far(t[3], t[4], t[5]) and not far(t[7], t[8], t[9]) then
		return t[3], t[4], t[5], t[6], t[1]
	end
	return t[7], t[8], t[9], t[10], t[1]
end

-- Notes and dungeons ------------------------------------------------------------------------------------------------
-- Steps with no place. A note is a few paragraphs the route stops at (ns.guide.info); a dungeon is an optional step that
-- names a dungeon (ns.guide.dun) and the quests to take before going in, to run once with a group or to skip.

local NOTE_SHORT = 170 -- letters of a note's first paragraph the guide window shows; the rest is in the tooltip

--- A paragraph cut short at the end of a sentence (when that keeps a fair part of it) or at a word, to about max letters.
function Guide.Clip(text, max)
	if type(text) ~= "string" then
		return nil
	end
	if #text <= max then
		return text
	end
	local head = text:sub(1, max)
	local stop = 0
	for at in head:gmatch("()%. ") do
		stop = at
	end
	if stop >= 40 then
		return head:sub(1, stop)
	end
	local word = 0
	for at in head:gmatch("() ") do
		word = at
	end
	if word > 1 then
		return head:sub(1, word - 1) .. "..."
	end
	return head .. "..."
end

--- A note step's title and its paragraphs (plain text), or nil when the data has no such note.
function Guide.Note(step)
	local d = data()
	local n = d and d.info and d.info[step[2]]
	if type(n) ~= "table" then
		return nil
	end
	return n[1], type(n[2]) == "table" and n[2] or {}
end

--- A dungeon step as { name, lo, hi, side, new, zone, quests = { quest ids }, known }. The name, the levels and the zone it
--- stands in are the dungeon's own (ns.guide.dun); a step whose dungeon the data does not know still has a name.
function Guide.Dungeon(step)
	local d = data()
	local dun = d and d.dun and d.dun[step[2]]
	local out = { name = "a dungeon", quests = type(step[8]) == "table" and step[8] or {}, new = false, known = false }
	if type(dun) == "table" then
		out.known = true
		out.name = dun[2] or out.name
		out.lo, out.hi, out.side, out.new, out.zone = dun[3], dun[4], dun[5], dun[6] == 1, dun[7]
	end
	return out
end

--- "Levels 23 to 32" ("Level 58" for a dungeon of one level) for a dungeon from Guide.Dungeon; nil when it has no levels.
local function levelsText(dungeon)
	if not (dungeon.lo and dungeon.lo > 0) then
		return nil
	end
	if dungeon.hi and dungeon.hi > dungeon.lo then
		return "Levels " .. dungeon.lo .. " to " .. dungeon.hi
	end
	return "Level " .. dungeon.lo
end

--- What a dungeon step says, in plain sentences: { levels, quests, advice }; levels and quests may be nil.
---   levels: "Levels 23 to 32, in Stormwind City."
---   quests: "Take its quests first: A, B, C." For one of Forever's own with no quests we know of: "New in Forever. Take its
---           quests before you go in." For any other dungeon with none, nothing.
---   advice: "Run it once with a group, or skip it."
function Guide.DungeonLines(dungeon)
	local levels = levelsText(dungeon)
	if levels then
		levels = levels .. (dungeon.zone and (", in " .. dungeon.zone) or "") .. "."
	elseif dungeon.zone then
		levels = "In " .. dungeon.zone .. "."
	end
	local quests
	if #dungeon.quests > 0 then
		local names = {}
		for _, id in ipairs(dungeon.quests) do
			names[#names + 1] = Guide.QuestName(id)
		end
		quests = "Take its quests first: " .. table.concat(names, ", ") .. "."
	elseif dungeon.new then
		quests = "New in Forever. Take its quests before you go in."
	end
	return { levels = levels, quests = quests, advice = "Run it once with a group, or skip it." }
end

--- A dungeon's lines as one text, a line each.
function Guide.DungeonText(dungeon)
	local lines = Guide.DungeonLines(dungeon)
	local out = {}
	if lines.levels then
		out[#out + 1] = lines.levels
	end
	if lines.quests then
		out[#out + 1] = lines.quests
	end
	out[#out + 1] = lines.advice
	return table.concat(out, "\n")
end


-- What a step says ------------------------------------------------------------------------------------------------

local KIND_LABEL = { [ACCEPT] = "Accept", [TURNIN] = "Turn in", [DO] = "Quest", [ZONE] = "Travel", [FLY] = "Fly", [BOAT] = "Sail", [FLIGHTPATH] = "Flight path", [TRAIN] = "Train", [GRIND] = "Level up", [HEARTH] = "Hearth", [BIND] = "Inn", [TELEPORT] = "Teleport", [NOTE] = "Note", [DUNGEON] = "Dungeon" }
Guide.KIND_LABEL = KIND_LABEL
-- A boat step's word by what carries you: the boat sails, the zeppelin, the tram and Darnassus's portal do not.
local CARRIER_LABEL = { zeppelin = "Zeppelin", tram = "Tram", portal = "Portal" }
local CARRIER = { zeppelin = "the zeppelin", tram = "the Deeprun Tram", portal = "the portal" }

--- The word for a step's kind, as the guide window and the list show it.
function Guide.KindLabel(step)
	if step[1] == BOAT then
		local t = data().transports[step[2]]
		return t and CARRIER_LABEL[t[1]] or KIND_LABEL[BOAT]
	end
	return KIND_LABEL[step[1]]
end

--- A step in words: the main line and the line under it (plain text; the frame and the list colour them).
function Guide.Describe(step)
	local k = step[1]
	if k == ACCEPT or k == TURNIN then
		local name = Guide.QuestName(step[2])
		local who = Guide.EntityName(step[3])
		-- A wanted poster carries the quest's own name: saying it twice tells nothing.
		if who == name then
			who = nil
		end
		local how = step[3] < 0 and "at " or k == ACCEPT and "from " or "to "
		return (k == ACCEPT and "Accept " or "Turn in ") .. name, who and (how .. who) or nil
	elseif k == DO then
		local parts = {}
		for _, o in ipairs(Guide.Objectives(step)) do
			parts[#parts + 1] = o.text
		end
		return Guide.QuestName(step[2]), table.concat(parts, ", ")
	elseif k == ZONE then
		local text = "Go to " .. Guide.ZoneName(step[2])
		if type(step[8]) == "table" and #step[8] > 0 then
			-- "Go to the Badlands, through Hillsbrad Foothills, Arathi Highlands, the Wetlands and Loch Modan"
			for k, v in ipairs(step[8]) do
				text = text .. (k == 1 and ", through " or k == #step[8] and " and " or ", ") .. Guide.ZoneName(v[1])
			end
		end
		return text, nil
	elseif k == FLY then
		local t = data().taxi[step[2]]
		return "Fly to " .. Guide.TaxiShort(step[3]), t and ("Talk to " .. (data().npcs[t[2]] or "the flight master") .. ", " .. Guide.TaxiShort(step[2])) or nil
	elseif k == BOAT then
		local _, _, _, name, kind = Guide.BoatEnd(step)
		return "Take " .. (CARRIER[kind] or "the boat") .. " to " .. (name or "the other side"), nil
	elseif k == FLIGHTPATH then
		local t = data().taxi[step[2]]
		return "Get the flight path at " .. Guide.TaxiShort(step[2]), t and ("Talk to " .. (data().npcs[t[2]] or "the flight master")) or nil
	elseif k == TRAIN then
		local _, _, _, who = Guide.Target(step)
		local spells = Guide.ToTrain()
		local names = {}
		for i, a in ipairs(spells) do
			if i > 4 then
				names[#names + 1] = (#spells - 4) .. " more"
				break
			end
			names[#names + 1] = ns.SpellLabel and ns.SpellLabel(a) or a.name
		end
		local sub = #names > 0 and table.concat(names, ", ") or "Nothing new to learn: skip ahead"
		return "Train your spells" .. (who and (" with " .. who) or ""), sub
	elseif k == GRIND then
		local mob = step[3] ~= 0 and data().npcs[step[3]]
		local at = step[8] and (" (level " .. step[8] .. ")") or ""
		local sub = mob and ("Kill " .. mob .. at .. " and what stands near") or "Kill what stands near"
		local offer = type(step[9]) == "table" and step[9]
		local dun = offer and data().dun and data().dun[offer.dun]
		if dun then
			-- A dungeon instead, with a group: its quests' experience alone (kills inside come on top).
			local names = {}
			for _, id in ipairs(offer.quests) do
				names[#names + 1] = Guide.QuestName(id)
			end
			sub = sub .. "\nOr run " .. dun[2] .. " with a group: its " .. #offer.quests .. " quests give about " .. offer.pct .. "% of this level (their experience alone; kills inside come on top). Take its quests first: " .. table.concat(names, ", ") .. "."
		end
		return "Level up to " .. step[2], sub
	elseif k == HEARTH then
		return "Use your Hearthstone", "It takes you back to " .. Guide.ZoneName(step[4])
	elseif k == TELEPORT then
		local t = data().teleports and data().teleports[step[2]]
		return "Cast " .. (t and t[1] or "your teleport"), "It takes you to " .. Guide.ZoneName(step[4])
	elseif k == BIND then
		local who = data().npcs[step[2]]
		return "Make this inn your home", (who and ("Talk to " .. who .. ", ") or "") .. "so your Hearthstone brings you back here"
	elseif k == NOTE then
		local title, paragraphs = Guide.Note(step)
		return title or "Note", paragraphs and Guide.Clip(paragraphs[1], NOTE_SHORT) or nil
	elseif k == DUNGEON then
		local dungeon = Guide.Dungeon(step)
		return "Dungeon (optional): " .. dungeon.name, Guide.DungeonText(dungeon)
	end
	return "", nil
end

--- The main line alone, for narrow places.
function Guide.Short(step)
	local main = Guide.Describe(step)
	return main
end

--- A one-line summary for lists and the "then" line.
function Guide.Summary(step)
	local main, sub = Guide.Describe(step)
	if step[1] == DO then
		return main .. (sub and sub ~= "" and (": " .. sub) or "")
	end
	if step[1] == DUNGEON then
		-- "Dungeon (optional): The Stockade (levels 23 to 32)"
		local levels = levelsText(Guide.Dungeon(step))
		return main .. (levels and (" (" .. levels:lower() .. ")") or "")
	end
	if (step[1] == ACCEPT or step[1] == TURNIN) and sub then
		return main .. " " .. sub
	end
	return main
end

-- Is a step done? -------------------------------------------------------------------------------------------------

local logReady = false -- the quest log has been read since login: until then, a quest missing from it proves nothing

local function inZone(area)
	local z = data().zones[area]
	if not z then
		return false
	end
	if C_Map and C_Map.GetBestMapForUnit then
		local map = C_Map.GetBestMapForUnit("player")
		local guard = 0
		while plain(map) and map and map > 0 and guard < 6 do
			if map == z[2] then
				return true
			end
			local info = C_Map.GetMapInfo and C_Map.GetMapInfo(map)
			map = info and info.parentMapID
			guard = guard + 1
		end
	end
	local zone = GetRealZoneText and GetRealZoneText()
	return plain(zone) and zone == z[1] or false
end
--- Whether you are in a zone of the guide's (or in a place inside it).
Guide.InZone = inZone

local function objectivesDone(step)
	local list = Guide.Objectives(step)
	if #list == 0 then
		return false
	end
	for _, o in ipairs(list) do
		if not o.done then
			return false
		end
	end
	return true
end

--- Whether a note is done: you are past its level, or you went on without it (the step after it is done), so it never
--- holds the route up. A dungeon is done only when you say so.
local function noteDone(i, step)
	if (ns.player.level or 1) >= noteLevel(i, step) then
		return true
	end
	local r = Guide.Route()
	local steps = r and r.steps
	if not steps then
		return false
	end
	for j = i + 1, math.min(#steps, i + 6) do
		if not hidden(steps[j]) then
			return Guide.IsDone(j, steps[j])
		end
	end
	return false
end

--- Whether a step is done (or skipped): from the quest log, your level and zone, and what the guide saw happen.
function Guide.IsDone(i, step)
	local st = state()
	if st.done[i] or st.skip[i] then
		return true
	end
	local k, q = step[1], step[2]
	if k == ACCEPT then
		return onQuest(q) or completed(q)
	elseif k == TURNIN then
		return completed(q)
	elseif k == DO then
		return completed(q) or (onQuest(q) and (readyToTurnIn(q) or objectivesDone(step)))
	elseif k == GRIND then
		return (ns.player.level or 1) >= q
	elseif k == ZONE then
		return inZone(q)
	elseif k == NOTE then
		return noteDone(i, step)
	end
	return false
end

--- A step that cannot be done any more: a quest to finish or hand in that is not in your log (you skipped it, or
--- dropped it), or training with nothing to learn.
--- Whether a quest's earlier parts are missing: one it needs done is not (you started the route past it, or skipped
--- it), so its giver will not offer it.
local function missedChain(q)
	local info = data().quests[q]
	if not info then
		return false
	end
	if info[5] then
		for _, p in ipairs(info[5]) do
			if not completed(p) then
				return true
			end
		end
	end
	if info[6] then
		for _, p in ipairs(info[6]) do
			if completed(p) then
				return false
			end
		end
		return true
	end
	return false
end
Guide.MissedChain = missedChain

local function moot(step)
	local k = step[1]
	if (k == TURNIN or k == DO) and logReady and not onQuest(step[2]) and not completed(step[2]) then
		return true
	end
	if k == ACCEPT and logReady and not onQuest(step[2]) and not completed(step[2]) and missedChain(step[2]) then
		return true
	end
	if k == TRAIN and ns.ToTrain and #Guide.ToTrain() == 0 then
		return true
	end
	if k == DUNGEON then
		-- A dungeon for levels you have left behind (above its highest, and one more).
		local dungeon = Guide.Dungeon(step)
		if dungeon.known and dungeon.hi and (ns.player.level or 1) > dungeon.hi + 1 then
			return true
		end
	end
	return false
end

-- Moving through the route ----------------------------------------------------------------------------------------

local function changed()
	ns.Send("GUIDE")
end

--- Moves past every step that is done, from the current one. A step you went back to stays until you move on.
function Guide.Advance()
	local i, step, r = Guide.Index()
	if not i or Guide.Waiting() then
		return
	end
	local st = state()
	if st.hold and hidden(step) then
		-- Dungeons were turned off while you looked at one.
		st.hold, st.holdDone = nil, nil
	end
	if st.hold then
		-- A step you went back to, or picked in the list, stays until you move on, or until you do it.
		local now = Guide.IsDone(i, step)
		if not now or st.holdDone then
			st.holdDone = now
			return
		end
		st.hold, st.holdDone = nil, nil
	end
	local start = i
	while i <= #r.steps do
		step = r.steps[i]
		if hidden(step) or Guide.IsDone(i, step) then
			i = i + 1
		elseif moot(step) then
			st.skip[i] = true
			i = i + 1
		else
			break
		end
	end
	if i > #r.steps then
		i = #r.steps
		-- The route ends on a step the settings leave out: stay on the last one that counts.
		while i > 1 and hidden(r.steps[i]) do
			i = i - 1
		end
	end
	if i ~= start then
		st.step = i
		changed()
	end
end

--- Marks the current step done (it is one the game cannot report, like a flight) and moves on.
function Guide.Complete(i)
	local st = state()
	st.done[i or st.step or 1] = true
	st.hold, st.holdDone = nil, nil
	Guide.Advance()
	changed()
end

--- Skips the current step and moves on.
function Guide.Next()
	local i, _, r = Guide.Index()
	if not i then
		return
	end
	local st = state()
	if not Guide.IsDone(i, r.steps[i]) then
		st.skip[i] = true
	end
	st.hold, st.holdDone = nil, nil
	st.step = math.min(#r.steps, i + 1)
	Guide.Advance()
	changed()
end

--- Skips a step (the card's Skip button): the current one moves the route on.
function Guide.Skip(i)
	local r = Guide.Route()
	if not r or not i or not r.steps[i] then
		return
	end
	local st = state()
	st.skip[i] = true
	if i == st.step then
		st.hold, st.holdDone = nil, nil
		Guide.Advance()
	end
	changed()
end

--- Turns the optional dungeons on or off (Options, the guide window's menu): the route's steps change under you, so it moves on
--- past what is now out of it. Anything but false is on.
function Guide.SetDungeons(on)
	if not ns.db then
		return
	end
	ns.db.guideDungeons = on ~= false
	if ns.char and data() then
		Guide.Advance()
	end
	changed()
	if ns.RefreshRouteMap then
		ns.RefreshRouteMap()
	end
end

--- Holds the current step on screen: until you move on, or until it goes from to do to done.
local function hold(st, r)
	st.skip[st.step] = nil
	st.done[st.step] = nil
	st.hold = true
	st.holdDone = Guide.IsDone(st.step, r.steps[st.step])
end

--- Back one step, kept on screen until you move on.
function Guide.Back()
	local i, _, r = Guide.Index()
	if not i then
		return
	end
	local st = state()
	local j = math.max(1, i - 1)
	-- Past the steps the settings leave out (dungeons while they are off).
	while j > 1 and hidden(r.steps[j]) do
		j = j - 1
	end
	st.step = j
	hold(st, r)
	changed()
end

--- Jumps to a step (from the list).
function Guide.Set(i)
	local r = Guide.Route()
	if not r then
		return
	end
	local st = state()
	st.step = math.max(1, math.min(#r.steps, i))
	hold(st, r)
	changed()
end

--- Skips a step in the list, or takes it back.
function Guide.ToggleSkip(i)
	local st = state()
	st.skip[i] = not st.skip[i] or nil
	changed()
end

--- The first step at your level, then on past what you have done.
function Guide.StartAtLevel()
	local r = Guide.Route()
	if not r then
		return
	end
	place(state(), r)
	Guide.Advance()
	changed()
end

--- Follows another route than your own (for tests; the guide otherwise follows your race and class's own).
function Guide.SetRoute(id)
	local r = Guide.RouteById(id)
	if not r then
		return
	end
	local st = state()
	place(st, r)
	st.pinned = Guide.DefaultRoute() and Guide.DefaultRoute().id ~= id or nil
	Guide.Advance()
	changed()
end

--- Keeps the guide with you: when you are two levels or more past the step it is on (you leveled elsewhere), or when
--- you log in standing in a zone the route has for your level, it moves on to where the route is for you then, never
--- back, with what it passes over skipped. A step you went back to stays.
local function adapt(byZone)
	local i, step, r = Guide.Index()
	if not i or Guide.Waiting() then
		return
	end
	local st = state()
	if st.hold then
		return
	end
	local level = ns.player.level or 1
	local target, here = startIndex(r)
	-- The level you are past the step at: two above its own; a note goes when it would (see noteLevel).
	local past = step[1] == NOTE and noteLevel(i, step) or (step[7] or 1) + 2
	if target <= i or not (past <= level or (byZone and here)) then
		return
	end
	for k = i, target - 1 do
		if not Guide.IsDone(k, r.steps[k]) then
			st.skip[k] = true
		end
	end
	st.step = target
	Guide.Advance()
	changed()
end
Guide.Adapt = adapt

-- Steps that are one visit: what you do with one person (or people standing together) or at one camp, shown together.
local function sameVisit(a, b)
	if a[4] ~= b[4] then
		return false
	end
	local qa, qb = a[1] == ACCEPT or a[1] == TURNIN, b[1] == ACCEPT or b[1] == TURNIN
	if qa and qb then
		return a[3] == b[3] or math.abs(a[5] - b[5]) + math.abs(a[6] - b[6]) <= 0.6
	end
	if a[1] == DO and b[1] == DO then
		return a[5] == b[5] and a[6] == b[6]
	end
	return false
end

--- The visit a step belongs to: its first and last step (six at most).
function Guide.Group(i)
	local r = Guide.Route()
	if not r or not i then
		return i, i
	end
	local steps = Guide.Steps(r)
	if not r.groups then
		r.groups = {}
		local start = 1
		for k = 1, #steps do
			if k > 1 and k - start < 6 and sameVisit(steps[k - 1], steps[k]) then
				r.groups[k] = start
			else
				start = k
				r.groups[k] = k
			end
		end
	end
	local first = r.groups[i] or i
	local last = i
	while last < #steps and r.groups[last + 1] == first do
		last = last + 1
	end
	return first, last
end

--- How far along: steps before the current one, steps in all. The steps the settings leave out (dungeons while they
--- are off) are in neither.
function Guide.Progress()
	local i, _, r = Guide.Index()
	if not i then
		return 0, 0
	end
	local before, total = 0, 0
	for j, step in ipairs(r.steps) do
		if not hidden(step) then
			total = total + 1
			if j < i then
				before = before + 1
			end
		end
	end
	return before, total
end

--- The current step's number and the steps in all, as a player counts them: "step 12 of 1800".
function Guide.Position()
	local before, total = Guide.Progress()
	return math.min(before + 1, math.max(total, 1)), total
end

--- The steps after the current one that are still to do, up to n.
function Guide.Upcoming(n)
	local i, _, r = Guide.Index()
	local out = {}
	if not i then
		return out
	end
	local st = state()
	for j = i + 1, #r.steps do
		if not st.skip[j] and not hidden(r.steps[j]) then
			out[#out + 1] = r.steps[j]
			if #out >= n then
				break
			end
		end
	end
	return out
end

-- The map pin -----------------------------------------------------------------------------------------------------

local pinned
--- Puts the game's own map pin (and its marker in the world, where the client draws one) on the current target.
function Guide.Pin(area, x, y)
	if not (ns.db.guidePin and C_Map and C_Map.SetUserWaypoint and UiMapPoint and UiMapPoint.CreateFromCoordinates) then
		return
	end
	local z = data().zones[area]
	if not z then
		return
	end
	local key = area .. ":" .. x .. ":" .. y
	if key == pinned then
		return
	end
	if C_Map.CanSetUserWaypointOnMap and not C_Map.CanSetUserWaypointOnMap(z[2]) then
		Guide.Unpin()
		return
	end
	local ok = pcall(C_Map.SetUserWaypoint, UiMapPoint.CreateFromCoordinates(z[2], x / 100, y / 100))
	if ok then
		pinned = key
		if C_SuperTrack and C_SuperTrack.SetSuperTrackedUserWaypoint then
			pcall(C_SuperTrack.SetSuperTrackedUserWaypoint, true)
		end
	else
		Guide.Unpin()
	end
end

function Guide.Unpin()
	if pinned and C_Map and C_Map.ClearUserWaypoint then
		pcall(C_Map.ClearUserWaypoint)
	end
	pinned = nil
end

-- Somewhere else to go --------------------------------------------------------------------------------------------
-- A place picked elsewhere (a dungeon quest's giver, a rare's spot) takes the guide window's arrow and the map pin
-- until you get there or go back to the route; the route keeps your place meanwhile.

local going
--- Points the guide at a place: { area, x, y, title, sub, label }; nil goes back to the route.
function Guide.GoTo(place)
	going = place
	pinned = nil
	if place then
		local z = data() and data().zones[place.area]
		if z and C_Map and C_Map.SetUserWaypoint and UiMapPoint and UiMapPoint.CreateFromCoordinates then
			if pcall(C_Map.SetUserWaypoint, UiMapPoint.CreateFromCoordinates(z[2], place.x / 100, place.y / 100)) then
				pinned = "goto"
				if C_SuperTrack and C_SuperTrack.SetSuperTrackedUserWaypoint then
					pcall(C_SuperTrack.SetSuperTrackedUserWaypoint, true)
				end
			end
		end
	end
	changed()
	-- The window shows for it even where it stays away otherwise (hidden, or at level 60), and goes again after.
	if ns.UpdateGuideFrame then
		ns.UpdateGuideFrame()
	end
end

--- The place the guide points at instead of the route's step, or nil.
function Guide.Going()
	return going
end

-- Distance and time in words ------------------------------------------------------------------------------------

function Guide.DistanceText(yards)
	if not yards then
		return ""
	end
	if ns.db.guideMeters then
		local m = yards * 0.9144
		if m >= 1000 then
			return string.format("%.1f km", m / 1000)
		end
		return string.format("%d m", math.floor(m + 0.5))
	end
	if yards >= 1000 then
		return string.format("%d,%03d yd", math.floor(yards / 1000), math.floor(yards % 1000))
	end
	return string.format("%d yd", math.floor(yards + 0.5))
end

--- How long the walk takes at the speed you move (or run, standing still).
function Guide.TimeText(yards)
	if not yards then
		return ""
	end
	local speed = 7
	if GetUnitSpeed then
		local now, run = GetUnitSpeed("player")
		if plain(now) and now > 0.5 then
			speed = now
		elseif plain(run) and run > 0.5 then
			speed = run
		end
	end
	local s = yards / speed
	if s < 60 then
		return string.format("%d s", math.max(1, math.floor(s + 0.5)))
	elseif s < 3600 then
		local m = math.floor(s / 60)
		local rest = math.floor(s - m * 60)
		return rest > 0 and m < 10 and string.format("%d min %d s", m, rest) or string.format("%d min", math.floor(s / 60 + 0.5))
	end
	return string.format("%d h %d min", math.floor(s / 3600), math.floor((s % 3600) / 60))
end

-- Watching the game -----------------------------------------------------------------------------------------------

local dirty = true
local function touch()
	dirty = true
end

--- Checks the current step: called by the guide window's timer (and once a second without it). Steps the game does not
--- report (a flight, a boat, a flight path) are done by distance or by what happens.
function Guide.Tick()
	local i, step = Guide.Index()
	if not i then
		return
	end
	local k = step[1]
	if k == FLY then
		if UnitOnTaxi and UnitOnTaxi("player") then
			state().done[i] = true
			dirty = true
		else
			local t = data().taxi[step[3]]
			local yards = t and distanceTo(t[4], t[5], t[6])
			if yards and yards < 250 then
				state().done[i] = true
				dirty = true
			end
		end
	elseif k == BOAT then
		local a, x, y = Guide.BoatEnd(step)
		local yards = a and distanceTo(a, x, y)
		if yards and yards < 300 then
			state().done[i] = true
			dirty = true
		end
	elseif k == ZONE or k == HEARTH or k == TELEPORT then
		local yards = distanceTo(step[4], step[5], step[6])
		if yards and yards < (k == ZONE and 60 or 150) then
			state().done[i] = true
			dirty = true
		end
	end
	if dirty then
		dirty = false
		ns.UpdatePlayer()
		Guide.Advance()
		changed()
	end
end

local function hereFor(kind, radius)
	local i, step = Guide.Index()
	if not i or step[1] ~= kind then
		return nil
	end
	local a, x, y = Guide.Target(step)
	local yards = distanceTo(a, x, y)
	if yards and yards > radius then
		return nil
	end
	return i
end

ns.On("QUEST_ACCEPTED", touch)
ns.On("QUEST_TURNED_IN", function()
	state().hold = nil
	touch()
end)
ns.On("QUEST_REMOVED", touch)
ns.On("QUEST_LOG_UPDATE", function()
	logReady = true
	touch()
end)
ns.On("UNIT_QUEST_LOG_CHANGED", function(unit)
	if unit == "player" then
		touch()
	end
end)
ns.On("PLAYER_LEVEL_UP", function(level)
	if plain(level) then
		ns.player.level = level
	end
	-- A Skyborne leaving Zephras Isle: the route starts at their level.
	if plain(level) and level >= 12 and state().waiting then
		state().waiting = nil
		Guide.StartAtLevel()
	else
		adapt(false)
	end
	touch()
end)
ns.On("ZONE_CHANGED_NEW_AREA", touch)
ns.On("ZONE_CHANGED", touch)
ns.On("PLAYER_CONTROL_LOST", touch)
ns.On("TAXIMAP_OPENED", function()
	local i = hereFor(FLIGHTPATH, 40)
	if i then
		state().done[i] = true
		touch()
	end
end)
ns.On("UI_INFO_MESSAGE", function(_, message)
	-- "New flight path discovered!", next to the step's flight master (not one learned somewhere else).
	if plain(message) and ERR_NEWTAXIPATH and message == ERR_NEWTAXIPATH then
		local i = hereFor(FLIGHTPATH, 60)
		if i then
			state().done[i] = true
			touch()
		end
	end
end)
ns.On("HEARTHSTONE_BOUND", function()
	local i, step = Guide.Index()
	if i and step[1] == BIND then
		state().done[i] = true
		touch()
	end
end)
-- The Hearthstone: your own casts only, on a frame of their own, so no one else's spells reach the add-on.
local casts = CreateFrame("Frame")
casts:RegisterUnitEvent("UNIT_SPELLCAST_SUCCEEDED", "player")
casts:SetScript("OnEvent", function(_, _, unit, _, spellID)
	if unit ~= "player" or not plain(spellID) or not ns.char then
		return
	end
	local i, step = Guide.Index()
	if i and ((step[1] == HEARTH and spellID == HEARTHSTONE) or (step[1] == TELEPORT and spellID == step[2])) then
		state().done[i] = true
		touch()
	end
end)

--- Whether the trainer you talk to teaches your class: not a profession's, and, when the game names the creature, one
--- of your class's trainers.
local function classTrainer()
	local trade = IsTradeskillTrainer and IsTradeskillTrainer()
	if plain(trade) and trade then
		return false
	end
	local guid = UnitGUID and UnitGUID("npc")
	local id = plain(guid) and type(guid) == "string" and tonumber(guid:match("^Creature%-%d+%-%d+%-%d+%-%d+%-(%d+)%-"))
	local list = id and ns.player.class and data().trainers[ns.player.class]
	if list then
		for k = 1, #list, 5 do
			if list[k] == id then
				return true
			end
		end
		return false
	end
	return true
end

ns.On("TRAINER_SHOW", function()
	local i, step = Guide.Index()
	if i and step[1] == TRAIN and classTrainer() then
		state().done[i] = true
		touch()
	end
end)
-- What you can learn changes as you train: a training step with nothing left goes.
ns.On("TRAINER_CLOSED", touch)
ns.On("SPELLS_CHANGED", touch)

-- A grind step counts your experience down.
ns.On("PLAYER_XP_UPDATE", function(unit)
	if unit ~= "player" or not ns.char then
		return
	end
	local i, step = Guide.Index()
	if i and step[1] == GRIND then
		changed()
	end
end)

-- The route's quests at their givers ------------------------------------------------------------------------------------
-- Talking to a quest giver, the guide takes the quests the route takes in its next steps and hands in the finished
-- quests the route hands in. A reward to choose waits for you, and holding Shift while you talk leaves it all to you.
-- Nothing else is taken or handed in (a repeatable quest, one the route has not, one you skipped).

local AHEAD = 40 -- steps ahead whose quests are taken

--- Whether a dungeon step lists a quest among those to take first.
local function dungeonHas(step, q)
	for _, id in ipairs(type(step[8]) == "table" and step[8] or {}) do
		if id == q then
			return true
		end
	end
	return false
end

local function wantAccept(q)
	local i, _, r = Guide.Index()
	if not i or not plain(q) or not q then
		return false
	end
	local st = state()
	local dungeons = dungeonsOn()
	for j = i, math.min(#r.steps, i + AHEAD) do
		local step = r.steps[j]
		if step[1] == ACCEPT and step[2] == q and not st.skip[j] then
			return true
		end
		-- The quests a dungeon starts with, unless you left dungeons out or skipped or ran this one.
		if dungeons and step[1] == DUNGEON and not st.skip[j] and not st.done[j] and dungeonHas(step, q) then
			return true
		end
	end
	return false
end

local function wantTurnIn(q)
	local r = Guide.Route()
	if not r or not plain(q) or not q then
		return false
	end
	local st = state()
	local dungeons = dungeonsOn()
	for j, step in ipairs(r.steps) do
		if step[1] == TURNIN and step[2] == q then
			return not st.skip[j]
		end
		if dungeons and step[1] == DUNGEON and not st.skip[j] and dungeonHas(step, q) then
			return true
		end
	end
	return false
end

-- No more than a few clicks in a row: a giver that keeps offering the same thing cannot keep the guide clicking.
local clicks, since = 0, 0
local function auto()
	if not (ns.db and ns.db.guideAuto and ns.char and data()) or (IsShiftKeyDown and IsShiftKeyDown()) then
		return false
	end
	local now = GetTime and GetTime() or 0
	if now - since > 10 then
		clicks, since = 0, now
	end
	if clicks >= 15 then
		return false
	end
	clicks = clicks + 1
	return true
end

-- A giver with something to say first: its quests are in the gossip list.
ns.On("GOSSIP_SHOW", function()
	if not (C_GossipInfo and C_GossipInfo.GetActiveQuests and C_GossipInfo.GetAvailableQuests) or not auto() then
		return
	end
	for _, info in ipairs(C_GossipInfo.GetActiveQuests() or {}) do
		if info.isComplete == true and wantTurnIn(info.questID) then
			C_GossipInfo.SelectActiveQuest(info.questID)
			return
		end
	end
	for _, info in ipairs(C_GossipInfo.GetAvailableQuests() or {}) do
		if wantAccept(info.questID) then
			C_GossipInfo.SelectAvailableQuest(info.questID)
			return
		end
	end
end)

-- A giver with only quests: the greeting window lists them.
ns.On("QUEST_GREETING", function()
	if not (GetNumActiveQuests and GetNumAvailableQuests) or not auto() then
		return
	end
	for k = 1, GetNumActiveQuests() or 0 do
		local complete = GetActiveTitle and select(2, GetActiveTitle(k))
		if complete == true and GetActiveQuestID and wantTurnIn(GetActiveQuestID(k)) then
			SelectActiveQuest(k)
			return
		end
	end
	for k = 1, GetNumAvailableQuests() or 0 do
		local q = GetAvailableQuestInfo and select(5, GetAvailableQuestInfo(k))
		if wantAccept(q) then
			SelectAvailableQuest(k)
			return
		end
	end
end)

ns.On("QUEST_DETAIL", function()
	if QuestGetAutoAccept and QuestGetAutoAccept() then
		return -- the game has taken it already
	end
	if GetQuestID and wantAccept(GetQuestID()) and auto() then
		AcceptQuest()
	end
end)

ns.On("QUEST_PROGRESS", function()
	if GetQuestID and wantTurnIn(GetQuestID()) and IsQuestCompletable and IsQuestCompletable() and auto() then
		CompleteQuest()
	end
end)

ns.On("QUEST_COMPLETE", function()
	if not (GetQuestID and wantTurnIn(GetQuestID())) then
		return
	end
	-- A quest that costs money to hand in asks you first in the game's own window: so it does here.
	local cost = GetQuestMoneyToGet and GetQuestMoneyToGet()
	if cost ~= nil and (not plain(cost) or cost > 0) then
		return
	end
	local choices = GetNumQuestChoices and GetNumQuestChoices() or 0
	if plain(choices) and choices <= 1 and auto() then
		GetQuestReward(choices == 1 and 1 or 0)
	end
end)

ns.Listen("LOGIN", function()
	if not data() then
		return
	end
	local st = state()
	if st.waiting and (ns.player.level or 1) >= 12 then
		-- A Skyborne who left Zephras Isle while the add-on was off: the route starts at their level.
		st.waiting = nil
		Guide.StartAtLevel()
	end
	Guide.Route()
	-- Back on a character that went on without the guide: it picks up where you are.
	adapt(true)
	touch()
	-- Without the guide window on screen (closed, or the interface hidden), the guide still keeps up, once a second.
	if C_Timer and C_Timer.NewTicker then
		C_Timer.NewTicker(1, function()
			if not (ns.GuideFrame and ns.GuideFrame:IsVisible()) then
				Guide.Tick()
			end
		end)
	end
end)
