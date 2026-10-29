-- Dungeons and raids: each one's bosses in the order of a run with their abilities and loot, and the notable drops of
-- its regular mobs. The list on the left opens a dungeon in place: its wings, its bosses and its trash drops show under
-- it, one click each.
local _, ns = ...
local UI = ns.UI

local LEFT = 262
local view = { filter = "all", slug = nil, pick = nil } -- pick: nil (all boss loot), a boss's index, or "trash"
local FILTERS = { { "all", "All" }, { "mine", "My level" }, { "new", "New in Forever" } }
local KIND = { dungeon = "Dungeon", raid = "Raid", ["classic-raid"] = "Classic raid" }
local GROUPS = { { "dungeon", "Dungeons" }, { "raid", "Raids" }, { "classic-raid", "Classic raids" } }
local RANK = { [1] = "Elite", [2] = "Rare elite", [3] = "Boss", [4] = "Rare" }
-- The schools of magic in the colours the site gives them.
local SCHOOL = {
	[0] = { "Physical", "cfc6b6" },
	{ "Holy", "ffe27a" },
	{ "Fire", "ff8a4c" },
	{ "Nature", "93d86f" },
	{ "Frost", "82cbff" },
	{ "Shadow", "b994ff" },
	{ "Arcane", "f49af8" },
}
local NEUTRAL_ICON = "Interface\\Icons\\INV_Misc_QuestionMark"
local TEXT_X = 50 -- where the text of a list row starts, after its icon
local MAX_LINES = 8 -- the most lines an ability's text gets; the data keeps the texts shorter than that

local function keep(d)
	local f, level = view.filter, ns.player.level
	return f == "all" or (f == "mine" and d.lo > 0 and level >= d.lo - 2 and level <= d.hi) or (f == "new" and d.isNew)
end

local function findDungeon(slug)
	for _, d in ipairs(ns.dungeons) do
		if d.slug == slug then
			return d
		end
	end
end

local function hasFlag(boss, flag)
	return boss.f and (("," .. boss.f .. ","):find("," .. flag .. ",", 1, true)) and true or false
end

--- Whether a boss counts among the dungeon's bosses: rare spawns, world-event bosses, quest summons and the ones
--- players call up with something in the instance (the Blacksmithing Plans' smiths) do not.
local function counted(boss)
	return not (hasFlag(boss, "rare") or hasFlag(boss, "event") or hasFlag(boss, "quest") or hasFlag(boss, "summon"))
end

--- Whether two bosses are in the same run: always, unless each wing of the dungeon is a run of its own.
local function sameRun(d, a, b)
	return not d.runs or a.w == b.w
end

--- A boss's place in its run among the counted ones, or nil.
local function placeOf(d, index)
	local target = d.bosses and d.bosses[index]
	if not (target and counted(target)) then
		return nil
	end
	local n = 0
	for i, boss in ipairs(d.bosses) do
		if counted(boss) and sameRun(d, boss, target) then
			n = n + 1
		end
		if i == index then
			return n
		end
	end
end

--- How many counted bosses the run of a boss has.
local function runCount(d, target)
	if not d.runs then
		return d.count
	end
	local n = 0
	for _, boss in ipairs(d.bosses or {}) do
		if counted(boss) and sameRun(d, boss, target) then
			n = n + 1
		end
	end
	return n
end

--- What a boss is, in a few words: "rare spawn", "summoned", "quest summon"...
local function tags(boss)
	local out = {}
	if hasFlag(boss, "rare") then
		out[#out + 1] = "rare spawn"
	end
	if hasFlag(boss, "event") then
		out[#out + 1] = boss.ev and (boss.ev .. " only") or "world event only"
	end
	if hasFlag(boss, "quest") then
		out[#out + 1] = "quest summon"
	elseif hasFlag(boss, "summon") then
		out[#out + 1] = "optional summon"
	elseif hasFlag(boss, "summoned") then
		out[#out + 1] = "summoned"
	end
	if hasFlag(boss, "optional") then
		out[#out + 1] = "optional"
	end
	if hasFlag(boss, "oneOf") and boss.npcs then
		out[#out + 1] = "one of " .. #boss.npcs
	end
	return out
end

local function levelText(lo, hi)
	if not lo or lo <= 0 then
		return ""
	end
	return lo == hi and ("Level " .. lo) or ("Level " .. lo .. "-" .. hi)
end

--- "item:chance[:flags[:from]];..." -> rows. flags: 1 quest item, 2 recipe, 4 starts a quest; from: the creature's
--- place in the boss's npcs, 0 its chest.
local function parseLoot(text)
	local rows = {}
	for entry in (text or ""):gmatch("[^;]+") do
		local id, chance, rest = entry:match("^(%d+):([%d%.]+):?(.*)$")
		if id then
			local flags, from = rest:match("^(%d*):?(%d*)$")
			rows[#rows + 1] = { id = tonumber(id), chance = tonumber(chance), flags = tonumber(flags or "") or 0, from = tonumber(from or "") }
		end
	end
	return rows
end

--- "item:chance:npc,npc:more;..." -> rows.
local function parseTrash(text)
	local rows = {}
	for entry in (text or ""):gmatch("[^;]+") do
		local id, chance, npcs, more = entry:match("^(%d+):([%d%.]+):([%d,]*):(%d+)$")
		if id then
			local list = {}
			for n in npcs:gmatch("%d+") do
				list[#list + 1] = tonumber(n)
			end
			rows[#rows + 1] = { id = tonumber(id), chance = tonumber(chance), npcs = list, more = tonumber(more) or 0 }
		end
	end
	return rows
end

local function hasEncounters(d)
	return (d.bosses and #d.bosses > 0) or (d.trash and d.trash ~= "")
end

-- Quests --------------------------------------------------------------------------------------------------------------
-- A dungeon's quests (Data/Guide.lua: G.starts, G.dungeonQuests) for your side and class: { name, level, required level,
-- side, giver, area, x, y, item that starts it, quest before it, class mask, experience }.

local QUEST_ICON = "Interface\\GossipFrame\\AvailableQuestIcon"
local ACTIVE_ICON = "Interface\\GossipFrame\\ActiveQuestIcon"

local function dq(id)
	local G = ns.guide
	return G and G.starts and G.starts[id]
end

local function mySide()
	return ns.player.faction == "horde" and 2 or 1
end

--- Whether a quest is for your class (or any class).
local function forClass(q)
	local mask = q[11] or 0
	if mask ~= 0 then
		for i, slug in ipairs(ns.classOrder or {}) do
			if slug == ns.player.class then
				return math.floor(mask / 2 ^ (i - 1)) % 2 == 1
			end
		end
		return false
	end
	return true
end

--- A dungeon's quests for your class: yours (your side's or both), and, when other is set, the other side's alone.
local function dungeonQuests(d, other)
	local G = ns.guide
	local out = {}
	local side = mySide()
	for _, id in ipairs(G and G.dungeonQuests and G.dungeonQuests[d.slug] or {}) do
		local q = dq(id)
		if q and forClass(q) and (other and q[4] ~= 3 and q[4] ~= side or not other and (q[4] == 3 or q[4] == side)) then
			out[#out + 1] = id
		end
	end
	return out
end

--- How many quests a dungeon has to show: yours, else the other side's.
local function questCount(d)
	local n = #dungeonQuests(d)
	return n > 0 and n or #dungeonQuests(d, true), n > 0
end

--- The first quest of a quest's chain you have not done (the quest itself when the chain is behind you).
local function firstToDo(id)
	local chain, p, guard = { id }, dq(id) and dq(id)[10], 0
	while p and p ~= 0 and dq(p) and guard < 10 do
		table.insert(chain, 1, p)
		p, guard = dq(p)[10], guard + 1
	end
	for _, q in ipairs(chain) do
		if not ns.Guide.Completed(q) then
			return q
		end
	end
	return id
end

local function giverName(q)
	local G = ns.guide
	if not q or not q[5] or q[5] == 0 then
		return nil
	end
	return q[5] > 0 and G.npcs[q[5]] or G.objects[-q[5]]
end

--- A row for each of the dungeon's quests: done ones last.
local function questRows(d)
	local rows, done = {}, {}
	for _, id in ipairs(dungeonQuests(d)) do
		local q = dq(id)
		local finished = ns.Guide.Completed(id)
		local first = finished and id or firstToDo(id)
		local r = { kind = "quest", id = id, first = first, done = finished, active = ns.Guide.OnQuest(id), name = q[1], level = q[2], req = q[3] }
		local g = dq(first)
		if finished then
			r.sub = ns.Hex(ns.HEX.fog, "Done")
		elseif first ~= id then
			r.sub = ns.Hex(ns.HEX.gold, "First: ") .. g[1]
		elseif q[9] and q[9] ~= 0 then
			local item = ns.guide.items and ns.guide.items[q[9]] or (ns.ItemInfo(q[9]))
			r.sub = "Starts from " .. (item or "an item") .. " inside"
		else
			local who = giverName(q)
			r.sub = who and (who .. (q[6] ~= 0 and ns.Hex(ns.HEX.fog, "  ·  " .. ns.Guide.ZoneName(q[6])) or "")) or ""
		end
		if not finished and (q[3] or 0) > (ns.player.level or 1) then
			r.sub = ns.Hex(ns.HEX.mist, "From level " .. q[3] .. "  ·  ") .. r.sub
		end
		r.xp = not finished and ns.Guide.QuestXpText(id) or nil
		r.go = g and g[5] ~= 0 and g[6] ~= 0 and g or nil
		if finished then
			done[#done + 1] = r
		else
			rows[#rows + 1] = r
		end
	end
	for _, r in ipairs(done) do
		rows[#rows + 1] = r
	end
	-- The other side's quests, quiet, after yours: a Horde dungeon such as Ragefire Chasm still shows what it holds.
	local others = dungeonQuests(d, true)
	if #others > 0 then
		rows[#rows + 1] = { kind = "header", text = (mySide() == 1 and "Horde" or "Alliance") .. " quests", count = #others }
		for _, id in ipairs(others) do
			local q = dq(id)
			local who = giverName(q)
			rows[#rows + 1] = {
				kind = "quest", id = id, first = id, other = true, name = q[1], level = q[2], req = q[3],
				sub = who and ns.Hex(ns.HEX.fog, who .. (q[6] ~= 0 and ("  ·  " .. ns.Guide.ZoneName(q[6])) or "")) or "",
			}
		end
	end
	return rows
end

--- The left list: a header for dungeons, raids and Classic raids, each sorted by level; under the open one its wings,
--- bosses and trash drops.
local function entries()
	local out = {}
	for _, group in ipairs(GROUPS) do
		local list = {}
		for _, d in ipairs(ns.dungeons) do
			if d.kind == group[1] and keep(d) then
				list[#list + 1] = d
			end
		end
		table.sort(list, function(a, b)
			if (a.lo or 0) ~= (b.lo or 0) then
				return (a.lo or 0) < (b.lo or 0)
			end
			return a.name < b.name
		end)
		if #list > 0 then
			out[#out + 1] = { header = group[2] }
			for _, d in ipairs(list) do
				out[#out + 1] = { d = d }
				if d.slug == view.slug and hasEncounters(d) then
					local wing
					for i, boss in ipairs(d.bosses or {}) do
						if d.wings and boss.w and boss.w ~= wing then
							wing = boss.w
							out[#out + 1] = { d = d, wing = d.wings[wing] }
						end
						out[#out + 1] = { d = d, boss = i }
					end
					if d.trash and d.trash ~= "" then
						out[#out + 1] = { d = d, trash = true }
					end
				end
				if d.slug == view.slug then
					local n, mine = questCount(d)
					if n > 0 then
						out[#out + 1] = { d = d, quests = n, theirs = not mine }
					end
				end
			end
		end
	end
	return out
end

local function rowHeight(item)
	if item.header then
		return 36
	elseif item.wing then
		return 24
	elseif item.boss or item.trash or item.quests then
		return 30
	end
	return 50
end

--- Every boss's loot together, best first: what the dungeon gives.
local function allLoot(d)
	local rows = {}
	for _, boss in ipairs(d.bosses or {}) do
		for _, r in ipairs(parseLoot(boss.loot)) do
			local name, quality, icon, gear = ns.ItemInfo(r.id)
			if name then
				rows[#rows + 1] = { kind = "item", id = r.id, chance = r.chance, flags = r.flags, name = name, quality = quality, icon = icon, gear = gear, sub = boss.n }
			end
		end
	end
	table.sort(rows, function(a, b)
		if a.quality ~= b.quality then
			return (a.quality or 0) > (b.quality or 0)
		end
		if a.chance ~= b.chance then
			return (a.chance or 0) > (b.chance or 0)
		end
		return a.name < b.name
	end)
	return rows
end

--- Who of an encounter's creatures a row belongs to: "Baelog", or the chest's name.
local function whoOf(boss, from)
	if from == 0 then
		return boss.chest
	end
	local n = boss.npcs and boss.npcs[from]
	return n and n[2]
end

--- One boss: its abilities, what it calls and when it flees, then its loot.
local function bossRows(boss)
	local rows = {}
	local abilities = boss.ab or {}
	local extra = #(boss.calls or {}) + (boss.flees and 1 or 0)
	if #abilities + extra > 0 then
		rows[#rows + 1] = { kind = "header", text = "Abilities", count = #abilities }
		for _, a in ipairs(abilities) do
			local spell = ns.bossSpells and ns.bossSpells[a[1]]
			-- a spell the boss casts on its own creatures says on whom, before its text
			local text = a[2] or ""
			if a[5] and a[5] ~= "" then
				text = ns.Hex(ns.HEX.fog, "On " .. a[5] .. ":") .. (text ~= "" and (" " .. text) or "")
			end
			rows[#rows + 1] = { kind = "ability", id = a[1], name = spell and spell[1] or ("Spell " .. a[1]), school = spell and spell[2] or 0, text = text, when = a[3] or "", by = a[4] and a[4] > 0 and whoOf(boss, a[4]) or nil }
		end
		for _, line in ipairs(boss.calls or {}) do
			rows[#rows + 1] = { kind = "line", text = line }
		end
		if boss.flees then
			rows[#rows + 1] = { kind = "line", text = "Flees " .. boss.flees .. "." }
		end
	else
		rows[#rows + 1] = { kind = "line", text = "VMaNGOS lists no spells for this boss.", quiet = true }
	end
	local loot = {}
	for _, r in ipairs(parseLoot(boss.loot)) do
		local name, quality, icon, gear = ns.ItemInfo(r.id)
		if name then
			local bits = {}
			if r.flags % 2 == 1 then
				bits[#bits + 1] = "quest item"
			end
			if math.floor(r.flags / 4) % 2 == 1 then
				bits[#bits + 1] = "starts a quest"
			end
			if math.floor(r.flags / 2) % 2 == 1 then
				bits[#bits + 1] = "recipe"
			end
			if gear and gear[6] ~= "" then
				bits[#bits + 1] = gear[6]
			end
			-- whose drop it is when the encounter has several creatures (a chest is named in the header instead)
			local who = r.from and r.from > 0 and whoOf(boss, r.from)
			if who then
				bits[#bits + 1] = who
			end
			loot[#loot + 1] = { kind = "item", id = r.id, chance = r.chance, flags = r.flags, name = name, quality = quality, icon = icon, gear = gear, sub = table.concat(bits, "  ·  ") }
		end
	end
	rows[#rows + 1] = { kind = "header", text = boss.chest and ("Loot  ·  " .. boss.chest) or "Loot", count = #loot }
	if #loot == 0 then
		rows[#rows + 1] = { kind = "line", text = "No loot of its own.", quiet = true }
	end
	for _, r in ipairs(loot) do
		rows[#rows + 1] = r
	end
	return rows
end

--- The dungeon's notable trash drops: item, best chance, the mobs that drop it (how many first, so a long list cut
--- short still says it; the tooltip names them all).
local function trashRows(d)
	local rows = {}
	for _, t in ipairs(parseTrash(d.trash)) do
		local name, quality, icon, gear = ns.ItemInfo(t.id)
		if name then
			local mobs = {}
			for _, n in ipairs(t.npcs) do
				mobs[#mobs + 1] = (ns.dungeonNpcs and ns.dungeonNpcs[n]) or ("NPC " .. n)
			end
			local total = #mobs + t.more
			local sub = table.concat(mobs, ", ")
			if total > 1 then
				sub = ns.Hex(ns.HEX.text, total .. " mobs") .. "  ·  " .. sub
			end
			rows[#rows + 1] = { kind = "item", id = t.id, chance = t.chance, name = name, quality = quality, icon = icon, gear = gear, sub = sub, mobs = mobs, more = t.more }
		end
	end
	return rows
end

--- The instance the player stands in, as a map id, or nil.
local function currentMap()
	if not (GetInstanceInfo and IsInInstance) then
		return nil
	end
	local inside = IsInInstance()
	if not inside or (issecretvalue and issecretvalue(inside)) then
		return nil
	end
	local mapId = select(8, GetInstanceInfo())
	if type(mapId) ~= "number" or (issecretvalue and issecretvalue(mapId)) then
		return nil
	end
	return mapId
end

--- The creature id of the target, or nil.
local function targetNpc()
	if not (UnitGUID and UnitExists) or not UnitExists("target") then
		return nil
	end
	local guid = UnitGUID("target")
	if type(guid) ~= "string" or (issecretvalue and issecretvalue(guid)) then
		return nil
	end
	local kind, _, _, _, _, id = strsplit("-", guid)
	if kind ~= "Creature" and kind ~= "Vehicle" then
		return nil
	end
	return tonumber(id or "")
end

--- The page follows the player: the first time it shows during a visit to an instance it opens on that instance, and
--- when the target turns to a boss of the open dungeon it opens on that boss. Only a change does it: a plain refresh
--- (a level, the talents) leaves the dungeon and boss the player picked.
local shownMap, shownTarget
local function followPlayer()
	local mapId = currentMap()
	local entered = mapId ~= shownMap
	if entered then
		shownMap = mapId
		if mapId then
			for _, d in ipairs(ns.dungeons) do
				if d.map == mapId then
					view.slug, view.pick, view.filter = d.slug, nil, "all"
					view.reveal = true
					break
				end
			end
		end
	end
	local npc = targetNpc()
	if npc == shownTarget and not entered then
		return
	end
	shownTarget = npc
	local d = npc and view.slug and findDungeon(view.slug)
	if d then
		for i, boss in ipairs(d.bosses or {}) do
			local match = boss.id == npc
			for _, n in ipairs(boss.npcs or {}) do
				if n[1] == npc then
					match = true
				end
			end
			if match then
				view.pick = i
				view.reveal = true
				break
			end
		end
	end
end

--- Opens the page on one dungeon or raid (a link on another page). Where the player stands and what they target now
--- count as followed already, so the page stays on the dungeon asked for.
function ns.OpenDungeon(slug)
	view.slug, view.pick, view.filter = slug, nil, "all"
	view.reveal = true
	shownMap, shownTarget = currentMap(), targetNpc()
	ns.Open("dungeons")
end

--- An ability row's first line: its name, school, when it is cast and, in an encounter of several creatures, whose.
local function abilityLine(r)
	local school = SCHOOL[r.school] or SCHOOL[0]
	local line = r.name .. "  " .. ns.Hex(school[2], school[1])
	if r.when ~= "" then
		line = line .. ns.Hex(ns.HEX.gold, "  " .. (r.when == "passive" and "passive" or r.when))
	end
	if r.by then
		line = line .. ns.Hex(ns.HEX.fog, "  ·  " .. r.by)
	end
	return line
end

local function build(frame)
	frame.filters = {}
	for _, f in ipairs(FILTERS) do
		local chip = UI.Chip(frame, f[2], function()
			view.filter = f[1]
			frame:Update()
		end)
		chip.key = f[1]
		frame.filters[#frame.filters + 1] = chip
	end
	local h = UI.Flow(frame.filters, frame, 0, 0, LEFT, 6)
	local card
	card, frame.list = UI.CardList(frame, 50, function(list)
		local row = UI.Row(list)
		row.name = UI.Text(row, 13, ns.RGB.white, { weight = "medium" })
		row.name:SetPoint("TOPLEFT", 14, -10)
		row.name:SetPoint("TOPRIGHT", -10, -10)
		row.sub = UI.Text(row, 11, ns.RGB.mist)
		row.sub:SetPoint("TOPLEFT", 14, -29)
		row.sub:SetPoint("TOPRIGHT", -10, -29)
		-- a boss under its dungeon: its place in the run, its name, and a word on the right
		row.num = UI.Text(row, 11, ns.RGB.fog, { weight = "medium", justify = "RIGHT" })
		row.num:SetPoint("LEFT", 14, 0.5)
		row.num:SetWidth(18)
		row.label = UI.Text(row, 12, ns.RGB.text, { weight = "medium" })
		row.label:SetPoint("LEFT", 40, 0.5)
		row.label:SetPoint("RIGHT", -64, 0.5)
		row.tag = UI.Text(row, 10.5, ns.RGB.fog, { justify = "RIGHT" })
		row.tag:SetPoint("RIGHT", -10, 0.5)
		row.tag:SetWidth(56)
		row.mark = row:CreateTexture(nil, "ARTWORK")
		row.mark:SetTexture(UI.MEDIA .. "Disc16.tga")
		row.mark:SetSize(6, 6)
		row.mark:SetPoint("LEFT", 27, 0)
		row:SetScript("OnClick", function(self)
			local item = self.item
			if not (item and item.d) then
				return
			end
			if item.boss then
				view.pick = item.boss
			elseif item.trash then
				view.pick = "trash"
			elseif item.quests then
				view.pick = "quests"
			elseif not item.wing then
				-- a dungeon: open it on all its loot
				view.slug, view.pick = item.d.slug, nil
			end
			frame:Update()
		end)
		return row
	end, function(row, item)
		row.item = item
		local header = UI.HeaderRow(row)
		local isDungeon = item.d and not (item.boss or item.trash or item.wing or item.quests)
		header:SetShown(item.header ~= nil or item.wing ~= nil)
		row.rule:SetShown(item.header ~= nil)
		row.name:SetShown(isDungeon)
		row.sub:SetShown(isDungeon)
		row.num:SetShown(item.boss ~= nil)
		row.label:SetShown(item.boss ~= nil or item.trash ~= nil or item.quests ~= nil)
		row.tag:SetShown(item.boss ~= nil or item.quests ~= nil)
		row.mark:SetShown(item.trash ~= nil or item.quests ~= nil)
		row:SetSelected(false)
		row:EnableMouse(not (item.header or item.wing))
		if item.header then
			UI.SetFont(header, "bold", 12)
			header:SetTextColor(unpack(ns.RGB.white))
			header:ClearAllPoints()
			header:SetPoint("BOTTOMLEFT", 10, 9)
			header:SetPoint("BOTTOMRIGHT", -10, 9)
			header:SetText(item.header)
			return
		end
		if item.wing then
			-- a wing of the open dungeon, in small type over its bosses
			UI.SetFont(header, "bold", 10.5)
			header:SetTextColor(unpack(ns.RGB.fog))
			header:ClearAllPoints()
			header:SetPoint("BOTTOMLEFT", 40, 5)
			header:SetPoint("BOTTOMRIGHT", -10, 5)
			header:SetText(item.wing:upper())
			return
		end
		local d = item.d
		if item.boss then
			local boss = d.bosses[item.boss]
			-- counted bosses by their place in the run; rare spawns, event bosses and summons by what they are
			row.num:SetText(placeOf(d, item.boss) or "")
			row.label:SetText(boss.n)
			row.tag:SetText(hasFlag(boss, "rare") and "rare" or hasFlag(boss, "event") and "event" or hasFlag(boss, "quest") and "quest" or hasFlag(boss, "summon") and "summon" or hasFlag(boss, "optional") and "optional" or "")
			local on = view.slug == d.slug and view.pick == item.boss
			row:SetSelected(on)
			row.label:SetTextColor(unpack(on and ns.RGB.white or ns.RGB.text))
			return
		end
		if item.trash or item.quests then
			row.label:SetText(item.trash and "Notable trash drops" or "Quests")
			row.tag:SetText(item.quests and (item.theirs and ns.Hex(ns.HEX.fog, item.quests .. (mySide() == 1 and " Horde" or " Alliance")) or tostring(item.quests)) or "")
			local on = view.slug == d.slug and view.pick == (item.trash and "trash" or "quests")
			row:SetSelected(on)
			row.label:SetTextColor(unpack(on and ns.RGB.white or ns.RGB.text))
			row.mark:SetVertexColor(unpack(item.quests and ns.RGB.gold or UI.colors.gilt))
			return
		end
		row.name:SetText(d.name .. (d.isNew and ns.Hex(ns.HEX.new, "  new") or ""))
		local bits = { KIND[d.kind] or "", ns.Levels(d.lo, d.hi) }
		if d.size and d.size > 0 then
			bits[#bits + 1] = d.size .. " players"
		end
		row.sub:SetText(table.concat(bits, "  ·  "))
		row:SetSelected(view.slug == d.slug and view.pick == nil)
	end, rowHeight)
	card:SetPoint("TOPLEFT", 0, -(h + 10))
	card:SetPoint("BOTTOMLEFT")
	card:SetWidth(LEFT)

	-- The open dungeon, and in it the boss or list picked on the left.
	local right = CreateFrame("Frame", nil, frame)
	right:SetPoint("TOPLEFT", LEFT + 24, 0)
	right:SetPoint("BOTTOMRIGHT")
	frame.right = right
	right.name = UI.Text(right, 18, ns.RGB.white, { weight = "bold" })
	right.name:SetPoint("TOPLEFT")
	right.name:SetPoint("TOPRIGHT")
	right.meta = UI.Text(right, 12, ns.RGB.mist, { wrap = true })
	right.meta:SetPoint("TOPLEFT", 0, -28)
	right.meta:SetPoint("TOPRIGHT", 0, -28)
	right.summary = UI.Text(right, 12, ns.RGB.text, { wrap = true, spacing = 4 })
	right.empty = UI.Text(right, 12, ns.RGB.mist, { wrap = true, spacing = 4 })
	-- what is picked: a boss's name, what it is, and how it appears
	right.title = UI.Text(right, 15, ns.RGB.white, { weight = "bold" })
	right.info = UI.Text(right, 11.5, ns.RGB.mist, { wrap = true, spacing = 3 })
	right.note = UI.Text(right, 11.5, ns.RGB.text, { wrap = true, spacing = 3 })
	-- Measures an ability's text at the width its row gives it, for the row's height. Drawn see-through.
	right.measure = UI.Text(right, 11.5, ns.RGB.text, { wrap = true, spacing = 2 })
	right.measure:SetPoint("TOPLEFT")
	right.measure:SetAlpha(0)
	-- and an ability's first line, unbounded, to tell when it is too long for the row
	right.measureLine = UI.Text(right, 12, ns.RGB.white, { weight = "medium" })
	right.measureLine:SetPoint("TOPLEFT")
	right.measureLine:SetAlpha(0)

	right.card, right.list = UI.CardList(right, 46, function(list)
		local row = UI.Row(list)
		row.icon = UI.Icon(row, 32)
		row.icon:SetPoint("TOPLEFT", 10, -7)
		row.chance = UI.Text(row, 12, ns.RGB.text, { weight = "medium", justify = "RIGHT" })
		row.chance:SetPoint("RIGHT", -12, 0.5)
		row.chance:SetWidth(54)
		row.name = UI.Text(row, 12, ns.RGB.white, { weight = "medium" })
		row.sub = UI.Text(row, 11, ns.RGB.mist)
		row.text = UI.Text(row, 11.5, ns.RGB.text, { wrap = true, spacing = 2 })
		row.text:SetMaxLines(MAX_LINES)
		row:HookScript("OnEnter", function(self)
			local r = self.item
			if not r then
				return
			end
			if r.kind == "quest" then
				GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
				GameTooltip:SetText(r.name, 1, 1, 1)
				GameTooltip:AddLine("Level " .. r.level .. (r.req and r.req > 0 and r.req ~= r.level and ("  ·  requires " .. r.req) or ""), 0.64, 0.62, 0.58)
				if r.go then
					GameTooltip:AddLine("Click for the way to " .. (giverName(r.go) or "its giver") .. ".", 0.95, 0.71, 0.25, true)
				elseif r.other then
					GameTooltip:AddLine((mySide() == 1 and "Horde" or "Alliance") .. " only", 0.64, 0.62, 0.58)
				end
				GameTooltip:Show()
			elseif r.kind == "item" then
				UI.ItemTooltip(self, r.id)
				if r.mobs then
					-- a trash drop: who drops it, best chance first
					GameTooltip:AddLine(" ")
					GameTooltip:AddLine("Dropped by", 1, 0.82, 0)
					for _, mob in ipairs(r.mobs) do
						GameTooltip:AddLine(mob, 1, 1, 1)
					end
					if r.more > 0 then
						GameTooltip:AddLine("and " .. r.more .. " more", 0.6, 0.6, 0.6)
					end
					GameTooltip:Show()
				end
			elseif r.kind == "ability" then
				-- the game's own tooltip for the spell; if it has none, the school, when and what from Grimoire
				local school = SCHOOL[r.school] or SCHOOL[0]
				local lines = { ns.Hex(school[2], school[1]) }
				if r.when ~= "" then
					lines[#lines + 1] = ns.Hex(ns.HEX.white, r.when == "passive" and "Passive" or ("Cast " .. r.when))
				end
				if r.text ~= "" then
					lines[#lines + 1] = r.text
				end
				UI.SpellTooltip(self, r.id, r.name, lines)
			end
		end)
		row:HookScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		row:SetScript("OnClick", function(self)
			local r = self.item
			if not r then
				return
			end
			if r.kind == "quest" then
				local g = r.go
				if g then
					ns.Guide.GoTo({ area = g[6], x = g[7], y = g[8], title = giverName(g) or g[1], sub = g[1] })
				end
			elseif r.kind == "item" then
				UI.ItemClick(r.id)
			elseif r.kind == "ability" and IsModifiedClick and IsModifiedClick("CHATLINK") and ChatEdit_InsertLink then
				-- shift-click links the spell in chat, as the spellbook does
				local link = C_Spell and C_Spell.GetSpellLink and C_Spell.GetSpellLink(r.id)
				if link then
					ChatEdit_InsertLink(link)
				end
			end
		end)
		return row
	end, function(row, r)
		row.item = r
		local header = UI.HeaderRow(row)
		local isHeader = r.kind == "header"
		header:SetShown(isHeader)
		row.rule:SetShown(isHeader)
		local quest = r.kind == "quest"
		row.icon:SetShown(r.kind == "item" or r.kind == "ability" or quest)
		row.chance:SetShown(r.kind == "item" or quest)
		row.name:SetShown(r.kind == "item" or r.kind == "ability" or quest)
		row.sub:SetShown(r.kind == "item" or quest)
		row.text:SetShown(r.kind == "ability" or r.kind == "line")
		row:SetSelected(false)
		row:EnableMouse(r.kind == "item" or r.kind == "ability" or quest)
		if row.qicon then
			row.qicon:SetShown(quest)
		end
		row.text:ClearAllPoints()
		row.name:ClearAllPoints()
		if isHeader then
			header:SetText(r.text .. ns.Hex(ns.HEX.fog, "  " .. (r.count or 0)))
			return
		end
		if r.kind == "line" then
			row.text:SetPoint("TOPLEFT", 14, -5)
			row.text:SetPoint("TOPRIGHT", -12, -5)
			row.text:SetTextColor(unpack(r.quiet and ns.RGB.mist or ns.RGB.text))
			row.text:SetText(r.text)
			return
		end
		if r.kind == "ability" then
			local tex = C_Spell and C_Spell.GetSpellTexture and C_Spell.GetSpellTexture(r.id)
			row.icon:SetIcon(tex or NEUTRAL_ICON)
			local school = SCHOOL[r.school] or SCHOOL[0]
			if not tex then
				-- no icon from the game: the neutral one, tinted with the school's colour
				local c = UI.hex(school[2])
				row.icon.texture:SetVertexColor(c[1], c[2], c[3], 1)
			else
				row.icon.texture:SetVertexColor(1, 1, 1, 1)
			end
			row.icon:ClearAllPoints()
			row.icon:SetPoint("TOPLEFT", 12, -8)
			row.icon:SetSize(28, 28)
			row.name:SetPoint("TOPLEFT", TEXT_X, -8)
			row.name:SetPoint("TOPRIGHT", -12, -8)
			row.name:SetText(abilityLine(r))
			row.text:SetPoint("TOPLEFT", TEXT_X, -27)
			row.text:SetPoint("TOPRIGHT", -12, -27)
			row.text:SetTextColor(unpack(ns.RGB.text))
			row.text:SetText(r.text)
			return
		end
		if quest then
			-- a quest: the game's quest mark (a tick once done), its name and level, where it starts, its experience
			row.icon:Hide()
			if not row.qicon then
				row.qicon = row:CreateTexture(nil, "ARTWORK")
				row.qicon:SetSize(20, 20)
				row.qicon:SetPoint("LEFT", 16, 0)
			end
			row.qicon:Show()
			if r.done then
				row.qicon:SetTexture(UI.MEDIA .. "Check.tga")
				row.qicon:SetVertexColor(unpack(ns.RGB.green))
				row.qicon:SetDesaturated(false)
			else
				row.qicon:SetTexture(r.active and ACTIVE_ICON or QUEST_ICON)
				local dim = r.other or (r.req or 0) > (ns.player.level or 1) or r.first ~= r.id
				row.qicon:SetVertexColor(1, 1, 1, r.other and 0.5 or 1)
				row.qicon:SetDesaturated(dim)
			end
			row.name:SetPoint("TOPLEFT", 52, -7)
			row.name:SetPoint("TOPRIGHT", -74, -7)
			row.sub:ClearAllPoints()
			row.sub:SetPoint("TOPLEFT", 52, -25)
			row.sub:SetPoint("TOPRIGHT", -74, -25)
			local c = (r.done or r.other) and ns.HEX.mist or ns.HEX.white
			row.name:SetText(ns.Hex(r.done and ns.HEX.fog or c, r.name) .. ns.Hex(ns.HEX.fog, "  " .. r.level))
			row.sub:SetText(r.sub or "")
			row.chance:SetText(r.xp and ns.Hex(ns.HEX.xp, r.xp) or "")
			return
		end
		-- an item: icon, name in its quality's colour, what it is or who drops it, the chance
		row.icon:SetIcon(ns.Icon(r.icon), r.quality)
		row.icon.texture:SetVertexColor(1, 1, 1, 1)
		row.icon:ClearAllPoints()
		row.icon:SetPoint("LEFT", 10, 0)
		row.icon:SetSize(32, 32)
		-- The texts stop short of the chance column (54 wide, 12 from the edge).
		row.name:SetPoint("TOPLEFT", 52, -7)
		row.name:SetPoint("TOPRIGHT", -74, -7)
		row.sub:ClearAllPoints()
		row.sub:SetPoint("TOPLEFT", 52, -25)
		row.sub:SetPoint("TOPRIGHT", -74, -25)
		row.name:SetText(ns.QualityText(r.quality, r.name))
		row.sub:SetText(r.sub or "")
		row.chance:SetText(ns.Chance(r.chance))
	end, function(r)
		if r.kind == "header" then
			return 34
		elseif r.kind == "line" or r.kind == "ability" then
			return r.height or (r.kind == "line" and 24 or 46)
		end
		return 46
	end)

	--- The heights of the rows that wrap: an ability's name line over its text (MAX_LINES at most), a plain line.
	local function measure(rows)
		local width = right.card:GetWidth() or 0
		if width <= 0 then
			width = 728 - LEFT - 24
		end
		-- the list's inner width, less a scroll bar's room
		local inner = width - 12 - 16
		local most = MAX_LINES * 18
		for _, r in ipairs(rows) do
			if r.kind == "ability" and r.by then
				-- a first line too long for the row gives the caster's name to the text
				right.measureLine:SetText(abilityLine(r))
				if (right.measureLine:GetStringWidth() or 0) > inner - TEXT_X - 12 then
					r.text = ns.Hex(ns.HEX.fog, r.by .. ":") .. (r.text ~= "" and (" " .. r.text) or "")
					r.by = nil
				end
			end
			if (r.kind == "ability" or r.kind == "line") and r.text ~= "" then
				right.measure:SetWidth(r.kind == "ability" and (inner - TEXT_X - 12) or (inner - 14 - 12))
				right.measure:SetText(r.text)
				local h = math.min(most, math.ceil(right.measure:GetStringHeight() or 0))
				r.height = r.kind == "ability" and math.max(44, 27 + h + 9) or math.max(24, h + 10)
			elseif r.kind == "ability" then
				r.height = 44
			end
		end
		right.measure:SetText("")
		right.measureLine:SetText("")
	end

	--- Places a block of text under the last one; returns the next free line.
	local function place(fs, y, text, gap)
		fs:ClearAllPoints()
		fs:SetPoint("TOPLEFT", 0, -y)
		fs:SetPoint("TOPRIGHT", 0, -y)
		fs:SetText(text or "")
		fs:Show()
		return y + math.ceil(fs:GetStringHeight()) + (gap or 0)
	end

	function frame:Update()
		ns.UpdatePlayer()
		for _, chip in ipairs(self.filters) do
			chip:SetSelected(chip.key == view.filter)
		end
		local d = view.slug and findDungeon(view.slug)
		if d and not keep(d) then
			d = nil
		end
		if not d then
			-- The filter hid the open one: open the first it shows.
			for _, item in ipairs(entries()) do
				if item.d then
					d = item.d
					break
				end
			end
			view.slug, view.pick = d and d.slug, nil
		end
		if d and type(view.pick) == "number" and not (d.bosses and d.bosses[view.pick]) then
			view.pick = nil
		end
		if d and view.pick == "trash" and not (d.trash and d.trash ~= "") then
			view.pick = nil
		end
		if d and view.pick == "quests" and questCount(d) == 0 then
			view.pick = nil
		end
		local list = entries()
		local refilter = self.shownFilter ~= view.filter
		self.shownFilter = view.filter
		self.list:SetData(list, not refilter)
		-- The open dungeon in sight, with the boss open under it, but only when that changes (another dungeon, the
		-- filter, a link, the player's instance or target): after a click in the list nothing moves under the cursor.
		if d and (refilter or view.reveal or self.revealed ~= d.slug) then
			self.revealed = d.slug
			for i, item in ipairs(list) do
				if item.d == d and not (item.boss or item.trash or item.wing or item.quests) then
					self.list:Reveal(i)
					if type(view.pick) == "number" then
						for k = i + 1, #list do
							if list[k].d ~= d then
								break
							end
							if list[k].boss == view.pick then
								self.list:Reveal(k)
							end
						end
					end
					break
				end
			end
		end
		view.reveal = nil
		for _, fs in ipairs({ right.summary, right.empty, right.title, right.info, right.note }) do
			fs:Hide()
		end
		if not d then
			right:Hide()
			return
		end
		right:Show()
		right.name:SetText(d.name)
		local bits = { KIND[d.kind] or "", ns.Levels(d.lo, d.hi) }
		if d.size and d.size > 0 then
			bits[#bits + 1] = d.size .. " players"
		end
		if d.count and d.count > 0 then
			local rares = d.rares or 0
			bits[#bits + 1] = d.count .. (d.count == 1 and " boss" or " bosses") .. (rares > 0 and (", " .. rares .. (rares == 1 and " rare spawn" or " rare spawns")) or "")
		end
		if d.location ~= "" then
			bits[#bits + 1] = d.location
		end
		if d.status ~= "" then
			bits[#bits + 1] = d.isNew and ns.Hex(ns.HEX.new, d.status) or d.status
		end
		right.meta:SetText(table.concat(bits, "  ·  "))
		local y = 28 + math.ceil(right.meta:GetStringHeight()) + 12
		local rows
		if not hasEncounters(d) and view.pick ~= "quests" then
			if d.summary and d.summary ~= "" then
				y = place(right.summary, y, d.summary, 16)
			end
			right.card:Hide()
			place(right.empty, y, (d.kind == "raid" and "No open database has the bosses of this raid yet." or "No open database has the bosses of this dungeon yet."), 0)
			return
		end
		if type(view.pick) == "number" then
			local boss = d.bosses[view.pick]
			y = place(right.title, y, boss.n, 4)
			local info = {}
			local at = placeOf(d, view.pick)
			if at then
				-- where each wing is a run of its own, the place in the wing's run
				local wing = d.runs and d.wings and boss.w and d.wings[boss.w]
				info[1] = "Boss " .. at .. " of " .. (runCount(d, boss) or at) .. (wing and wing ~= "" and (" (" .. wing .. ")") or "")
			end
			if boss.lo and boss.lo > 0 then
				info[#info + 1] = levelText(boss.lo, boss.hi)
			end
			if RANK[boss.r] then
				info[#info + 1] = RANK[boss.r]
			end
			for _, t in ipairs(tags(boss)) do
				info[#info + 1] = ns.Hex(ns.HEX.gold, t)
			end
			local text = table.concat(info, "  ·  ")
			if boss.npcs then
				local who = {}
				for _, n in ipairs(boss.npcs) do
					who[#who + 1] = n[2] .. ns.Hex(ns.HEX.fog, " " .. (n[3] == n[4] and n[3] or (n[3] .. "-" .. n[4])))
				end
				text = text .. "\n" .. table.concat(who, ", ")
			end
			y = place(right.info, y, text, boss.note and 4 or 12)
			if boss.note then
				y = place(right.note, y, boss.note, 12)
			end
			rows = bossRows(boss)
			measure(rows)
		elseif view.pick == "quests" then
			y = place(right.title, y, "Quests", 4)
			local _, mine = questCount(d)
			y = place(right.info, y, mine and "Click one for the way to whoever starts it." or ("Its quests are the " .. (mySide() == 1 and "Horde" or "Alliance") .. "'s."), 12)
			rows = questRows(d)
		elseif view.pick == "trash" then
			y = place(right.title, y, "Notable trash drops", 4)
			y = place(right.info, y, "Uncommon or better items that drop mainly here, from the regular mobs: best quality first, with the best chance per kill.", 12)
			rows = trashRows(d)
		else
			if d.summary and d.summary ~= "" then
				y = place(right.summary, y, d.summary, 12)
			end
			y = place(right.title, y, "All boss loot", 4)
			y = place(right.info, y, "Every boss's drops, best first. Pick a boss on the left for its abilities and loot.", 12)
			rows = allLoot(d)
		end
		right.card:ClearAllPoints()
		right.card:SetPoint("TOPLEFT", 0, -y)
		right.card:SetPoint("BOTTOMRIGHT")
		right.card:Show()
		local key = d.slug .. "/" .. tostring(view.pick)
		right.list:SetData(rows, self.shownLoot == key)
		self.shownLoot = key
	end
end

ns.AddTab({
	key = "dungeons",
	label = "Dungeons",
	icon = "INV_Misc_Head_Dragon_01",
	order = 5,
	title = "Dungeons and raids",
	lede = "Every boss in order with its abilities and loot, and what the regular mobs drop.",
	build = build,
	show = function(frame)
		followPlayer()
		frame:Update()
	end,
})

--- Opens the page on one boss of a dungeon (its abilities and loot).
function ns.OpenDungeonBoss(slug, index)
	view.slug, view.pick, view.filter = slug, index, "all"
	view.reveal = true
	shownMap, shownTarget = currentMap(), targetNpc()
	ns.Open("dungeons")
end

--- Opens the page on a dungeon's quests: the one asked for, else the dungeon for your level with the most quests for you.
function ns.OpenDungeonQuests(slug)
	local d = slug and findDungeon(slug)
	if not d then
		local level, best, most = ns.player.level or 1, nil, 0
		for _, x in ipairs(ns.dungeons) do
			if x.kind == "dungeon" and x.lo > 0 and level >= x.lo - 2 and level <= x.hi then
				local n = #dungeonQuests(x)
				if n > most then
					best, most = x, n
				end
			end
		end
		d = best
	end
	if not d then
		ns.Open("dungeons")
		return
	end
	view.slug, view.filter = d.slug, "all"
	view.pick = questCount(d) > 0 and "quests" or nil
	view.reveal = true
	shownMap, shownTarget = currentMap(), targetNpc()
	ns.Open("dungeons")
end

-- Beside the game's group finder: a button that opens your dungeons' quests.
local function besideGroupFinder()
	local lfg = _G.LFGParentFrame
	if not lfg or lfg.grimoire then
		return
	end
	local b = CreateFrame("Button", nil, lfg)
	lfg.grimoire = b
	b:SetSize(34, 34)
	b:SetPoint("TOPLEFT", lfg, "TOPRIGHT", 2, -64)
	UI.Surface(b, 9, UI.colors.window, UI.colors.line)
	b.icon = b:CreateTexture(nil, "ARTWORK")
	b.icon:SetTexture("Interface\\GossipFrame\\AvailableQuestIcon")
	b.icon:SetSize(20, 20)
	b.icon:SetPoint("CENTER")
	b:SetScript("OnEnter", function(self)
		GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
		GameTooltip:SetText("Dungeon quests", 1, 1, 1)
		GameTooltip:AddLine("Grimoire: the quests of the dungeons for your level", 0.64, 0.62, 0.58, true)
		GameTooltip:Show()
	end)
	b:SetScript("OnLeave", function()
		GameTooltip:Hide()
	end)
	b:SetScript("OnClick", function()
		ns.OpenDungeonQuests()
	end)
end
ns.On("ADDON_LOADED", function()
	pcall(besideGroupFinder)
end)
ns.Listen("LOGIN", function()
	pcall(besideGroupFinder)
end)
