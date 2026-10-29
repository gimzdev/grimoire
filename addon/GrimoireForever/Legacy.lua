-- The Legacy system: the challenges this account has done and a perk plan for each character.
-- Challenges are ticked by hand, and the ones the game shows the add-on (a class reaching a level, a tradeskill reaching
-- a skill, Exalted with a Classic battleground's faction) tick themselves when you log in a character that has them. Some
-- challenges are ladders: a step brings the steps before it, and clearing one clears the steps after it.
-- Perks follow the game's rules, as on the site: one point per rank up to the cap; a perk with a gate opens once its tree
-- has that many points in the perks with a lower gate; a prerequisite has to be at full rank.
local _, ns = ...

local L = {}
ns.Legacy = L

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

local function data()
	return ns.legacy
end

local function store()
	ns.db.legacy = ns.db.legacy or {}
	local s = ns.db.legacy
	s.done = s.done or {}
	s.seen = s.seen or {}
	return s
end

-- Perks ---------------------------------------------------------------------------------------------------------

local perkIndex

local function index()
	if not perkIndex then
		perkIndex = { byId = {}, byCode = {} }
		for _, tree in ipairs(data() and data().trees or {}) do
			for _, p in ipairs(tree.perks) do
				perkIndex.byId[p.id] = { perk = p, tree = tree }
				perkIndex.byCode[p.code] = p.id
			end
		end
	end
	return perkIndex
end

--- A perk and its tree by id.
function L.Perk(id)
	local e = index().byId[id]
	if e then
		return e.perk, e.tree
	end
end

function L.Cap()
	return data() and data().points or 16
end

function L.TreeSpent(tree, ranks)
	local n = 0
	for _, p in ipairs(tree.perks) do
		n = n + (ranks[p.id] or 0)
	end
	return n
end

function L.Spent(ranks)
	local n = 0
	for _, tree in ipairs(data().trees) do
		n = n + L.TreeSpent(tree, ranks)
	end
	return n
end

--- Points in this tree's perks with a lower gate: what opens a perk with that gate.
function L.BelowGate(tree, ranks, gate)
	local n = 0
	for _, p in ipairs(tree.perks) do
		if p.gate < gate then
			n = n + (ranks[p.id] or 0)
		end
	end
	return n
end

function L.GateMet(tree, ranks, perk)
	return perk.gate <= 0 or L.BelowGate(tree, ranks, perk.gate) >= perk.gate
end

function L.ReqMet(ranks, perk)
	if not perk.req then
		return true
	end
	local req = L.Perk(perk.req)
	return not req or (ranks[req.id] or 0) >= req.max
end

--- Why a point cannot go into this perk now: "max", "points", "gate" or "req"; nil when it can.
function L.Block(ranks, id, cap)
	local perk, tree = L.Perk(id)
	if not perk or (ranks[id] or 0) >= perk.max then
		return "max"
	end
	if L.Spent(ranks) >= (cap or L.Cap()) then
		return "points"
	end
	if not L.GateMet(tree, ranks, perk) then
		return "gate"
	end
	if not L.ReqMet(ranks, perk) then
		return "req"
	end
	return nil
end

--- Open to points: its gate and prerequisite are met (full ranks and the cap aside).
function L.Open(ranks, id)
	local b = L.Block(ranks, id, math.huge)
	return b == nil or b == "max"
end

--- A point can come out of this perk without leaving another perk's gate or prerequisite unmet.
function L.CanRemove(ranks, id)
	local perk, tree = L.Perk(id)
	if not perk or (ranks[id] or 0) <= 0 then
		return false
	end
	local after = {}
	for k, v in pairs(ranks) do
		after[k] = v
	end
	after[id] = after[id] - 1
	for _, p in ipairs(tree.perks) do
		if (after[p.id] or 0) > 0 and (not L.GateMet(tree, after, p) or not L.ReqMet(after, p)) then
			return false
		end
	end
	return true
end

--- Replays a point order: points that are not legal at their turn drop out. Returns the ranks and the order kept.
function L.Replay(order)
	local ranks, kept = {}, {}
	for _, id in ipairs(order) do
		if L.Block(ranks, id) == nil then
			ranks[id] = (ranks[id] or 0) + 1
			kept[#kept + 1] = id
		end
	end
	return ranks, kept
end

--- The order without its point at i, replayed. A later point that loses its footing goes back in at the end as soon as
--- it is legal again, so the ranks and the order always describe the same plan.
function L.Without(order, i)
	local rest = {}
	for j, id in ipairs(order) do
		if j ~= i then
			rest[#rest + 1] = id
		end
	end
	local ranks, kept = L.Replay(rest)
	local left = {}
	for _, id in ipairs(kept) do
		left[id] = (left[id] or 0) + 1
	end
	local skipped = {}
	for _, id in ipairs(rest) do
		if (left[id] or 0) > 0 then
			left[id] = left[id] - 1
		else
			skipped[#skipped + 1] = id
		end
	end
	local again = true
	while again and #skipped > 0 do
		again = false
		for j, id in ipairs(skipped) do
			if L.Block(ranks, id) == nil then
				table.remove(skipped, j)
				ranks[id] = (ranks[id] or 0) + 1
				kept[#kept + 1] = id
				again = true
				break
			end
		end
	end
	return ranks, kept
end

--- A legal order that gives these ranks, as far as the rules allow: perks with the lowest gates first.
function L.OrderFor(wanted)
	local perks = {}
	for _, tree in ipairs(data().trees) do
		for _, p in ipairs(tree.perks) do
			perks[#perks + 1] = p
		end
	end
	table.sort(perks, function(a, b)
		if a.gate ~= b.gate then
			return a.gate < b.gate
		end
		if a.row ~= b.row then
			return a.row < b.row
		end
		return a.col < b.col
	end)
	local ranks, order = {}, {}
	local progress = true
	while progress do
		progress = false
		for _, p in ipairs(perks) do
			while (ranks[p.id] or 0) < math.min(p.max, wanted[p.id] or 0) and L.Block(ranks, p.id) == nil do
				ranks[p.id] = (ranks[p.id] or 0) + 1
				order[#order + 1] = p.id
				progress = true
			end
		end
	end
	return order
end

--- A plan as one character per point, the site's own link format.
function L.Encode(order)
	local out = {}
	for _, id in ipairs(order) do
		local p = L.Perk(id)
		if p then
			out[#out + 1] = p.code
		end
	end
	return table.concat(out)
end

--- A plan from a site link or its code.
function L.Decode(text)
	local out = {}
	if type(text) ~= "string" then
		return out
	end
	local code = text:match("[?&]p=(%w+)") or text:match("^%s*(%w+)%s*$") or ""
	for ch in code:sub(1, 64):gmatch(".") do
		local id = index().byCode[ch]
		if id then
			out[#out + 1] = id
		end
	end
	return out
end

function L.Link(order)
	local code = L.Encode(order)
	return "https://wowgrimoire.app/tools/legacy?tab=perks" .. (code ~= "" and ("&p=" .. code) or "")
end

--- This character's plan: ranks and the order its points go in.
function L.Plan()
	return L.Replay(L.Decode(ns.char and ns.char.legacyPlan or ""))
end

-- The plans this character had before each change this session, newest last, for Undo.
local past = {}

function L.SetPlan(order)
	local _, kept = L.Replay(order)
	local code, was = L.Encode(kept), ns.char.legacyPlan or ""
	if code == was then
		return
	end
	past[#past + 1] = was
	if #past > 100 then
		table.remove(past, 1)
	end
	ns.char.legacyPlan = code
	ns.Send("LEGACY")
end

function L.CanUndo()
	return #past > 0
end

--- Puts back the plan as it was before the last change.
function L.Undo()
	local code = table.remove(past)
	if code then
		ns.char.legacyPlan = code
		ns.Send("LEGACY")
	end
end

-- Perks as the game has them --------------------------------------------------------------------------------------

local iconFiles

local function perkForEntry(tree, config, entryID, maxRanks)
	local ok, entry = pcall(C_Traits.GetEntryInfo, config, entryID)
	if not ok or type(entry) ~= "table" or not plain(entry.definitionID) then
		return nil
	end
	local okD, def = pcall(C_Traits.GetDefinitionInfo, entry.definitionID)
	if not okD or type(def) ~= "table" then
		return nil
	end
	local name = plain(def.overrideName) and def.overrideName ~= "" and def.overrideName or nil
	local icon = plain(def.overrideIcon) and def.overrideIcon or nil
	if def.spellID and plain(def.spellID) and C_Spell then
		if not name and C_Spell.GetSpellName then
			local okN, n = pcall(C_Spell.GetSpellName, def.spellID)
			name = okN and plain(n) and n or nil
		end
		if not icon and C_Spell.GetSpellTexture then
			local okI, i = pcall(C_Spell.GetSpellTexture, def.spellID)
			icon = okI and plain(i) and i or nil
		end
	end
	-- By name in an English client, else by icon and rank count, which hold in every language.
	for _, p in ipairs(tree.perks) do
		if name and p.name == name then
			return p
		end
	end
	if icon and GetFileIDFromPath then
		if not iconFiles then
			iconFiles = {}
			for _, t in ipairs(data().trees) do
				for _, p in ipairs(t.perks) do
					local okF, file = pcall(GetFileIDFromPath, ns.Icon(p.icon))
					iconFiles[p.id] = okF and file or nil
				end
			end
		end
		for _, p in ipairs(tree.perks) do
			if iconFiles[p.id] and iconFiles[p.id] == icon and p.max == maxRanks then
				return p
			end
		end
	end
	return nil
end

--- This character's Legacy perks as the game has them, when the client lets add-ons read its Legacy trees:
--- { [perk id] = rank }, or nil.
function L.FromGame()
	if not (data() and C_Traits and C_Traits.GetConfigIDByTreeID and C_Traits.GetTreeNodes and C_Traits.GetNodeInfo and C_Traits.GetEntryInfo and C_Traits.GetDefinitionInfo) then
		return nil
	end
	local out, found = {}, false
	for _, tree in ipairs(data().trees) do
		local ok, config = pcall(C_Traits.GetConfigIDByTreeID, tree.id)
		if ok and plain(config) and type(config) == "number" and config > 0 then
			local okN, nodes = pcall(C_Traits.GetTreeNodes, tree.id)
			if okN and type(nodes) == "table" then
				for _, nodeID in ipairs(nodes) do
					local okI, node = pcall(C_Traits.GetNodeInfo, config, nodeID)
					if okI and type(node) == "table" and plain(node.maxRanks) and type(node.maxRanks) == "number" and node.maxRanks > 0 then
						local entryID = (type(node.activeEntry) == "table" and node.activeEntry.entryID) or (type(node.entryIDs) == "table" and node.entryIDs[1])
						local perk = entryID and plain(entryID) and perkForEntry(tree, config, entryID, node.maxRanks)
						if perk then
							found = true
							local rank = 0
							if plain(node.ranksPurchased) and type(node.ranksPurchased) == "number" then
								rank = node.ranksPurchased
							elseif plain(node.activeRank) and type(node.activeRank) == "number" then
								rank = node.activeRank
							end
							out[perk.id] = math.max(0, math.min(perk.max, rank))
						end
					end
				end
			end
		end
	end
	return found and out or nil
end

-- Challenges ----------------------------------------------------------------------------------------------------

local byKey

local function challenge(key)
	if not byKey then
		byKey = {}
		for _, c in ipairs(data() and data().challenges or {}) do
			byKey[c.key] = c
		end
	end
	return byKey[key]
end
L.Challenge = challenge

function L.Done(key)
	return store().done[key] == true
end

--- The character the game showed a challenge on, when it ticked itself.
function L.SeenOn(key)
	return store().seen[key]
end

--- Ticks or clears a challenge; on a ladder the steps before it come along when ticking, the steps after it when clearing.
function L.Toggle(key)
	local c = challenge(key)
	if not c then
		return
	end
	local s = store()
	local on = not s.done[key]
	if not c.ladder then
		s.done[key] = on or nil
		if not on then
			s.seen[key] = nil
		end
	else
		for _, x in ipairs(data().challenges) do
			if x.ladder == c.ladder then
				if on and x.step <= c.step then
					s.done[x.key] = true
				elseif not on and x.step >= c.step then
					s.done[x.key] = nil
					s.seen[x.key] = nil
				end
			end
		end
	end
	ns.Send("LEGACY")
end

--- Ticks a challenge the game showed, with the steps before it. Returns true when something was new.
local function mark(key, by)
	local c = challenge(key)
	if not c then
		return false
	end
	local s = store()
	local new = false
	for _, x in ipairs(data().challenges) do
		if x.key == key or (c.ladder and x.ladder == c.ladder and x.step <= c.step) then
			if not s.done[x.key] then
				s.done[x.key] = true
				s.seen[x.key] = by
				new = true
			end
		end
	end
	return new
end

function L.Earned()
	local n = 0
	for _, c in ipairs(data() and data().challenges or {}) do
		if L.Done(c.key) then
			n = n + (c.points or 1)
		end
	end
	return n
end

function L.CountDone(group)
	local done, total = 0, 0
	for _, c in ipairs(data().challenges) do
		if c.group == group then
			total = total + 1
			if L.Done(c.key) then
				done = done + 1
			end
		end
	end
	return done, total
end

function L.ClearAll()
	local s = store()
	s.done, s.seen = {}, {}
	ns.Send("LEGACY")
end

-- What the game shows: this character's level and tradeskills, and battleground reputations.
local function professions()
	local out = {}
	if not (GetProfessions and GetProfessionInfo) then
		return out
	end
	local got = { pcall(GetProfessions) }
	if not got[1] then
		return out
	end
	-- the first two are the primary tradeskills; either can be missing
	for i = 2, 3 do
		local index = got[i]
		if index and plain(index) then
			local ok, _, _, rank, _, _, _, skillLine = pcall(GetProfessionInfo, index)
			if ok and plain(rank) and plain(skillLine) and type(rank) == "number" then
				out[skillLine] = rank
			end
		end
	end
	return out
end

function L.Detect()
	if not (data() and ns.db and ns.player) then
		return
	end
	local P = ns.player
	local who = P.name and plain(P.name) and P.name or nil
	local new = false
	for _, c in ipairs(data().challenges) do
		if c.cls and c.level and c.cls == P.class and (P.level or 0) >= c.level then
			new = mark(c.key, who) or new
		end
	end
	local skills = professions()
	for _, c in ipairs(data().challenges) do
		if c.skillLine and c.skill and skills[c.skillLine] and skills[c.skillLine] >= c.skill then
			new = mark(c.key, who) or new
		end
	end
	if C_Reputation and C_Reputation.GetFactionDataByID then
		for _, c in ipairs(data().challenges) do
			if c.factions then
				for _, id in ipairs({ c.factions.allianceId or 0, c.factions.hordeId or 0 }) do
					if id > 0 then
						local ok, f = pcall(C_Reputation.GetFactionDataByID, id)
						if ok and type(f) == "table" and plain(f.reaction) and type(f.reaction) == "number" and f.reaction >= 8 then
							new = mark(c.key, who) or new
						end
					end
				end
			end
		end
	end
	if new then
		ns.Send("LEGACY")
	end
end

local function detectSoon()
	if C_Timer and C_Timer.After then
		C_Timer.After(1, L.Detect)
	else
		L.Detect()
	end
end

ns.Listen("LOGIN", detectSoon)
ns.On("PLAYER_LEVEL_UP", function(level)
	if plain(level) and type(level) == "number" and ns.player then
		ns.player.level = level
	end
	L.Detect()
end)
ns.On("SKILL_LINES_CHANGED", L.Detect)
ns.On("UPDATE_FACTION", L.Detect)
