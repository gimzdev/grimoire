-- Talent builds of your own, kept for your whole account by class, and the site's talent rules and link codes they
-- follow. The rules and codes are src/lib/talents.ts line for line, so a link made in the site's talent calculator gives
-- the same build and point order here, and a build made here opens the same on the site.
local _, ns = ...

local R = {}
ns.TalentRules = R

R.MAX = 51
local ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
local SITE = "https://wowgrimoire.app/talents/"
local NAME_MAX = 40

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

--- A class's trees, talents sorted by (row, col) as the site sorts them (the data is written that way).
local function treesOf(cls)
	local data = ns.talents and ns.talents[cls]
	return data and data.trees or {}
end
R.Trees = treesOf

local function copy(t)
	local out = {}
	for k, v in pairs(t) do
		out[k] = v
	end
	return out
end

-- Rules ---------------------------------------------------------------------------------------------------------

function R.TreePoints(tree, ranks)
	local n = 0
	for _, t in ipairs(tree.talents) do
		n = n + (ranks[t.id] or 0)
	end
	return n
end

function R.Total(cls, ranks)
	local n = 0
	for _, tree in ipairs(treesOf(cls)) do
		n = n + R.TreePoints(tree, ranks)
	end
	return n
end

--- Points in the rows above row (row is counted from 0, as in the data): what opens a row, 5 a row.
function R.PointsAbove(tree, ranks, row)
	local n = 0
	for _, t in ipairs(tree.talents) do
		if t.row < row then
			n = n + (ranks[t.id] or 0)
		end
	end
	return n
end

--- Why a point cannot go into a talent now: "max", "points", "tier" or "prereq"; nil when it can.
function R.Block(cls, ranks, id, maxPoints)
	local info = ns.Talent(cls, id)
	if not info then
		return "max"
	end
	local t = info.talent
	if (ranks[id] or 0) >= t.max then
		return "max"
	end
	if R.Total(cls, ranks) >= (maxPoints or R.MAX) then
		return "points"
	end
	if R.PointsAbove(treesOf(cls)[info.tree], ranks, t.row) < t.row * 5 then
		return "tier"
	end
	if t.req and (ranks[t.req.id] or 0) < t.req.qty then
		return "prereq"
	end
	return nil
end

--- A talent's row is open and its prerequisite met (the 51-point cap aside).
function R.Reachable(cls, ranks, id)
	local b = R.Block(cls, ranks, id, math.huge)
	return b == nil or b == "max"
end

--- A point can come out of this talent without leaving a talent that needs it, or a deeper row, short.
function R.CanRemove(cls, ranks, id)
	local info = ns.Talent(cls, id)
	if not info then
		return false
	end
	local rank = ranks[id] or 0
	if rank <= 0 then
		return false
	end
	local after = copy(ranks)
	after[id] = rank - 1
	local tree = treesOf(cls)[info.tree]
	for _, t in ipairs(tree.talents) do
		if (after[t.id] or 0) > 0 and t.req and t.req.id == id and (after[id] or 0) < t.req.qty then
			return false
		end
	end
	for _, t in ipairs(tree.talents) do
		if (after[t.id] or 0) > 0 and t.row > 0 and R.PointsAbove(tree, after, t.row) < t.row * 5 then
			return false
		end
	end
	return true
end

--- Replays a point order; points that are not legal at their turn drop out. Returns the ranks and the order kept.
function R.Replay(cls, order)
	local ranks, kept = {}, {}
	for _, id in ipairs(order or {}) do
		if R.Block(cls, ranks, id) == nil then
			ranks[id] = (ranks[id] or 0) + 1
			kept[#kept + 1] = id
		end
	end
	return ranks, kept
end

--- The order without its point at index, replayed. A later point that loses its footing goes back in at the end as soon
--- as it is legal again, so the ranks and the order always tell the same build.
function R.Without(cls, order, index)
	local rest = {}
	for j, id in ipairs(order) do
		if j ~= index then
			rest[#rest + 1] = id
		end
	end
	local ranks, kept = R.Replay(cls, rest)
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
			if R.Block(cls, ranks, id) == nil then
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

--- Rebuilds a rank map point by point, tree by tree in row order, so the result always obeys the rules.
function R.Legalize(cls, wanted, maxPoints)
	local out = {}
	for _, tree in ipairs(treesOf(cls)) do
		local progress = true
		while progress do
			progress = false
			for _, t in ipairs(tree.talents) do
				while (out[t.id] or 0) < (wanted[t.id] or 0) and R.Block(cls, out, t.id, maxPoints) == nil do
					out[t.id] = (out[t.id] or 0) + 1
					progress = true
				end
			end
		end
	end
	return out
end

--- A legal order for a rank map when none was recorded: a point at a time, tree by tree, top to bottom.
function R.DefaultOrder(cls, ranks)
	local order, cur = {}, {}
	local progress = true
	while progress do
		progress = false
		for _, tree in ipairs(treesOf(cls)) do
			for _, t in ipairs(tree.talents) do
				if (cur[t.id] or 0) < (ranks[t.id] or 0) and R.Block(cls, cur, t.id) == nil then
					cur[t.id] = (cur[t.id] or 0) + 1
					order[#order + 1] = t.id
					progress = true
				end
			end
		end
	end
	return order
end

--- Points per tree: { a, b, c }.
function R.Split(cls, ranks)
	local out = {}
	for i, tree in ipairs(treesOf(cls)) do
		out[i] = R.TreePoints(tree, ranks)
	end
	return out
end

local function sameRanks(a, b)
	for k, v in pairs(a) do
		if b[k] ~= v then
			return false
		end
	end
	for k, v in pairs(b) do
		if a[k] ~= v then
			return false
		end
	end
	return true
end

-- Codes ---------------------------------------------------------------------------------------------------------

local lists = {}

--- Every talent of a class in code order: tree by tree, each by (row, col).
local function allTalents(cls)
	local l = lists[cls]
	if not l then
		l = { list = {}, index = {} }
		for _, tree in ipairs(treesOf(cls)) do
			for _, t in ipairs(tree.talents) do
				l.list[#l.list + 1] = t
				l.index[t.id] = #l.list - 1
			end
		end
		lists[cls] = l
	end
	return l
end

--- One digit per talent (its rank), tree by tree, trailing zeros cut, trees joined by "-".
function R.EncodeBuild(cls, ranks)
	local parts = {}
	for i, tree in ipairs(treesOf(cls)) do
		local digits = {}
		for j, t in ipairs(tree.talents) do
			digits[j] = math.min(9, ranks[t.id] or 0)
		end
		parts[i] = (table.concat(digits):gsub("0+$", ""))
	end
	return (table.concat(parts, "-"):gsub("%-+$", ""))
end

--- "a-b" into { "a", "b" }, empty parts kept (JavaScript's split).
local function split(s, sep)
	local out, start = {}, 1
	while true do
		local i = s:find(sep, start, true)
		if not i then
			out[#out + 1] = s:sub(start)
			return out
		end
		out[#out + 1] = s:sub(start, i - 1)
		start = i + 1
	end
end

--- A build code into ranks: ranks above a talent's maximum are cut to it, then the whole is put through the rules.
function R.DecodeBuild(cls, code)
	if type(code) ~= "string" or code == "" then
		return {}
	end
	local digitsOnly = code:gsub("[^0-9%-]", "")
	local parts = split(digitsOnly, "-")
	local ranks = {}
	for i, tree in ipairs(treesOf(cls)) do
		local digits = parts[i] or ""
		for j, t in ipairs(tree.talents) do
			local v = tonumber(digits:sub(j, j)) or 0
			if v > 0 then
				ranks[t.id] = math.min(v, t.max)
			end
		end
	end
	return R.Legalize(cls, ranks)
end

--- One letter per point: the talent's place in the class's list.
function R.EncodeOrder(cls, order)
	local index = allTalents(cls).index
	local out = {}
	for i, id in ipairs(order) do
		local k = index[id] or 0
		out[i] = ALPHABET:sub(k + 1, k + 1)
	end
	return table.concat(out)
end

function R.DecodeOrder(cls, code)
	local out = {}
	if type(code) ~= "string" then
		return out
	end
	local list = allTalents(cls).list
	for ch in code:gmatch(".") do
		local p = ALPHABET:find(ch, 1, true)
		if p and p <= #list then
			out[#out + 1] = list[p].id
		end
	end
	return out
end

--- The version of the trees' code order the site's links are written in (v in a link), as src/lib/talents.ts has it.
R.CODE_VERSION = 2

--- A link's codes read in the code order of the version they were written in (a link without v is from before
--- versions) and written again for today's trees, as the site's upgradeCodes does: the data keeps a class's old order
--- (layouts) when its trees moved since. Talents that left the trees lose their points. Codes of today's version, or of
--- a class whose trees have not moved, come back as they are.
function R.UpgradeCodes(cls, version, code, orderCode)
	local v = math.max(1, math.floor(tonumber(version) or 1))
	local layouts = ns.talents and ns.talents[cls] and ns.talents[cls].layouts
	if v >= R.CODE_VERSION or type(layouts) ~= "table" then
		return code, orderCode
	end
	-- the order of version v is the one kept for the first version at or after it
	local kept
	for k in pairs(layouts) do
		local n = tonumber(k)
		if n and n >= v and (not kept or n < kept) then
			kept = n
		end
	end
	local old = kept and (layouts[kept] or layouts[tostring(kept)])
	if type(old) ~= "table" then
		return code, orderCode
	end
	local byName = {}
	for _, tree in ipairs(treesOf(cls)) do
		for _, t in ipairs(tree.talents) do
			byName[t.name] = t.id
		end
	end
	if type(code) == "string" and code ~= "" then
		local parts = split((code:gsub("[^0-9%-]", "")), "-")
		local ranks = {}
		for i, names in ipairs(old) do
			local digits = parts[i] or ""
			for j, name in ipairs(names) do
				local n = tonumber(digits:sub(j, j)) or 0
				local id = byName[name]
				if n > 0 and id then
					ranks[id] = n
				end
			end
		end
		code = R.EncodeBuild(cls, ranks)
	end
	if type(orderCode) == "string" and orderCode ~= "" then
		local flat = {}
		for _, names in ipairs(old) do
			for _, name in ipairs(names) do
				flat[#flat + 1] = name
			end
		end
		local ids = {}
		for ch in orderCode:gmatch(".") do
			local p = ALPHABET:find(ch, 1, true)
			local id = p and byName[flat[p] or ""]
			if id then
				ids[#ids + 1] = id
			end
		end
		orderCode = R.EncodeOrder(cls, ids)
	end
	return code, orderCode
end

--- A build and point order from their codes, as the site's calculator opens a link: the order as replayed when it
--- makes the build, otherwise a fresh legal one. Returns the order and the ranks.
function R.FromCodes(cls, code, orderCode)
	local ranks = R.DecodeBuild(cls, code)
	local replayed, order = R.Replay(cls, R.DecodeOrder(cls, orderCode))
	if not sameRanks(ranks, replayed) then
		order = R.DefaultOrder(cls, ranks)
	end
	return order, ranks
end

--- The site's link to a build: its calculator with the build and its point order.
function R.Link(cls, order)
	local ranks = R.Replay(cls, order)
	local code = R.EncodeBuild(cls, ranks)
	local o = R.EncodeOrder(cls, order)
	return SITE .. cls .. "?b=" .. code .. (#order > 0 and ("&o=" .. o) or "") .. "&v=" .. R.CODE_VERSION
end

local function unescape(s)
	return (s:gsub("%+", " "):gsub("%%(%x%x)", function(h)
		return string.char(tonumber(h, 16))
	end))
end

local function param(text, key)
	local v = text:match("[?&]" .. key .. "=([^&#%s]*)")
	return v and unescape(v) or nil
end

local function className(cls)
	local c = ns.classes and ns.classes[cls]
	return c and c.name or cls
end

--- Whether a bare code fits a class's trees: no more trees or talents than it has, no rank above a maximum, and every
--- point legal. A code made for another class rarely passes. A code with no points fits (and makes no build).
local function fits(cls, code)
	local parts = split(code, "-")
	local trees = treesOf(cls)
	if #parts > #trees then
		return false
	end
	local wanted, total = {}, 0
	for i, digits in ipairs(parts) do
		local tree = trees[i]
		if #digits > #tree.talents then
			return false
		end
		for j = 1, #digits do
			local v = tonumber(digits:sub(j, j)) or 0
			local t = tree.talents[j]
			if v > t.max then
				return false
			end
			if v > 0 then
				wanted[t.id] = v
				total = total + v
			end
		end
	end
	return R.Total(cls, R.Legalize(cls, wanted)) == total
end

--- A build from what a player pastes, for the class on screen: a link to the site's talent calculator, the calculator's
--- "Copy build" text ("Mage 41/0/10 0551...") or a bare build code. Returns the point order and ranks, or nil and a
--- line saying what is wrong.
function R.Parse(text, cls)
	if type(text) ~= "string" or not text:find("%S") then
		return nil, "Paste a link first."
	end
	-- trimmed, with the "&amp;" a link copied out of a web page or chat can carry
	text = text:gsub("^%s+", ""):gsub("%s+$", ""):gsub("&amp;", "&")
	local slug = text:match("/talents/(%a+)")
	local code, orderCode, strict, version
	if slug then
		slug = slug:lower()
		code, orderCode, version = param(text, "b"), param(text, "o"), param(text, "v")
	elseif text:find("[?&][bo]=") then
		code, orderCode, strict, version = param(text, "b"), param(text, "o"), true, param(text, "v")
	else
		-- "Mage 41/0/10 0551205223102301531--230032", or the code alone
		local first = text:match("^(%a+)")
		for other, c in pairs(ns.classes or {}) do
			if first and c.name:lower() == first:lower() then
				slug = other
			end
		end
		code = text:match("%s([%d%-]+)$") or text:match("^([%d%-]+)$")
		strict = true
		if not code or not code:find("%d") or (not slug and not text:match("^[%d%-]+$")) then
			return nil, "That is not a talent link from wowgrimoire.app."
		end
	end
	if slug and not (ns.talents and ns.talents[slug]) then
		return nil, "That link is not for a class Grimoire knows."
	end
	if slug and slug ~= cls then
		local name = className(slug)
		return nil, "That is a " .. name .. " build: choose " .. name .. " above, then paste it again."
	end
	-- a link (it has b= or o=) from before the trees last moved is read in its own code order; a bare code is today's
	if version or text:find("[?&][bo]=") then
		code, orderCode = R.UpgradeCodes(cls, version, code, orderCode)
	end
	if strict and code then
		local digits = code:gsub("[^0-9%-]", "")
		if not fits(cls, digits) then
			return nil, "That code does not fit the " .. className(cls) .. " talent trees."
		end
	end
	local order, ranks = R.FromCodes(cls, code or "", orderCode or "")
	if #order == 0 then
		return nil, "There is no talent build in that link."
	end
	return order, ranks
end

-- Grimoire's builds in groups ------------------------------------------------------------------------------------

-- A build's kind comes from the data (data/builds.json): leveling, raid, tank, heal, dungeon or pvp. The Talents page
-- shows them in the three groups players use: Leveling, PvE (raid, tank, heal and dungeon builds; a kind not known here
-- too) and PvP. pick marks the build listed first in its group for a class; it is not shown as a label.
local GROUPS = {
	{ "leveling", "Leveling" },
	{ "pve", "PvE" },
	{ "pvp", "PvP" },
}
local GROUP_LABEL = {}
for _, g in ipairs(GROUPS) do
	GROUP_LABEL[g[1]] = g[2]
end
local ROLE = { raid = "DPS", tank = "Tank", heal = "Healer", dungeon = "Dungeons" }

--- The group a build's kind is shown in: "leveling", "pve" or "pvp".
function ns.BuildGroupOf(kind)
	if kind == "leveling" or kind == "pvp" then
		return kind
	end
	return "pve"
end

--- A build's kind in words: "Leveling", "PvP", or PvE with its role ("PvE DPS", "PvE tank", "PvE healer").
function ns.BuildKindLabel(kind)
	local group = ns.BuildGroupOf(kind)
	local role = ROLE[kind]
	if group == "pve" and role then
		return "PvE " .. (role == "DPS" and role or role:lower())
	end
	return GROUP_LABEL[group]
end

--- A PvE build's role: "DPS", "Tank", "Healer" or "Dungeons"; nil for leveling and PvP builds and unknown kinds.
function ns.BuildRole(kind)
	return ROLE[kind]
end

--- The role to show beside a Grimoire build's name: its PvE role, unless the name already says it ("Holy healer").
function ns.BuildRoleTag(b)
	local role = type(b) == "table" and not b.custom and ROLE[b.kind]
	if not role then
		return nil
	end
	if type(b.name) == "string" and b.name:lower():find(role:lower(), 1, true) then
		return nil
	end
	return role
end

--- A build's name where no group heading says what it is for: Grimoire's builds are named after their spec, so this adds
--- the group ("Arms leveling", "Holy PvE", "Combat daggers PvE", "Arms PvP"); your own builds keep the name you gave them.
function ns.BuildTitle(b)
	if type(b) ~= "table" then
		return ""
	end
	local name = type(b.name) == "string" and b.name or ""
	if b.custom then
		return name
	end
	local group = ns.BuildGroupOf(b.kind)
	return name .. " " .. (group == "leveling" and "leveling" or GROUP_LABEL[group])
end

--- Grimoire's builds for a class in their groups, Leveling, PvE and PvP: { { key, label, builds }, ... }, leaving out a
--- group with no build. In each group the pick comes first, the others in the data's order.
function ns.BuildGroups(cls)
	local byKey = {}
	local list = ns.builds and ns.builds[cls]
	for _, b in ipairs(type(list) == "table" and list or {}) do
		local key = ns.BuildGroupOf(b.kind)
		byKey[key] = byKey[key] or {}
		local g = byKey[key]
		g[#g + 1] = b
	end
	local groups = {}
	for _, g in ipairs(GROUPS) do
		local builds = byKey[g[1]]
		if builds then
			-- the pick first, the others as they were
			local sorted, rest = {}, {}
			for _, b in ipairs(builds) do
				if b.pick and #sorted == 0 then
					sorted[1] = b
				else
					rest[#rest + 1] = b
				end
			end
			for _, b in ipairs(rest) do
				sorted[#sorted + 1] = b
			end
			groups[#groups + 1] = { key = g[1], label = g[2], builds = sorted }
		end
	end
	return groups
end

--- The build best for leveling a class: the one marked as the pick, else the first leveling build; nil when the data
--- has no leveling build for the class.
function ns.LevelingPick(cls)
	local first
	for _, b in ipairs(ns.builds and type(ns.builds[cls]) == "table" and ns.builds[cls] or {}) do
		if b.kind == "leveling" then
			if b.pick then
				return b
			end
			first = first or b
		end
	end
	return first
end

--- Whether a build is its class's pick for leveling.
function ns.IsLevelingPick(b)
	return type(b) == "table" and b.pick == true and b.kind == "leveling"
end

-- Your builds ---------------------------------------------------------------------------------------------------

-- GrimoireForeverDB.customBuilds = { [class] = { { id = "custom-3", name = "Frost leveling", order = { talent id, ... },
-- from = "talents" | "link" | "planner" | "grimoire", base = Grimoire build id, who = character name }, ... } }, in the
-- order they were made. The order is kept as talent ids, which stay put when the data around them changes.

local cache = { db = nil, byClass = {} }

local function records(cls)
	local s = ns.db and ns.db.customBuilds
	local list = type(s) == "table" and s[cls]
	return type(list) == "table" and list or nil
end

local function store(cls)
	if type(ns.db.customBuilds) ~= "table" then
		ns.db.customBuilds = {}
	end
	if type(ns.db.customBuilds[cls]) ~= "table" then
		ns.db.customBuilds[cls] = {}
	end
	return ns.db.customBuilds[cls]
end

local function forget()
	cache.byClass = {}
end

local function origin(rec, cls)
	if rec.from == "talents" then
		return type(rec.who) == "string" and plain(rec.who) and rec.who ~= "" and ("Made from " .. rec.who .. "'s talents") or "Made from your talents"
	elseif rec.from == "link" then
		return "Made from a wowgrimoire.app link"
	elseif rec.from == "grimoire" then
		local base = ns.builds and ns.builds[cls]
		for _, b in ipairs(base or {}) do
			if b.id == rec.base then
				return "Planned in game from Grimoire's " .. ns.BuildTitle(b) .. " build"
			end
		end
	end
	return "Planned in game"
end

--- The tree with the most points, or nil with none.
local function topTree(points)
	local best, at
	for i, n in ipairs(points) do
		if n > 0 and (not best or n > best) then
			best, at = n, i
		end
	end
	return at
end

--- A saved build as the rest of the add-on sees one (the shape of Grimoire's builds, with custom = true).
local function runtime(cls, rec)
	local wanted = {}
	for _, id in ipairs(type(rec.order) == "table" and rec.order or {}) do
		if type(id) == "number" then
			wanted[#wanted + 1] = id
		end
	end
	local ranks, order = R.Replay(cls, wanted)
	local points = R.Split(cls, ranks)
	local top = topTree(points)
	local specs = ns.classes and ns.classes[cls] and ns.classes[cls].specs or {}
	local n = #order
	local summary = origin(rec, cls) .. (n == R.MAX and ", all 51 points." or n == 0 and ", no points yet." or (", " .. n .. " of 51 points."))
	return {
		id = rec.id,
		name = (type(rec.name) == "string" and rec.name ~= "") and rec.name or "Untitled build",
		cls = cls,
		custom = true,
		spec = top and specs[top] and specs[top].slug or nil,
		kind = "custom",
		summary = summary,
		notes = {},
		points = points,
		order = order,
		from = rec.from,
		base = rec.base,
	}
end

--- Your builds for a class, in the order you made them.
function ns.CustomBuilds(cls)
	if cache.db ~= ns.db then
		cache.db = ns.db
		forget()
	end
	local list = cache.byClass[cls]
	if not list then
		list = {}
		for _, rec in ipairs(records(cls) or {}) do
			if type(rec) == "table" and type(rec.id) == "string" then
				list[#list + 1] = runtime(cls, rec)
			end
		end
		cache.byClass[cls] = list
	end
	return list
end

--- One of your builds by id: the build, its class and its saved record.
function ns.FindCustomBuild(id)
	if type(id) ~= "string" or not (ns.db and type(ns.db.customBuilds) == "table") then
		return nil
	end
	for cls, list in pairs(ns.db.customBuilds) do
		if type(list) == "table" then
			for _, rec in ipairs(list) do
				if type(rec) == "table" and rec.id == id then
					for _, b in ipairs(ns.CustomBuilds(cls)) do
						if b.id == id then
							return b, cls, rec
						end
					end
				end
			end
		end
	end
	return nil
end

local function cleanName(name)
	if type(name) ~= "string" then
		return ""
	end
	name = name:gsub("[\r\n\t]", " "):gsub("|", "/"):gsub("^%s+", ""):gsub("%s+$", "")
	-- at most NAME_MAX letters, cut on a whole character
	local n, cut = 0, #name
	for pos in name:gmatch("()[%z\1-\127\194-\244][\128-\191]*") do
		n = n + 1
		if n > NAME_MAX then
			cut = pos - 1
			break
		end
	end
	return name:sub(1, cut)
end
ns.CleanBuildName = cleanName

--- A name no other build of yours for the class has: name, name 2, name 3...
function ns.UniqueBuildName(cls, name, except)
	local taken = {}
	for _, b in ipairs(ns.CustomBuilds(cls)) do
		if b.id ~= except then
			taken[b.name:lower()] = true
		end
	end
	local base, n, out = name, 1, name
	while taken[out:lower()] do
		n = n + 1
		out = base .. " " .. n
	end
	return out
end

--- A name from the points: "Frost 16/0/35".
function ns.AutoBuildName(cls, ranks)
	local points = R.Split(cls, ranks or {})
	local top = topTree(points)
	if not top then
		return "New build"
	end
	return treesOf(cls)[top].name .. " " .. table.concat(points, "/")
end

--- Saves a new build of yours: info = { from, base, who }. Returns the build.
function ns.SaveBuild(cls, order, name, info)
	if not (ns.db and ns.talents and ns.talents[cls]) then
		return nil
	end
	local _, kept = R.Replay(cls, order)
	name = cleanName(name)
	if name == "" then
		name = ns.AutoBuildName(cls, R.Replay(cls, kept))
	end
	local seq = (tonumber(ns.db.customBuildSeq) or 0) + 1
	while ns.FindCustomBuild("custom-" .. seq) do
		seq = seq + 1
	end
	ns.db.customBuildSeq = seq
	info = info or {}
	local rec = { id = "custom-" .. seq, name = ns.UniqueBuildName(cls, name), order = kept, from = info.from or "planner", base = info.base, who = info.who }
	local list = store(cls)
	list[#list + 1] = rec
	forget()
	ns.Send("BUILD")
	return (ns.FindCustomBuild(rec.id))
end

--- Saves a new point order (and a name, when one is given) into a build of yours. Returns the build.
function ns.UpdateBuild(id, order, name)
	local _, cls, rec = ns.FindCustomBuild(id)
	if not rec then
		return nil
	end
	local _, kept = R.Replay(cls, order)
	rec.order = kept
	name = cleanName(name)
	if name ~= "" then
		rec.name = name
	end
	forget()
	ns.Send("BUILD")
	return (ns.FindCustomBuild(id))
end

--- Renames a build of yours; an empty name changes nothing. Returns true when it was renamed.
function ns.RenameBuild(id, name)
	local _, _, rec = ns.FindCustomBuild(id)
	name = cleanName(name)
	if not rec or name == "" then
		return false
	end
	rec.name = name
	forget()
	ns.Send("BUILD")
	return true
end

--- Deletes a build of yours. A character following it stops following it.
function ns.DeleteBuild(id)
	local _, cls = ns.FindCustomBuild(id)
	local list = cls and records(cls)
	if not list then
		return false
	end
	for i = #list, 1, -1 do
		if type(list[i]) == "table" and list[i].id == id then
			table.remove(list, i)
		end
	end
	forget()
	if ns.char and ns.char.build == id then
		ns.char.build = nil
		ns.char.hinted = true
	end
	ns.Send("BUILD")
	return true
end

--- A new build from the talents this character has spent: their ranks in a legal order. Returns the build and how many
--- spent points did not fit the trees; or nil and a line saying why not.
function ns.BuildFromTalents()
	local P = ns.player
	local cls = P.class
	if not cls then
		return nil, "Grimoire does not know your class yet."
	end
	ns.ForgetTalents()
	local ranks, spent = ns.ReadTalents()
	if not ranks then
		return nil, "Grimoire cannot read your talents on this client."
	end
	if (spent or 0) == 0 then
		return nil, "You have not spent a talent point yet."
	end
	local order = R.DefaultOrder(cls, ranks)
	if #order == 0 then
		return nil, "None of your talent points fit Grimoire's trees."
	end
	local who = plain(P.name) and P.name or nil
	local b = ns.SaveBuild(cls, order, who and (who .. "'s talents") or "My talents", { from = "talents", who = who })
	return b, math.max(0, spent - #order)
end

--- A new build from a link or code pasted for a class. Returns the build, or nil and a line saying what is wrong.
function ns.BuildFromLink(text, cls)
	local order, ranks = R.Parse(text, cls)
	if not order then
		return nil, ranks
	end
	return ns.SaveBuild(cls, order, ns.AutoBuildName(cls, ranks), { from = "link" })
end

--- The site's link to any build.
function ns.BuildLink(cls, order)
	return R.Link(cls, order or {})
end
