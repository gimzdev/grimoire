-- Who is playing: class, race, faction and level; their build, their talents and the spells they can train.
local _, ns = ...

local P = { level = 1 }
ns.player = P

local CLASS_BY_FILE = {
	WARRIOR = "warrior",
	PALADIN = "paladin",
	HUNTER = "hunter",
	ROGUE = "rogue",
	PRIEST = "priest",
	SHAMAN = "shaman",
	MAGE = "mage",
	WARLOCK = "warlock",
	DRUID = "druid",
}

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

function ns.UpdatePlayer()
	P.name = UnitName("player")
	local level = UnitLevel("player")
	if plain(level) and level > 0 then
		P.level = level
	end
	local _, classFile = UnitClass("player")
	P.class = plain(classFile) and CLASS_BY_FILE[classFile] or P.class
	local raceName, _, raceID = UnitRace("player")
	for slug, r in pairs(ns.races or {}) do
		if (plain(raceID) and r.id == raceID) or (plain(raceName) and r.name == raceName) then
			P.race = slug
		end
	end
	local faction = UnitFactionGroup("player")
	if faction == "Horde" then
		P.faction = "horde"
	elseif faction == "Alliance" then
		P.faction = "alliance"
	else
		P.faction = P.race and ns.races[P.race] and ns.races[P.race].faction or "alliance"
	end
end

-- Builds ------------------------------------------------------------------------------------------------------

--- A build by id, Grimoire's or one of yours (Builds.lua): the build and its class.
function ns.FindBuild(id)
	if not id then
		return nil
	end
	for cls, list in pairs(ns.builds or {}) do
		for _, b in ipairs(list) do
			if b.id == id then
				return b, cls
			end
		end
	end
	if ns.FindCustomBuild then
		local b, cls = ns.FindCustomBuild(id)
		if b then
			return b, cls
		end
	end
end

--- The build this character follows, when they picked one for their own class.
function ns.SelectedBuild()
	local b, cls = ns.FindBuild(ns.char and ns.char.build)
	if b and cls == P.class then
		return b
	end
end

--- Follows a build; nil stops following.
function ns.SelectBuild(id)
	ns.char.build = id
	if not id then
		-- No "pick a build" hint at the next level-up either: not following was a choice.
		ns.char.hinted = true
	end
	ns.Send("BUILD")
end

--- Stops following the build this character follows. Returns the build it followed, if any.
function ns.StopFollowing()
	local b = ns.SelectedBuild()
	if ns.char.build ~= nil or b then
		ns.SelectBuild(nil)
	end
	return b
end

local talentIndex = {}

--- A talent of a class by id: { tree = index, treeName = name, talent = record }.
function ns.Talent(cls, id)
	local index = talentIndex[cls]
	if not index then
		index = {}
		local data = ns.talents and ns.talents[cls]
		for treeIndex, tree in ipairs(data and data.trees or {}) do
			for _, t in ipairs(tree.talents) do
				index[t.id] = { tree = treeIndex, treeName = tree.name, talent = t }
			end
		end
		talentIndex[cls] = index
	end
	return index[id]
end

--- The build point by point: { n, level, id, rank, info }. Point n comes at level n + 9, or earlier with the
--- Legacy perk Talented (see ns.PointLevel).
function ns.BuildSteps(build, cls)
	if build._steps then
		return build._steps
	end
	local steps, ranks = {}, {}
	for n, id in ipairs(build.order) do
		ranks[id] = (ranks[id] or 0) + 1
		steps[n] = { n = n, level = n + 9, id = id, rank = ranks[id], info = ns.Talent(cls, id) }
	end
	build._steps = steps
	return steps
end

local talentNames = {}

--- Names of a class's talents, to tell talent spells from trainer spells.
function ns.TalentNames(cls)
	if not talentNames[cls] then
		local names = {}
		local data = ns.talents and ns.talents[cls]
		for _, tree in ipairs(data and data.trees or {}) do
			for _, t in ipairs(tree.talents) do
				names[t.name] = true
			end
		end
		talentNames[cls] = names
	end
	return talentNames[cls]
end

-- The player's own talents --------------------------------------------------------------------------------------

local lookups = {}

--- A class's talents by name, and by icon and rank count (the game's icon file id, so it works in every language).
local function talentLookup(cls)
	local l = lookups[cls]
	if not l then
		l = { names = {}, icons = {} }
		local data = ns.talents and ns.talents[cls]
		for _, tree in ipairs(data and data.trees or {}) do
			for _, t in ipairs(tree.talents) do
				l.names[t.name] = t
				local file = GetFileIDFromPath and t.icon and GetFileIDFromPath(ns.Icon(t.icon))
				if file then
					local key = file .. ":" .. t.max
					-- Two talents with one icon and one rank count cannot be told apart this way.
					l.icons[key] = l.icons[key] == nil and t or false
				end
			end
		end
		lookups[cls] = l
	end
	return l
end

--- The talent a trait node stands for: by name on an English client, else by its icon and rank count.
local function matchNode(l, node, def)
	local name = def.overrideName
	if (not name or name == "") and def.spellID and C_Spell and C_Spell.GetSpellName then
		name = C_Spell.GetSpellName(def.spellID)
	end
	if plain(name) and l.names[name] then
		return l.names[name]
	end
	local icon = def.overrideIcon
	if (not icon or icon == 0) and def.spellID and C_Spell and C_Spell.GetSpellTexture then
		icon = C_Spell.GetSpellTexture(def.spellID)
	end
	local max = node.maxRanks
	if plain(icon) and icon and plain(max) and max then
		return l.icons[icon .. ":" .. max] or nil
	end
	return nil
end

local cachedRanks

--- The player's talents as { [talent id] = points } and the points spent, read from the game's talent system. Nil
--- when they cannot be read, or when a spent point cannot be matched to a talent: better no answer than a wrong one.
function ns.ReadTalents()
	if cachedRanks then
		return cachedRanks.ranks, cachedRanks.spent
	end
	if not (P.class and C_ClassTalents and C_ClassTalents.GetActiveConfigID and C_Traits and C_Traits.GetConfigInfo) then
		return nil
	end
	local l = talentLookup(P.class)
	local ok, ranks, spent = pcall(function()
		local configID = C_ClassTalents.GetActiveConfigID()
		if not plain(configID) or not configID then
			return nil
		end
		local config = C_Traits.GetConfigInfo(configID)
		if not config or not config.treeIDs then
			return nil
		end
		local out, total = {}, 0
		for _, treeID in ipairs(config.treeIDs) do
			for _, nodeID in ipairs(C_Traits.GetTreeNodes(treeID) or {}) do
				local node = C_Traits.GetNodeInfo(configID, nodeID)
				local rank = node and (node.ranksPurchased or node.activeRank) or 0
				if plain(rank) and rank > 0 then
					local entryID = (node.activeEntry and node.activeEntry.entryID) or (node.entryIDs and node.entryIDs[1])
					local entry = entryID and C_Traits.GetEntryInfo(configID, entryID)
					local def = entry and entry.definitionID and C_Traits.GetDefinitionInfo(entry.definitionID)
					local t = def and matchNode(l, node, def)
					if not t then
						return nil
					end
					total = total + rank
					out[t.id] = (out[t.id] or 0) + rank
				end
			end
		end
		return out, total
	end)
	if ok and type(ranks) == "table" then
		cachedRanks = { ranks = ranks, spent = spent }
		return ranks, spent
	end
	return nil
end

function ns.ForgetTalents()
	cachedRanks = nil
end

--- Unspent talent points, or nil when the game does not say.
function ns.UnspentPoints()
	local best
	if C_ClassTalents and C_ClassTalents.HasUnspentTalentPoints then
		local ok, _, classPoints, specPoints = pcall(C_ClassTalents.HasUnspentTalentPoints)
		if ok and plain(classPoints) and plain(specPoints) then
			best = (tonumber(classPoints) or 0) + (tonumber(specPoints) or 0)
		end
	end
	if GetNumUnspentTalents then
		local ok, n = pcall(GetNumUnspentTalents)
		if ok and plain(n) and type(n) == "number" then
			best = math.max(best or 0, n)
		end
	end
	return best
end

--- Talent points this character has, spent or not: at least one a level from 10, more with the Talented perk.
function ns.PointsAvailable()
	local byLevel = math.max(0, math.min(51, P.level - 9))
	local _, spent = ns.ReadTalents()
	local unspent = ns.UnspentPoints()
	if spent and unspent then
		return math.max(byLevel, math.min(51, spent + unspent))
	end
	return math.max(byLevel, spent or 0)
end

--- How many levels early this character's talent points come: up to five with the Talented perk, seen as more
--- points than the level gives.
function ns.PointShift()
	return math.max(0, math.min(5, ns.PointsAvailable() - math.max(0, P.level - 9)))
end

--- The level a build's point arrives at for this character: point n at n + 9, sooner with the Talented perk.
function ns.PointLevel(n, shift)
	return math.max(5, n + 9 - (shift or ns.PointShift()))
end

ns.On("TRAIT_CONFIG_UPDATED", function()
	ns.ForgetTalents()
	ns.Send("TALENTS")
end)
ns.On("PLAYER_TALENT_UPDATE", function()
	ns.ForgetTalents()
	ns.Send("TALENTS")
end)

--- Where the player stands in a build. Returns the steps; their states (done, missing: a point you have that is not
--- where the build puts it, reached: a point you have when your talents cannot be read, ahead); the next step to
--- take; whether the talents were read; and whether that next point is yours to spend now. A build of your own can
--- plan fewer than 51 points: past its last one there is no next step (see ns.PlanEnded).
function ns.BuildProgress(build, cls)
	local steps = ns.BuildSteps(build, cls)
	local own = cls == P.class
	local ranks = own and ns.ReadTalents() or nil
	local available = own and ns.PointsAvailable() or 0
	local state, nextStep = {}, nil
	for n, step in ipairs(steps) do
		if own and ranks then
			if (ranks[step.id] or 0) >= step.rank then
				state[n] = "done"
			else
				state[n] = n <= available and "missing" or "ahead"
				nextStep = nextStep or step
			end
		elseif own and n <= available then
			state[n] = "reached"
		else
			state[n] = "ahead"
		end
	end
	if own and not ranks then
		-- Unread talents: the newest point you have, or the first; none once you have more points than the build plans.
		nextStep = available <= #steps and steps[math.max(1, math.min(#steps, available))] or nil
	end
	local ready = nextStep ~= nil and own and nextStep.n <= available
	return steps, state, nextStep, ranks ~= nil, ready
end

--- Whether this character has talent points past the last one a build plans (a build of your own can stop short of 51)
--- and none of the planned points is left to spend.
function ns.PlanEnded(build, cls)
	local steps, _, nextStep = ns.BuildProgress(build, cls)
	return cls == P.class and nextStep == nil and ns.PointsAvailable() > #steps
end

-- Spells ------------------------------------------------------------------------------------------------------

function ns.Knows(spellID)
	if not spellID then
		return false
	end
	if IsPlayerSpell and IsPlayerSpell(spellID) then
		return true
	end
	if IsSpellKnown and IsSpellKnown(spellID) then
		return true
	end
	return false
end

--- Trainer spells of the player's class up to a level that they do not know yet. Talent spells are left out.
--- Ranks of one spell share a key; "Polymorph: Pig" and the like are spells of their own.
local function spellKey(a)
	local rank = a.rank or ""
	if rank == "" or rank:match("^Rank %d+$") then
		return a.name
	end
	return a.name .. "|" .. rank
end
ns.SpellKey = spellKey

-- Spells that are not for every character of a class: another race's priest spells, the other faction's city
-- teleports and portals, and Teleport: Dalaran, which trainers do not sell.
local CITY_SIDE = { Stormwind = "alliance", Ironforge = "alliance", Darnassus = "alliance", Orgrimmar = "horde", Undercity = "horde", ["Thunder Bluff"] = "horde" }
local NOT_SOLD = { ["Teleport: Dalaran"] = true }

--- Whether this character can learn a spell of their class; when not, a short reason.
function ns.Learnable(a)
	if NOT_SOLD[a.name] then
		return false, "not sold by trainers"
	end
	local city = a.name:match("^Teleport: (.+)$") or a.name:match("^Portal: (.+)$")
	local side = city and CITY_SIDE[city]
	if side and P.faction and side ~= P.faction then
		return false, side == "horde" and "Horde only" or "Alliance only"
	end
	local cls = P.class or ""
	local race = ns.races and ns.races[P.race or ""]
	for _, v in ipairs(race and race.variants[cls] or {}) do
		if v.name == a.name then
			return true
		end
	end
	for slug, r in pairs(ns.races or {}) do
		if slug ~= P.race then
			for _, v in ipairs(r.variants[cls] or {}) do
				if v.name == a.name then
					return false, r.name .. " only"
				end
			end
		end
	end
	return true
end

--- The highest rank you know of each spell, by spell key.
function ns.KnownRanks()
	local known = {}
	for _, a in ipairs(ns.abilities and ns.abilities[P.class or ""] or {}) do
		if ns.Knows(a.id) then
			local key, r = spellKey(a), ns.RankNumber(a.rank)
			if r > (known[key] or 0) then
				known[key] = r
			end
		end
	end
	return known
end

--- Whether the trainer teaches you this rank: every class spell does, and a talent's spell too once the talent
--- gave you its first rank.
function ns.FromTrainer(a, known, talentsOf)
	talentsOf = talentsOf or ns.TalentNames(P.class or "")
	return not talentsOf[a.name] or (known[spellKey(a)] or 0) > 0
end

--- Trainer spells you can learn at a level and do not know: the highest rank of each, since a trainer sells any rank
--- you are level for.
function ns.ToTrain(level)
	local list = ns.abilities and ns.abilities[P.class or ""] or {}
	local talentsOf = ns.TalentNames(P.class or "")
	local known, best = ns.KnownRanks(), {}
	local candidates = {}
	for _, a in ipairs(list) do
		local key, r = spellKey(a), ns.RankNumber(a.rank)
		if a.level <= (level or P.level) and ns.FromTrainer(a, known, talentsOf) and ns.Learnable(a) and not ns.Knows(a.id) and r > (known[key] or 0) then
			candidates[#candidates + 1] = a
			if r > (best[key] or 0) then
				best[key] = r
			end
		end
	end
	local out = {}
	for _, a in ipairs(candidates) do
		if ns.RankNumber(a.rank) == best[spellKey(a)] then
			out[#out + 1] = a
		end
	end
	return out
end

--- The next level with new trainer spells, and those spells.
function ns.NextSpells(level)
	local list = ns.abilities and ns.abilities[P.class or ""] or {}
	local talentsOf = ns.TalentNames(P.class or "")
	local known = ns.KnownRanks()
	local at, out = nil, {}
	for _, a in ipairs(list) do
		if a.level > level and ns.FromTrainer(a, known, talentsOf) and ns.Learnable(a) then
			if not at then
				at = a.level
			end
			if a.level == at then
				out[#out + 1] = a
			end
		end
	end
	return at, out
end

ns.On("PLAYER_LEVEL_UP", function(level)
	if type(level) == "number" and not (issecretvalue and issecretvalue(level)) then
		P.level = level
	end
end)
