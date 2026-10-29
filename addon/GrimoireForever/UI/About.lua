-- Options, commands and credits.
local _, ns = ...
local UI = ns.UI

-- What Grimoire does in the game, in the order Options lists it: { label, settings, redraw }. light: on in Light mode
-- too (Complete turns everything on). A line with two settings sets both.
ns.FEATURES = {
	{ "Leveling guide window", { "guideShown" }, function()
		-- Turned on at level 60 too, where the window otherwise stays away.
		if ns.char then
			ns.char.guide = ns.char.guide or {}
			ns.char.guide.keep = ns.db.guideShown or nil
		end
		if ns.UpdateGuideFrame then
			ns.UpdateGuideFrame()
		end
	end, light = true },
	{ "Route and quest marks on the map", { "guidePin" }, function()
		if ns.Guide and not ns.db.guidePin then
			ns.Guide.Unpin()
		end
		if ns.RefreshRouteMap then
			ns.RefreshRouteMap()
		end
		ns.Send("GUIDE")
	end },
	{ "Take and hand in quests (Shift skips)", { "guideAuto" } },
	{ "Tooltips: sources, drops, upgrades", { "tooltipItems", "tooltipNpcs" }, nil, light = true },
	{ "Level-up notes: talent point, new spells", { "levelUp", "trainer" }, nil, light = true },
	{ "Rare alerts", { "rareAlerts" } },
	{ "DoT kill bar on your target", { "killBar" }, function()
		if ns.UpdateKillBar then
			ns.UpdateKillBar()
		end
	end },
	{ "Sell greys and repair (Shift skips)", { "merchant" } },
}

local docs = {} -- documents showing the settings -> what draws them

--- Draws the settings again wherever they show.
function ns.RefreshOptions()
	for doc, draw in pairs(docs) do
		if doc:IsVisible() then
			doc:SetBlocks(draw(), true)
		end
	end
end

--- Shows draw()'s blocks in doc, and again whenever the settings change.
function ns.ShowOptions(doc, draw)
	docs[doc] = draw
	doc:SetBlocks(draw(), true)
end

--- "light" or "complete" when the settings are one of the two, else nil.
function ns.ModeOf()
	local light, complete = true, true
	for _, f in ipairs(ns.FEATURES) do
		local on = ns.db[f[2][1]] and true or false
		light = light and on == (f.light or false)
		complete = complete and on
	end
	return light and "light" or complete and "complete" or nil
end

--- Light: the guide window, tooltips and level-up notes. Complete: everything.
function ns.SetMode(mode)
	for _, f in ipairs(ns.FEATURES) do
		local on = mode == "complete" or f.light or false
		local was = ns.db[f[2][1]] and true or false
		for _, key in ipairs(f[2]) do
			ns.db[key] = on
		end
		if on ~= was and f[3] then
			f[3]()
		end
	end
	ns.db.mode = ns.ModeOf()
	ns.RefreshOptions()
end

--- The settings as document blocks, shared by this page and the game's Options window.
function ns.OptionBlocks()
	ns.db.mode = ns.ModeOf()
	local blocks = {
		{ "choice", "Mode", "mode", { { "light", "Light" }, { "complete", "Complete" } }, ns.SetMode },
		{ "note", "Light: the guide window, tooltips and level-up notes. Complete: everything." },
	}
	for _, f in ipairs(ns.FEATURES) do
		blocks[#blocks + 1] = { "toggle", f[1], f[2][1], function()
			for i = 2, #f[2] do
				ns.db[f[2][i]] = ns.db[f[2][1]]
			end
			if f[3] then
				f[3]()
			end
			ns.RefreshOptions()
		end }
	end
	blocks[#blocks + 1] = { "toggle", "Minimap button", "minimap", function()
		if ns.UpdateMinimapButton then
			ns.UpdateMinimapButton()
		end
	end }
	blocks[#blocks + 1] = { "note", "Right-click the guide window for its look, units and lock." }
	return blocks
end

local function blocks()
	local m = ns.meta or {}
	local out = { { "card" } }
	for _, b in ipairs(ns.OptionBlocks()) do
		out[#out + 1] = b
	end
	out[#out + 1] = { "end" }
	out[#out + 1] = { "card" }
	out[#out + 1] = { "h", "Commands" }
	local commands = {
		{ "/grim", "open or close this window" },
		{ "/grim light, /grim complete", "switch mode" },
		{ "/grim next", "your next talent point and the spells to train" },
		{ "/grim unfollow", "stop following your talent build" },
		{ "/grim guide", "show or hide the leveling guide's window" },
		{ "/grim skip, /grim back", "the leveling guide's next or previous step" },
		{ "/grim talents, abilities, leveling, dungeons, items, raid, legacy, guides", "open a page" },
		{ "/grim minimap", "show or hide the minimap button" },
	}
	for _, c in ipairs(commands) do
		out[#out + 1] = { "li", ns.Hex(ns.HEX.gold, c[1]) .. "   " .. c[2] }
	end
	out[#out + 1] = { "end" }
	out[#out + 1] = { "card" }
	out[#out + 1] = { "h", "Credits" }
	out[#out + 1] = { "li", "Talents, abilities, racials and Legacy: talentsforever.com, under CC BY 4.0 (creativecommons.org/licenses/by/4.0), reorganised by Grimoire." }
	out[#out + 1] = { "li", "Quests and where creatures stand: LibQuestDB by Pimptasty (MIT), with Classic facts from CMaNGOS (GPL-3.0)." }
	out[#out + 1] = { "li", "Items, loot, creatures and vendors: the VMaNGOS world database (GPL-2.0-or-later), at Classic's patch 1.12, so Forever may differ." }
	out[#out + 1] = { "li", "Fonts: Mona Sans and IM FELL English SC, under the SIL Open Font License." }
	out[#out + 1] = { "li", "Builds, guides and the leveling route: Grimoire." }
	out[#out + 1] = { "li", "The kill bar's idea: Does It Die by JoeGG." }
	out[#out + 1] = { "end" }
	out[#out + 1] = { "card" }
	out[#out + 1] = { "h", "Licence" }
	out[#out + 1] = { "p", "Grimoire © 2026 gimzdev. Free software under the GNU GPL, version 3 or later, with no warranty: see LICENSE and NOTICE.md in the add-on's folder. The source, with the scripts that build its data:" }
	out[#out + 1] = { "copy", ns.SOURCE_URL }
	out[#out + 1] = { "note", "A fan add-on, not affiliated with or endorsed by Blizzard Entertainment. World of Warcraft and Warcraft are trademarks of Blizzard Entertainment, Inc.; game names, text, icons and art © Blizzard Entertainment, Inc." }
	out[#out + 1] = { "note", "Version " .. ns.version .. ". Game data from World of Warcraft: Forever beta build " .. (m.build or "?") .. ", read on " .. (m.extracted or "?") .. "." }
	out[#out + 1] = { "end" }
	return out
end

ns.AddTab({
	key = "about",
	label = "Options",
	icon = "INV_Misc_Gear_01",
	order = 99,
	bottom = true,
	lede = "Settings, commands, credits and the licence.",
	build = function(frame)
		frame.doc = UI.Document(frame)
		frame.doc:SetAllPoints()
	end,
	show = function(frame)
		ns.ShowOptions(frame.doc, blocks)
	end,
})
