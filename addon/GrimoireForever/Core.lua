-- Grimoire for World of Warcraft: Forever: the field guide in game.
-- Copyright (C) 2026 gimzdev. Free software under the GNU General Public License, version 3 or later: see LICENSE.
-- Game data credits are in NOTICE.md and on the About page.
local ADDON, ns = ...

ns.ADDON = ADDON
ns.title = "Grimoire"
local getMeta = C_AddOns and C_AddOns.GetAddOnMetadata
ns.version = (getMeta and getMeta(ADDON, "Version")) or "1.0.0"
ns.SOURCE_URL = "https://github.com/gimzdev/grimoire"

-- Colours, as hex for text codes and as 0-1 triples for widgets: the site's palette.
ns.HEX = {
	gilt = "f2b640", -- gold, for what is active
	gold = "ffd47a", -- bright gold, for names worth noticing
	white = "f4f1ea", -- headings and labels
	text = "d7d2c8", -- body text
	mist = "a29d93", -- secondary text
	fog = "77736c", -- quiet text
	green = "9ccc74",
	red = "f0806c",
	blue = "9cc9f5",
	xp = "b9a4f4", -- experience, the game's own purple, lightened to read on dark panels
	new = "c6e6a5",
	changed = "ffd47a",
	link = "ffd47a",
}
ns.RGB = {}
for key, hex in pairs(ns.HEX) do
	ns.RGB[key] = { tonumber(hex:sub(1, 2), 16) / 255, tonumber(hex:sub(3, 4), 16) / 255, tonumber(hex:sub(5, 6), 16) / 255 }
end
-- Item quality, lifted a touch from the game's values so they read on dark panels, as on the site.
ns.QUALITY = { [0] = "9d9d9d", "ffffff", "1eff00", "2b8cff", "b45cf7", "ff8a1f", "e6cc80" }
ns.QUALITY_NAME = { [0] = "Poor", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Artifact" }

function ns.Hex(hex, text)
	return "|cff" .. hex .. tostring(text) .. "|r"
end

function ns.Print(message)
	print("|cff" .. ns.HEX.gilt .. "Grimoire:|r " .. message)
end

function ns.QualityText(quality, text)
	return ns.Hex(ns.QUALITY[quality or 1] or "ffffff", text)
end

function ns.ClassText(slug, text)
	local c = ns.classes and ns.classes[slug]
	if not c then
		return text or slug or ""
	end
	return ns.Hex(c.color, text or c.name)
end

--- The classes in a bit mask (a bit per class in ns.classOrder), in their colours; nil past max classes.
function ns.ClassList(mask, max)
	local names = {}
	for i, slug in ipairs(ns.classOrder or {}) do
		if math.floor(mask / 2 ^ (i - 1)) % 2 == 1 then
			names[#names + 1] = ns.ClassText(slug)
		end
	end
	if #names == 0 or (max and #names > max) then
		return nil
	end
	return table.concat(names, ", ")
end

function ns.Icon(name)
	if not name or name == "" then
		return "Interface\\Icons\\INV_Misc_QuestionMark"
	end
	return "Interface\\Icons\\" .. name
end

function ns.Levels(lo, hi)
	if not lo or lo == 0 then
		return "levels not announced"
	end
	if lo == hi then
		return tostring(lo)
	end
	return lo .. "-" .. hi
end

--- The part of a rank worth saying in a sentence: "Rank 3", "Pig"; nothing for "Summon", "Passive" and the like.
function ns.RankLabel(rank)
	if not rank or rank == "" then
		return ""
	end
	if rank:match("^Rank %d+$") or rank == "Pig" or rank == "Turtle" then
		return rank
	end
	return ""
end

--- A spell with its rank, for sentences: "Fireball (Rank 3)".
function ns.SpellLabel(a)
	local rank = ns.RankLabel(a.rank)
	return rank ~= "" and (a.name .. " (" .. rank .. ")") or a.name
end

--- "Rank 3" -> 3, "" -> 1.
function ns.RankNumber(rank)
	return tonumber(rank and rank:match("(%d+)") or "") or 1
end

--- Splits "id:chance[:q];..." loot strings into { id, chance, quest } rows.
function ns.ParseLoot(text)
	local rows = {}
	if not text or text == "" then
		return rows
	end
	for entry in text:gmatch("[^;]+") do
		local id, chance, quest = entry:match("^(%d+):([%d%.]+):?(q?)$")
		if id then
			rows[#rows + 1] = { id = tonumber(id), chance = tonumber(chance), quest = quest == "q" }
		end
	end
	return rows
end

--- An item's name, quality and icon from the gear list or the other items.
function ns.ItemInfo(id)
	local it = ns.items and ns.items[id]
	if it then
		return it[1], it[2], it[7], it
	end
	local m = ns.minor and ns.minor[id]
	if m then
		return m[1], m[2], m[3], nil
	end
	return nil
end

--- A drop chance as the site writes it: 34%, 5.1%, 0.42%, and "<0.01%" for the rarest (Nefarian's recipes).
function ns.Chance(chance)
	if not chance then
		return ""
	end
	if chance >= 10 then
		return string.format("%d%%", math.floor(chance + 0.5))
	elseif chance >= 1 then
		return string.format("%.1f%%", chance)
	elseif chance > 0 and chance < 0.01 then
		return "<0.01%"
	end
	return string.format("%.2f%%", chance)
end

-- Saved settings ------------------------------------------------------------------------------------------------

local DEFAULTS = {
	tooltipItems = true,
	tooltipNpcs = true,
	levelUp = true,
	trainer = true,
	minimap = { hide = false, angle = 215 },
	guideShown = true, -- the leveling guide's window
	guidePin = true, -- the game's map pin on each step's place
	guideMeters = false, -- distances in meters instead of yards
	guideLock = false, -- the guide window stays where it is
	guideScale = 1, -- the guide window's scale (Ctrl and the mouse wheel over it); its place and size are in guidePos
	guideTime = true, -- the walking time under the distance
	guideTheme = "dark", -- the guide window's look: dark, clear or classic
	guideAuto = true, -- take and hand in the route's quests at their givers
	rareAlerts = true, -- a card when a rare creature is near
	merchant = true, -- sell grey items and repair at merchants
	killBar = true, -- the bar on your target's health that fills as your DoTs come to cover it
	-- mode: "light" or "complete" while the settings match one (UI/About.lua); Complete to start with.
}
local CHAR_DEFAULTS = { tab = "home" }

local function copy(t)
	local out = {}
	for k, v in pairs(t) do
		out[k] = type(v) == "table" and copy(v) or v
	end
	return out
end

local function fill(db, defaults)
	for k, v in pairs(defaults) do
		if db[k] == nil then
			db[k] = type(v) == "table" and copy(v) or v
		elseif type(v) == "table" and type(db[k]) == "table" then
			fill(db[k], v)
		end
	end
end

-- Events and the addon's own messages ---------------------------------------------------------------------------

local frame = CreateFrame("Frame")
local handlers = {}
local listeners = {}

local function safeCall(fn, ...)
	local ok, err = pcall(fn, ...)
	if not ok then
		local handler = geterrorhandler and geterrorhandler()
		if handler then
			handler(err)
		end
	end
end

--- Calls fn(...) on a game event.
function ns.On(event, fn)
	if not handlers[event] then
		handlers[event] = {}
		frame:RegisterEvent(event)
	end
	table.insert(handlers[event], fn)
end

--- Calls fn(...) when another part of the addon sends message.
function ns.Listen(message, fn)
	listeners[message] = listeners[message] or {}
	table.insert(listeners[message], fn)
end

function ns.Send(message, ...)
	for _, fn in ipairs(listeners[message] or {}) do
		safeCall(fn, ...)
	end
end

frame:SetScript("OnEvent", function(_, event, ...)
	for _, fn in ipairs(handlers[event] or {}) do
		safeCall(fn, ...)
	end
end)

ns.On("ADDON_LOADED", function(name)
	if name ~= ADDON then
		return
	end
	GrimoireForeverDB = GrimoireForeverDB or {}
	GrimoireForeverCharDB = GrimoireForeverCharDB or {}
	fill(GrimoireForeverDB, DEFAULTS)
	fill(GrimoireForeverCharDB, CHAR_DEFAULTS)
	ns.db = GrimoireForeverDB
	ns.char = GrimoireForeverCharDB
	ns.Send("INIT")
end)

ns.On("PLAYER_LOGIN", function()
	if ns.UpdatePlayer then
		ns.UpdatePlayer()
	end
	ns.Send("LOGIN")
end)

-- Slash commands ------------------------------------------------------------------------------------------------

local HELP = {
	{ "/grim", "open or close the field guide" },
	{ "/grim light, /grim complete", "switch mode: the essentials, or everything" },
	{ "/grim talents", "your build, point by point" },
	{ "/grim abilities", "what to train and when" },
	{ "/grim leveling", "where to level now" },
	{ "/grim dungeons", "dungeons and raids: bosses, abilities, loot" },
	{ "/grim items", "search every item and where it drops" },
	{ "/grim raid", "check your raid's buffs" },
	{ "/grim legacy", "Legacy challenges and your perk plan" },
	{ "/grim guides", "every Grimoire guide" },
	{ "/grim next", "your next talent point and spells to train" },
	{ "/grim guide", "show or hide the leveling guide's window" },
	{ "/grim skip, /grim back", "move through the leveling guide's steps" },
	{ "/grim unfollow", "stop following your talent build" },
	{ "/grim minimap", "show or hide the minimap button" },
	{ "/grim options", "settings and credits" },
}

SLASH_GRIMOIREFOREVER1 = "/grim"
SLASH_GRIMOIREFOREVER2 = "/grimoire"
SlashCmdList.GRIMOIREFOREVER = function(message)
	local cmd = strtrim and strtrim((message or ""):lower()) or (message or ""):lower()
	if cmd == "" then
		ns.Toggle()
	elseif cmd == "help" or cmd == "?" then
		ns.Print("commands:")
		for _, row in ipairs(HELP) do
			print("  " .. ns.Hex(ns.HEX.gold, row[1]) .. "  " .. row[2])
		end
	elseif cmd == "next" then
		if ns.ReportNext then
			ns.ReportNext()
		end
	elseif cmd == "guide" or cmd == "arrow" then
		local shown = ns.GuideFrame and ns.GuideFrame:IsShown()
		ns.db.guideShown = not shown
		ns.char.guide = ns.char.guide or {}
		ns.char.guide.keep = not shown or nil
		if ns.UpdateGuideFrame then
			ns.UpdateGuideFrame()
		end
		ns.Print(not shown and "leveling guide shown." or "leveling guide hidden. /grim guide brings it back.")
	elseif cmd == "skip" then
		if ns.Guide then
			ns.Guide.Next()
		end
	elseif cmd == "back" then
		if ns.Guide then
			ns.Guide.Back()
		end
	elseif cmd == "unfollow" then
		local b = ns.StopFollowing and ns.StopFollowing()
		if b then
			ns.Print("you no longer follow " .. b.name .. ": level-ups will not name a talent point. Follow a build again in " .. ns.Hex(ns.HEX.gold, "/grim talents") .. ".")
		else
			ns.Print("you are not following a talent build.")
		end
	elseif cmd == "light" or cmd == "complete" then
		if ns.SetMode then
			ns.SetMode(cmd)
			ns.Print(cmd == "light" and "Light mode. " .. ns.Hex(ns.HEX.gold, "/grim complete") .. " turns everything on." or "Complete mode: everything on. " .. ns.Hex(ns.HEX.gold, "/grim light") .. " keeps the essentials.")
		end
	elseif cmd == "kill" then
		if ns.ShowKillBar then
			ns.ShowKillBar()
		end
	elseif cmd == "minimap" then
		ns.db.minimap.hide = not ns.db.minimap.hide
		if ns.UpdateMinimapButton then
			ns.UpdateMinimapButton()
		end
		ns.Print(ns.db.minimap.hide and "minimap button hidden. /grim minimap brings it back." or "minimap button shown.")
	elseif cmd == "options" or cmd == "config" or cmd == "settings" or cmd == "about" then
		ns.Open("about")
	else
		local alias = { talent = "talents", spells = "abilities", trainer = "abilities", level = "leveling", route = "leveling", dungeon = "dungeons", raids = "dungeons", loot = "dungeons", item = "items", search = "items", gear = "items", upgrades = "items", guide = "guides", perks = "legacy", perk = "legacy", challenges = "legacy" }
		local key = alias[cmd] or cmd
		if ns.HasTab and ns.HasTab(key) then
			ns.Open(key)
		else
			ns.Print("unknown command. Type " .. ns.Hex(ns.HEX.gold, "/grim help") .. " for the list.")
		end
	end
end

-- The game's add-on compartment (the button under the minimap) calls these by name, from the TOC.
function GrimoireForever_OnAddonCompartmentClick()
	ns.Toggle()
end

function GrimoireForever_OnAddonCompartmentEnter(_, button)
	GameTooltip:SetOwner(button or UIParent, "ANCHOR_LEFT")
	GameTooltip:SetText("Grimoire")
	GameTooltip:AddLine("The WoW Forever field guide. Click to open.", 1, 1, 1, true)
	GameTooltip:Show()
end

function GrimoireForever_OnAddonCompartmentLeave()
	GameTooltip:Hide()
end
