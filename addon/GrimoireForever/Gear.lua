-- Gear: how much an item adds for your build over what you wear, the best quest reward to take, and the best upgrade
-- near your level for each slot. Scores weigh an item's stats (Data/Items*.lua, or the game's for an item with a random
-- enchantment or one the data does not know) by your spec: the build you follow, else the tree with most points, else
-- the spec most people level with.
local _, ns = ...

local Gear = {}
ns.Gear = Gear

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

-- Weights: what one point of each stat is worth (keys as in Data/Items*.lua; d is main-hand weapon damage per second,
-- off and rng the same for the off hand and the ranged slot).
local function with(base, extra)
	local t = {}
	for k, v in pairs(base) do
		t[k] = v
	end
	for k, v in pairs(extra or {}) do
		t[k] = v
	end
	return t
end

local STR = { s = 1, a = 0.65, t = 0.3, r = 0.02, ap = 0.5, cr = 14, ht = 14, wk = 2, pr = 5, d = 3.2, off = 1.6, rng = 0.3 }
local AGI = { s = 0.55, a = 1, t = 0.3, r = 0.02, ap = 0.5, cr = 14, ht = 16, wk = 2, pr = 5, d = 3.2, off = 1.6, rng = 0.3 }
local CAT = { s = 1, a = 0.85, t = 0.35, r = 0.03, ap = 0.5, fa = 0.5, cr = 14, ht = 12 }
local BEAR = { t = 1, r = 0.12, a = 0.7, s = 0.45, de = 1.2, dg = 14, fa = 0.25, ap = 0.25, ht = 8, cr = 6, h5 = 0.3 }
local HUNTER = { a = 1, i = 0.3, t = 0.3, s = 0.05, p = 0.05, r = 0.02, ap = 0.4, ra = 0.4, cr = 14, ht = 14, wk = 1, pr = 2, d = 0.4, off = 0.2, rng = 3 }
local TANK = { t = 1, r = 0.07, a = 0.55, s = 0.45, de = 1.2, dg = 14, pa = 12, bk = 6, b = 0.4, ap = 0.15, ht = 8, cr = 4, wk = 1, h5 = 0.3, d = 1, off = 0.5, rng = 0.2 }
local CASTER = { sp = 1, i = 0.45, p = 0.15, t = 0.25, r = 0.01, sc = 10, sh = 12, m5 = 0.9, pe = 0.3, rng = 1.6 }
local HEALER = { hl = 1, sp = 1, i = 0.6, p = 0.45, t = 0.2, r = 0.01, m5 = 1.6, sc = 7, rng = 0.8 }

local PROFILES = {
	warrior = { arms = with(STR, { off = 0 }), fury = STR, protection = TANK },
	paladin = {
		holy = with(HEALER, { p = 0.1, sc = 10, i = 0.75 }),
		protection = with(TANK, { sp = 0.35, dh = 0.35, i = 0.25 }),
		retribution = with(STR, { i = 0.15, sp = 0.2, dh = 0.2, off = 0 }),
	},
	hunter = {
		["beast-mastery"] = HUNTER,
		marksmanship = HUNTER,
		survival = with(HUNTER, { s = 0.3, i = 0.2, ra = 0.15, wk = 1.5, pr = 4, d = 2.8, off = 1, rng = 1 }),
	},
	rogue = { assassination = AGI, combat = AGI, subtlety = AGI },
	priest = {
		discipline = with(HEALER, { p = 0.55 }),
		holy = with(HEALER, { p = 0.55 }),
		shadow = with(CASTER, { ds = 1, p = 0.3, i = 0.35 }),
	},
	shaman = {
		elemental = with(CASTER, { dn = 1, di = 0.6 }),
		enhancement = with(STR, { a = 0.7, i = 0.15, sp = 0.1 }),
		restoration = with(HEALER, { p = 0.2, m5 = 1.8 }),
	},
	mage = {
		arcane = with(CASTER, { da = 1, di = 0.3, df = 0.3 }),
		fire = with(CASTER, { di = 1, da = 0.2 }),
		frost = with(CASTER, { df = 1, da = 0.2 }),
	},
	warlock = {
		affliction = with(CASTER, { ds = 1, di = 0.25, t = 0.4 }),
		demonology = with(CASTER, { ds = 1, di = 0.6, t = 0.45 }),
		destruction = with(CASTER, { ds = 0.7, di = 1, t = 0.35 }),
	},
	druid = { balance = with(CASTER, { dn = 1, da = 1 }), ["feral-combat"] = CAT, restoration = with(HEALER, { p = 0.5 }) },
}
-- The spec most characters level with, for a character with no build and no talents yet.
local LEVELING = { warrior = "arms", paladin = "retribution", hunter = "beast-mastery", rogue = "combat", priest = "shadow", shaman = "enhancement", mage = "frost", warlock = "affliction", druid = "feral-combat" }

local profile -- { weights, name }: worked out again when the build, talents or level change
local equipped = {} -- slot -> { link, score, twoHand }
local function forget()
	profile = nil
	wipe(equipped)
end
Gear.Forget = forget

--- Your class, spec slug and, for a build you follow, its kind ("tank" for a bear).
function Gear.Spec()
	local cls = ns.player.class
	if not cls then
		return nil
	end
	local b = ns.SelectedBuild and ns.SelectedBuild()
	local spec, kind = b and b.spec, b and b.kind
	if not spec and ns.ReadTalents and ns.TalentRules then
		local ranks = ns.ReadTalents()
		if ranks then
			local best, at = 0, nil
			for i, n in ipairs(ns.TalentRules.Split(cls, ranks)) do
				if n > best then
					best, at = n, i
				end
			end
			local specs = ns.classes and ns.classes[cls] and ns.classes[cls].specs
			spec = at and specs and specs[at] and specs[at].slug
		end
	end
	return cls, spec or LEVELING[cls], kind
end

--- The weights for your spec and the spec's name ("Fury", "Feral Combat (tank)").
function Gear.Weights()
	if profile then
		return profile.weights, profile.name
	end
	local cls, spec, kind = Gear.Spec()
	local byClass = cls and PROFILES[cls]
	if not byClass then
		return nil
	end
	local weights = byClass[spec] or byClass[LEVELING[cls]]
	local name = spec
	for _, s in ipairs(ns.classes and ns.classes[cls] and ns.classes[cls].specs or {}) do
		if s.slug == spec then
			name = s.name
		end
	end
	if cls == "druid" and spec == "feral-combat" and kind == "tank" then
		weights, name = BEAR, name .. " (tank)"
	end
	profile = { weights = weights, name = name }
	return weights, name
end

-- Stats ------------------------------------------------------------------------------------------------------------

local parsed = {}
local function parse(s)
	local t = {}
	for k, v in (s or ""):gmatch("(%a+)(%-?[%d%.]+)") do
		t[k] = (t[k] or 0) + (tonumber(v) or 0)
	end
	return t
end

-- The game's names for the stats GetItemStats gives, for an item the data does not know or one with a random
-- enchantment (its own stats come from the game, the rest from the data).
local MOD = {
	ITEM_MOD_STRENGTH_SHORT = "s",
	ITEM_MOD_AGILITY_SHORT = "a",
	ITEM_MOD_STAMINA_SHORT = "t",
	ITEM_MOD_INTELLECT_SHORT = "i",
	ITEM_MOD_SPIRIT_SHORT = "p",
	RESISTANCE0_NAME = "r",
	ITEM_MOD_DAMAGE_PER_SECOND_SHORT = "d",
	ITEM_MOD_ATTACK_POWER_SHORT = "ap",
	ITEM_MOD_RANGED_ATTACK_POWER_SHORT = "ra",
	ITEM_MOD_SPELL_POWER_SHORT = "sp",
	ITEM_MOD_SPELL_DAMAGE_DONE_SHORT = "sp",
	ITEM_MOD_SPELL_HEALING_DONE_SHORT = "hl",
	ITEM_MOD_MANA_REGENERATION_SHORT = "m5",
	ITEM_MOD_HEALTH_REGEN_SHORT = "h5",
	ITEM_MOD_BLOCK_VALUE_SHORT = "b",
}
local OWN = { s = true, a = true, t = true, i = true, p = true, r = true, d = true, v = true }

local getStats = (C_Item and C_Item.GetItemStats) or GetItemStats
local function linkStats(link)
	if not getStats then
		return nil
	end
	local ok, raw = pcall(getStats, link)
	if not ok or type(raw) ~= "table" then
		return nil
	end
	local t, any = {}, false
	for name, v in pairs(raw) do
		local k = MOD[name]
		if k and plain(v) and type(v) == "number" then
			t[k] = (t[k] or 0) + v
			any = true
		end
	end
	return any and t or nil
end

local function idOf(item)
	if type(item) == "number" then
		return item
	end
	return type(item) == "string" and tonumber(item:match("item:(%d+)")) or nil
end

--- An item's stats and its data row: from the data, or the game's for a random enchantment or an item it lacks.
function Gear.Stats(item)
	local id = idOf(item)
	if not id then
		return nil
	end
	local it = ns.items and ns.items[id]
	local base
	if it then
		base = parsed[id]
		if not base then
			base = parse(it[13])
			parsed[id] = base
		end
	end
	if type(item) == "string" then
		-- item:id:enchant:gem1:gem2:gem3:gem4:suffix:...
		local suffix = tonumber(item:match("item:%d+:[^:]*:[^:]*:[^:]*:[^:]*:[^:]*:(%-?%d+)") or "") or 0
		if suffix ~= 0 or not base then
			local own = linkStats(item)
			if own then
				for k, v in pairs(base or {}) do
					if not OWN[k] and own[k] == nil then
						own[k] = v
					end
				end
				return own, it
			end
		end
	end
	return base, it
end

-- What an item weighs for you, in the hand it would go in (main, off or rng for the ranged slot).
local function score(stats, w, hand)
	local sum = 0
	for k, v in pairs(stats) do
		if k == "d" then
			sum = sum + v * ((hand == "off" and w.off) or (hand == "rng" and w.rng) or (hand == "main" and w.d) or 0)
		elseif k ~= "v" then
			sum = sum + v * (w[k] or 0)
		end
	end
	return sum
end
Gear.Score = score

-- Slots ------------------------------------------------------------------------------------------------------------

local INVTYPE = {
	INVTYPE_HEAD = 1, INVTYPE_NECK = 2, INVTYPE_SHOULDER = 3, INVTYPE_CHEST = 5, INVTYPE_WAIST = 6, INVTYPE_LEGS = 7,
	INVTYPE_FEET = 8, INVTYPE_WRIST = 9, INVTYPE_HAND = 10, INVTYPE_FINGER = 11, INVTYPE_TRINKET = 12, INVTYPE_WEAPON = 13,
	INVTYPE_SHIELD = 14, INVTYPE_RANGED = 15, INVTYPE_CLOAK = 16, INVTYPE_2HWEAPON = 17, INVTYPE_ROBE = 20,
	INVTYPE_WEAPONMAINHAND = 21, INVTYPE_WEAPONOFFHAND = 22, INVTYPE_HOLDABLE = 23, INVTYPE_THROWN = 25,
	INVTYPE_RANGEDRIGHT = 26, INVTYPE_RELIC = 28,
}
-- Item slot type -> the equipment slots it goes in.
local SLOTS = {
	[1] = { 1 }, [2] = { 2 }, [3] = { 3 }, [5] = { 5 }, [20] = { 5 }, [6] = { 6 }, [7] = { 7 }, [8] = { 8 }, [9] = { 9 },
	[10] = { 10 }, [11] = { 11, 12 }, [12] = { 13, 14 }, [16] = { 15 }, [13] = { 16, 17 }, [21] = { 16 }, [17] = { 16 },
	[22] = { 17 }, [14] = { 17 }, [23] = { 17 }, [15] = { 18 }, [25] = { 18 }, [26] = { 18 }, [28] = { 18 },
}
local HAND = { [16] = "main", [17] = "off", [18] = "rng" }
local getInstant = (C_Item and C_Item.GetItemInfoInstant) or GetItemInfoInstant
local itemInfo = (C_Item and C_Item.GetItemInfo) or GetItemInfo

local function invType(item, it)
	if it then
		return it[5]
	end
	if getInstant then
		local ok, _, _, _, loc = pcall(getInstant, item)
		return ok and loc and INVTYPE[loc] or nil
	end
end

local function classBit()
	for i, slug in ipairs(ns.classOrder or {}) do
		if slug == ns.player.class then
			return 2 ^ (i - 1)
		end
	end
end

--- Whether you can wear an item at all (your class, your side), and the level you can from: its own, or 40 for plate
--- or mail your class learns then. An item worn with a profession's skill (engineers' goggles, the fishing hat) is not
--- counted: it says nothing about your build.
local function wearable(id, it)
	if not it then
		if C_PlayerInfo and C_PlayerInfo.CanUseItem then
			local ok, can = pcall(C_PlayerInfo.CanUseItem, id)
			return ok and can == true, nil
		end
		return false
	end
	if it[8] == "k" then
		return false
	end
	local bit = classBit()
	if not bit or math.floor(it[9] / bit) % 2 ~= 1 then
		return false
	end
	if it[11] ~= 0 and it[11] ~= (ns.player.faction == "horde" and 2 or 1) then
		return false
	end
	local from = it[4] > (ns.player.level or 1) and it[4] or nil
	if IsPlayerSpell then
		local t = it[6] or ""
		local skill = t:find("Plate", 1, true) and 750 or t:find("Mail", 1, true) and 8737 or nil
		if skill and not IsPlayerSpell(skill) then
			if (ns.player.level or 1) >= 40 then
				return false
			end
			from = math.max(from or 0, 40)
		end
	end
	return true, from
end

local function equippedScore(slot)
	local e = equipped[slot]
	if not e then
		local link = GetInventoryItemLink and GetInventoryItemLink("player", slot)
		e = { score = 0 }
		if plain(link) and link then
			e.link = link
			local stats, it = Gear.Stats(link)
			local w = Gear.Weights()
			e.score = stats and w and score(stats, w, HAND[slot]) or 0
			e.twoHand = slot == 16 and invType(link, it) == 17
		end
		equipped[slot] = e
	end
	return e
end
Gear.Equipped = equippedScore

local function canDualWield()
	return CanDualWield and CanDualWield() == true
end

--- How much an item adds for your build: percent (nil when it adds nothing or you cannot wear it), score added, the
--- level you can wear it from (nil: now), whether it goes in an empty slot, and the slot it goes in.
function Gear.Upgrade(item)
	local w = Gear.Weights()
	if not w then
		return nil
	end
	local stats, it = Gear.Stats(item)
	local id = idOf(item)
	if not stats or not id then
		return nil
	end
	local ok, from = wearable(id, it)
	if not ok then
		return nil
	end
	local inv = invType(item, it)
	local slots = inv and SLOTS[inv]
	if not slots then
		return nil
	end
	-- What you wear already gains nothing.
	if type(item) == "string" then
		for _, s in ipairs(slots) do
			if equippedScore(s).link == item then
				return nil
			end
		end
	end
	local cur, new, empty, slot
	if inv == 17 then
		local mh, oh = equippedScore(16), equippedScore(17)
		cur, new, empty, slot = mh.score + oh.score, score(stats, w, "main"), not mh.link and not oh.link, 16
	elseif inv == 13 or inv == 21 then
		local mh = equippedScore(16)
		cur, new, empty, slot = mh.score, score(stats, w, "main"), not mh.link, 16
		if inv == 13 and not mh.twoHand and canDualWield() then
			local oh = equippedScore(17)
			local off = score(stats, w, "off")
			if off - oh.score > new - cur then
				cur, new, empty, slot = oh.score, off, not oh.link, 17
			end
		end
	elseif inv == 22 or inv == 14 or inv == 23 then
		if equippedScore(16).twoHand or (inv == 22 and not canDualWield()) then
			return nil
		end
		local oh = equippedScore(17)
		cur, new, empty, slot = oh.score, score(stats, w, "off"), not oh.link, 17
	elseif inv == 11 or inv == 12 then
		local a, b = equippedScore(slots[1]), equippedScore(slots[2])
		local weak = (not a.link or (b.link and a.score <= b.score)) and a or b
		cur, new, empty, slot = weak.score, score(stats, w), not weak.link, weak == a and slots[1] or slots[2]
	else
		local e = equippedScore(slots[1])
		cur, new, empty, slot = e.score, score(stats, w, HAND[slots[1]]), not e.link, slots[1]
	end
	local delta = new - cur
	if delta <= 0 or new <= 0 then
		return nil
	end
	local pct = cur > 0 and delta / cur * 100 or nil
	if pct and pct < 1 then
		return nil
	end
	return pct or 0, delta, from, empty or cur <= 0, slot
end

-- In words -----------------------------------------------------------------------------------------------------------

--- Where an item comes from, in a line: for one each side's merchants sell, your side's.
function Gear.Source(it)
	local text = it and it[10] or ""
	local alliance, horde = text:match("^(.-)\n(.*)$")
	if alliance then
		return ns.player.faction == "horde" and horde or alliance
	end
	return text
end

local UP = "|TInterface\\AddOns\\GrimoireForever\\Media\\Arrow:12:12:0:0:128:128:0:128:0:128:156:204:116|t"
Gear.UP = UP

--- An upgrade's size: "12%", or ">100%" past double (over a piece with hardly any stats, the number says little).
function Gear.Percent(pct)
	return pct >= 100 and ">100%" or string.format("%d%%", math.max(1, math.floor(pct + 0.5)))
end

--- "▲ 12% upgrade", "▲ 12% upgrade at 25", "▲ upgrade, empty slot", or nil.
function Gear.Text(item)
	local pct, _, from, empty = Gear.Upgrade(item)
	if not pct then
		return nil
	end
	local text = empty and "upgrade, empty slot" or Gear.Percent(pct) .. " upgrade"
	return UP .. " " .. ns.Hex(ns.HEX.green, text) .. (from and ns.Hex(ns.HEX.mist, " at " .. from) or "")
end

-- Quest rewards --------------------------------------------------------------------------------------------------------

--- Of a quest's reward choices (item links), the one to take: the biggest upgrade you can wear now (else soonest), or,
--- with no upgrade among them, the one that sells for most. Returns its index and "up" or "sell".
function Gear.BestReward(links)
	local best, bestDelta, bestLater, sell, sellPrice
	for i, link in pairs(links) do
		local pct, delta, from = Gear.Upgrade(link)
		if pct then
			local later = from and true or false
			if not best or (bestLater and not later) or (later == bestLater and delta > bestDelta) then
				best, bestDelta, bestLater = i, delta, later
			end
		end
		local price = itemInfo and select(11, itemInfo(link))
		if plain(price) and type(price) == "number" and price > 0 and (not sellPrice or price > sellPrice) then
			sell, sellPrice = i, price
		end
	end
	if best then
		return best, "up"
	end
	if sell then
		return sell, "sell"
	end
end

local marks = {}
local function markOf(button)
	local m = marks[button]
	if not m then
		m = CreateFrame("Frame", nil, button)
		m:SetSize(18, 18)
		m:SetFrameLevel(button:GetFrameLevel() + 5)
		m.disc = m:CreateTexture(nil, "ARTWORK")
		m.disc:SetTexture(ns.UI.MEDIA .. "Disc32.tga")
		m.disc:SetAllPoints()
		m.icon = m:CreateTexture(nil, "OVERLAY")
		m.icon:SetPoint("CENTER")
		marks[button] = m
	end
	return m
end

-- The reward buttons of the quest window or the quest log's details, and the link of a choice by its number.
local function rewardButtons()
	local frame = QuestInfoRewardsFrame or (QuestInfoFrame and QuestInfoFrame.rewardsFrame)
	if not frame then
		return {}
	end
	if frame.RewardButtons then
		return frame.RewardButtons
	end
	local out = {}
	for i = 1, 10 do
		out[i] = _G["QuestInfoRewardsFrameQuestInfoItem" .. i]
	end
	return out
end

local function markRewards()
	for _, m in pairs(marks) do
		m:Hide()
	end
	if not (ns.db and ns.db.tooltipItems) then
		return
	end
	local log = QuestInfoFrame and QuestInfoFrame.questLog
	local linkOf = log and GetQuestLogItemLink or GetQuestItemLink
	if not linkOf then
		return
	end
	local links, buttons = {}, {}
	for _, b in ipairs(rewardButtons()) do
		if b and b:IsShown() and b.type == "choice" and (b.objectType == nil or b.objectType == "item") then
			local n = b:GetID()
			local link = n and n > 0 and linkOf("choice", n)
			if plain(link) and link then
				links[n], buttons[n] = link, b
			end
		end
	end
	if not next(links) or not next(links, next(links)) then
		return -- one reward or none: nothing to choose
	end
	local n, kind = Gear.BestReward(links)
	local b = n and buttons[n]
	if not b then
		return
	end
	local m = markOf(b)
	local icon = b.Icon or b.icon or (b.GetName and b:GetName() and _G[b:GetName() .. "IconTexture"])
	m:ClearAllPoints()
	m:SetPoint("CENTER", icon or b, "TOPLEFT", 2, -2)
	if kind == "up" then
		m.icon:SetTexture(ns.UI.MEDIA .. "Arrow.tga")
		m.icon:SetSize(14, 14)
		m.icon:SetVertexColor(unpack(ns.RGB.green))
		m.icon:SetTexCoord(0, 1, 0, 1)
	else
		m.icon:SetTexture("Interface\\MoneyFrame\\UI-GoldIcon")
		m.icon:SetSize(12, 12)
		m.icon:SetVertexColor(1, 1, 1)
		m.icon:SetTexCoord(0, 1, 0, 1)
	end
	m.disc:SetVertexColor(0.05, 0.05, 0.06, 0.92)
	m:Show()
end
Gear.MarkRewards = markRewards

if hooksecurefunc and QuestInfo_Display then
	hooksecurefunc("QuestInfo_Display", function()
		local ok, err = pcall(markRewards)
		if not ok and ns.debug then
			ns.Print("reward mark: " .. tostring(err))
		end
	end)
end

-- The best upgrade near your level for each slot (the Gear page) ----------------------------------------------------------

Gear.GROUPS = {
	{ label = "Head", slots = { 1 } },
	{ label = "Neck", slots = { 2 } },
	{ label = "Shoulders", slots = { 3 } },
	{ label = "Back", slots = { 15 } },
	{ label = "Chest", slots = { 5 } },
	{ label = "Wrists", slots = { 9 } },
	{ label = "Hands", slots = { 10 } },
	{ label = "Waist", slots = { 6 } },
	{ label = "Legs", slots = { 7 } },
	{ label = "Feet", slots = { 8 } },
	{ label = "Rings", slots = { 11, 12 } },
	{ label = "Trinkets", slots = { 13, 14 } },
	{ label = "Weapon", slots = { 16 } },
	{ label = "Off hand", slots = { 17 } },
	{ label = "Ranged", slots = { 18 } },
}
local GROUP_OF = {}
for i, g in ipairs(Gear.GROUPS) do
	for _, s in ipairs(g.slots) do
		GROUP_OF[s] = i
	end
end

local AHEAD = 2 -- levels ahead an upgrade may require

--- The quests whose hand-ins are still ahead on your route, as a set.
local function routeQuests()
	local G, out = ns.Guide, {}
	if not G then
		return out
	end
	local i, _, r = G.Index()
	if not i then
		return out
	end
	for j = i, #r.steps do
		local step = r.steps[j]
		if step[1] == G.TURNIN and not G.IsSkipped(j) then
			out[step[2]] = true
		end
	end
	return out
end

local NEAR = 4 -- levels ahead on your route whose zones count as on your way

--- Where an item is worth going for: the zones of your route's next few levels, and the dungeons and raids for your
--- level (not the other side's capital).
local function nearZones(level)
	local G, out = ns.Guide, {}
	if G then
		local i, _, r = G.Index()
		for j = i or 1, i and #r.steps or 0 do
			local step = r.steps[j]
			if (step[7] or 0) > level + NEAR then
				break
			end
			out[step[4]] = true
		end
	end
	local closed = ns.player.faction == "horde" and 717 or 2437 -- the Stockade, Ragefire Chasm
	for _, d in ipairs(ns.dungeons or {}) do
		if d.zone and d.zone ~= 0 and d.zone ~= closed and (d.lo or 0) <= level + AHEAD then
			out[d.zone] = true
		end
	end
	return out
end

--- For each slot group: { group, best = { id, it, pct, delta, from, empty } or nil }, an item you can get up to AHEAD
--- levels above yours: one you can buy or have made, one that drops on your way (in a zone of your route, or a dungeon),
--- or a quest's reward while that quest is ahead on your route (not a reward from the other end of the world, a fair or
--- a fishing contest). An upgrade you can wear now goes before a better one later unless the later one adds half as much
--- again.
function Gear.SlotUpgrades()
	local level = ns.player.level or 1
	local best = {}
	local ahead, near = routeQuests(), nearZones(level)
	local function onRoute(it)
		for _, q in ipairs(it[15] or {}) do
			if ahead[q] then
				return true
			end
		end
		return false
	end
	local function gettable(it)
		if it[8] == "c" then
			return not it[16] or near[it[16]] or onRoute(it)
		end
		return it[8] == "q" and onRoute(it)
	end
	for id, it in pairs(ns.items or {}) do
		if (it[14] or it[4]) <= level + AHEAD and SLOTS[it[5]] and gettable(it) then
			local pct, delta, from, empty, slot = Gear.Upgrade(id)
			-- Not one you could wear only much later (mail for a hunter at 40).
			local g = pct and (from or 0) <= level + AHEAD and GROUP_OF[slot]
			if g then
				-- A quest reward you can wear at any level still waits for its quest.
				from = from or ((it[14] or 0) > level and it[14] or nil)
				local rank = delta * (from and 0.67 or 1)
				local b = best[g]
				if not b or rank > b.rank or (rank == b.rank and id < b.id) then
					best[g] = { id = id, it = it, pct = pct, delta = delta, from = from, empty = empty, rank = rank }
				end
			end
		end
	end
	local out = {}
	for i, g in ipairs(Gear.GROUPS) do
		out[i] = { group = g, best = best[i] }
	end
	return out
end

--- Whether one of the quests that give an item is still ahead on your route.
function Gear.OnRoute(it)
	local qs = it and it[15]
	local G = ns.Guide
	if not qs or not G then
		return false
	end
	local i, _, r = G.Index()
	if not i then
		return false
	end
	for j = i, #r.steps do
		local step = r.steps[j]
		if step[1] == G.TURNIN and not G.IsSkipped(j) then
			for _, q in ipairs(qs) do
				if step[2] == q then
					return true
				end
			end
		end
	end
	return false
end

ns.On("PLAYER_EQUIPMENT_CHANGED", function()
	wipe(equipped)
	ns.Send("GEAR")
end)
ns.Listen("TALENTS", forget)
ns.Listen("BUILD", forget)
ns.Listen("LEVEL", forget)
ns.On("SKILL_LINES_CHANGED", forget)
