-- Gear: your best upgrade for each slot near your level, and a search of every item you can wear, with where each
-- comes from.
local _, ns = ...
local UI = ns.UI

local view = { text = "", slot = nil, quality = {}, usable = false, mine = false, raid = true, all = false, sort = "ilvl" }
local SORTS = { { "ilvl", "Sort: item level" }, { "req", "Sort: required level" }, { "name", "Sort: name" } }
local MODES = { { "gear", "Upgrades" }, { "search", "All items" } }
local index

local function mode()
	return ns.char and ns.char.itemsView == "search" and "search" or "gear"
end

local function buildIndex()
	index = {}
	for id, it in pairs(ns.items) do
		index[#index + 1] = { id = id, it = it, lower = it[1]:lower() }
	end
end

local function classBit(cls)
	for i, slug in ipairs(ns.classOrder) do
		if slug == cls then
			return 2 ^ (i - 1)
		end
	end
end

local function hasBit(mask, bit)
	return bit and math.floor(mask / bit) % 2 == 1
end

local function search()
	if not index then
		buildIndex()
	end
	local words = {}
	for w in view.text:lower():gmatch("%S+") do
		words[#words + 1] = w
	end
	local slots
	if view.slot then
		slots = {}
		for _, s in ipairs(ns.slots) do
			if s.key == view.slot then
				for _, n in ipairs(s.slots) do
					slots[n] = true
				end
			end
		end
	end
	local anyQuality = next(view.quality) == nil
	local bit = view.usable and classBit(ns.player.class)
	local level = ns.player.level
	local side = ns.player.faction == "horde" and 2 or 1
	local out = {}
	for _, row in ipairs(index) do
		local it = row.it
		local keep = true
		if it[8] == "e" and not view.all then
			keep = false
		elseif it[8] == "r" and not view.raid then
			keep = false
		end
		if keep and slots and not slots[it[5]] then
			keep = false
		end
		if keep and not anyQuality and not view.quality[it[2]] then
			keep = false
		end
		if keep and bit and not hasBit(it[9], bit) then
			keep = false
		end
		if keep and view.mine and (it[4] > level or (it[11] ~= 0 and it[11] ~= side)) then
			keep = false
		end
		if keep then
			for _, w in ipairs(words) do
				if not row.lower:find(w, 1, true) then
					keep = false
					break
				end
			end
		end
		if keep then
			out[#out + 1] = row
		end
	end
	local sort = view.sort
	table.sort(out, function(a, b)
		local x, y = a.it, b.it
		if sort == "name" then
			if x[1] ~= y[1] then
				return x[1] < y[1]
			end
			return a.id < b.id
		elseif sort == "req" then
			if x[4] ~= y[4] then
				return x[4] > y[4]
			end
		end
		if x[3] ~= y[3] then
			return x[3] > y[3]
		end
		if x[2] ~= y[2] then
			return x[2] > y[2]
		end
		return x[1] < y[1]
	end)
	return out
end

-- Upgrades: a row per slot, what you wear and the best upgrade for it --------------------------------------------------

local function iconOf(link)
	local id = tonumber(link:match("item:(%d+)") or "")
	local it = id and ns.items[id]
	if it then
		return ns.Icon(it[7])
	end
	if id and C_Item and C_Item.GetItemIconByID then
		return C_Item.GetItemIconByID(id)
	end
	return id and GetItemIcon and GetItemIcon(id) or nil
end

--- The nearest of a creature's places: flat area, x, y triples.
local function nearest(spots)
	local best, bestYards
	for i = 1, #spots - 2, 3 do
		local yards = ns.Guide.Toward(spots[i], spots[i + 1], spots[i + 2])
		if not best or (yards and (not bestYards or yards < bestYards)) then
			best, bestYards = i, yards
		end
	end
	return best and spots[best], best and spots[best + 1], best and spots[best + 2]
end

--- Where to get an upgrade, as a click: the arrow to the giver of a quest that gives it, else the dungeon boss that drops
--- it on the Dungeons page, else the arrow to the creature that drops it; nil when none is known.
local function whereTo(b)
	local G = ns.guide
	for _, q in ipairs(b.it[15] or {}) do
		local s = G and G.starts and G.starts[q]
		if s and s[5] ~= 0 and s[6] ~= 0 then
			local who = s[5] > 0 and G.npcs[s[5]] or G.objects[-s[5]]
			return function()
				ns.Guide.GoTo({ area = s[6], x = s[7], y = s[8], title = who or s[1], sub = s[1] })
			end
		end
	end
	local key = b.id .. ":"
	for _, d in ipairs(ns.dungeons or {}) do
		for i, boss in ipairs(d.bosses or {}) do
			local loot = boss.loot or ""
			if loot:sub(1, #key) == key or loot:find(";" .. key, 1, true) then
				return function()
					ns.OpenDungeonBoss(d.slug, i)
				end
			end
		end
	end
	local npc = b.it[17]
	local spots = npc and G and (G.rares and G.rares[npc] or G.camps and G.camps[npc])
	if spots and #spots >= 3 then
		return function()
			local area, x, y = nearest(spots)
			local name = G.npcs and G.npcs[npc]
			ns.Guide.GoTo({ area = area, x = x, y = y, title = name or b.it[1], sub = name and b.it[1] or nil })
		end
	end
end

local function percent(b)
	if b.empty then
		return "empty slot"
	end
	return ns.Gear.Percent(b.pct)
end

local function buildGear(frame)
	local card
	card, frame.gearList = UI.CardList(frame, 50, function(list)
		local row = UI.Row(list)
		row.slot = UI.Text(row, 11, ns.RGB.mist, { weight = "medium" })
		row.slot:SetPoint("LEFT", 12, 0)
		row.slot:SetWidth(68)
		row.worn = UI.Icon(row, 28)
		row.worn:SetPoint("LEFT", 82, 0)
		row.worn:EnableMouse(true)
		row.worn:SetScript("OnEnter", function(self)
			if self.link then
				GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
				GameTooltip:SetHyperlink(self.link)
				GameTooltip:Show()
			end
		end)
		row.worn:SetScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		row.icon = UI.Icon(row, 32)
		row.icon:SetPoint("LEFT", 124, 0)
		row.name = UI.Text(row, 12.5, ns.RGB.white, { weight = "medium" })
		row.name:SetPoint("TOPLEFT", 166, -9)
		row.name:SetPoint("TOPRIGHT", -84, -9)
		row.gain = UI.Text(row, 12.5, ns.RGB.green, { weight = "bold", justify = "RIGHT" })
		row.gain:SetPoint("TOPRIGHT", -14, -9)
		row.sub = UI.Text(row, 11, ns.RGB.mist)
		row.sub:SetPoint("TOPLEFT", 166, -28)
		row.sub:SetPoint("TOPRIGHT", -14, -28)
		row.none = UI.Text(row, 11.5, ns.RGB.fog)
		row.none:SetPoint("LEFT", 124, 0)
		row:HookScript("OnEnter", function(self)
			if self.best then
				UI.ItemTooltip(self, self.best.id)
				if whereTo(self.best) then
					GameTooltip:AddLine("Click for the way there", 0.64, 0.62, 0.58)
					GameTooltip:Show()
				end
			end
		end)
		row:HookScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		row:SetScript("OnClick", function(self)
			local b = self.best
			if not b or UI.ItemClick(b.id) then
				return
			end
			local go = whereTo(b)
			if go then
				go()
			end
		end)
		return row
	end, function(row, r)
		local b = r.best
		row.best = b
		row.slot:SetText(r.group.label)
		-- What you wear: the weaker of a pair (rings, trinkets), the one an upgrade would replace.
		local worn
		for _, s in ipairs(r.group.slots) do
			local e = ns.Gear.Equipped(s)
			if not worn or not e.link or (worn.link and e.score < worn.score) then
				worn = e
			end
		end
		row.worn.link = worn and worn.link
		row.worn:SetIcon(worn and worn.link and iconOf(worn.link) or "Interface\\PaperDoll\\UI-Backpack-EmptySlot", nil)
		row.worn:SetAlpha(worn and worn.link and 0.75 or 0.35)
		row.icon:SetShown(b ~= nil)
		row.name:SetShown(b ~= nil)
		row.gain:SetShown(b ~= nil)
		row.sub:SetShown(b ~= nil)
		row.none:SetShown(b == nil)
		if not b then
			local twoHand = r.group.slots[1] == 17 and ns.Gear.Equipped(16).twoHand
			row.none:SetText(twoHand and "Your two-hander takes both hands" or "Nothing better near your level")
			return
		end
		local it = b.it
		row.icon:SetIcon(ns.Icon(it[7]), it[2])
		row.name:SetText(ns.QualityText(it[2], it[1]))
		row.gain:SetText(percent(b))
		local bits = {}
		if b.from then
			bits[#bits + 1] = ns.Hex(ns.HEX.gold, "at " .. b.from)
		end
		local source = ns.Gear.Source(it)
		if source ~= "" then
			bits[#bits + 1] = source
		end
		if ns.Gear.OnRoute(it) then
			bits[#bits + 1] = ns.Hex(ns.HEX.gilt, "on your route")
		end
		row.sub:SetText(table.concat(bits, "  ·  "))
	end)
	card:SetPoint("TOPLEFT", 0, -46)
	card:SetPoint("BOTTOMRIGHT")
	frame.gearCard = card
end

-- Search ------------------------------------------------------------------------------------------------------------

local TOP = 46 -- below the Upgrades / All items switch

local function buildSearch(frame)
	frame.searchParts = {}
	local function part(x)
		frame.searchParts[#frame.searchParts + 1] = x
		return x
	end
	frame.search = part(UI.Search(frame, 300, "Search items: Lionheart, Sulfuras...", function(text)
		view.text = text
		frame:Update()
	end))
	frame.search:SetPoint("TOPLEFT", 0, -TOP)
	local slotButton = part(UI.Button(frame, "Slot: any", 120, 28))
	slotButton:AddChevron()
	slotButton:SetPoint("LEFT", frame.search, "RIGHT", 10, 0)
	slotButton:SetScript("OnClick", function(self)
		local entries = { { "Any slot", false } }
		for _, s in ipairs(ns.slots) do
			entries[#entries + 1] = { s.label, s.key }
		end
		UI.Menu(self, entries, function(value)
			view.slot = value or nil
			frame:Update()
		end, 2, view.slot or false)
	end)
	frame.slotButton = slotButton
	local sortButton = part(UI.Button(frame, SORTS[1][2], 150, 28, function()
		for i, s in ipairs(SORTS) do
			if s[1] == view.sort then
				view.sort = SORTS[i % #SORTS + 1][1]
				break
			end
		end
		frame:Update()
	end))
	sortButton.tip = "Click to sort another way."
	sortButton:SetPoint("LEFT", slotButton, "RIGHT", 8, 0)
	frame.sortButton = sortButton

	frame.chips = {}
	for q = 2, 5 do
		local chip = part(UI.Chip(frame, ns.QUALITY_NAME[q], function()
			view.quality[q] = not view.quality[q] or nil
			frame:Update()
		end, { tonumber(ns.QUALITY[q]:sub(1, 2), 16) / 255, tonumber(ns.QUALITY[q]:sub(3, 4), 16) / 255, tonumber(ns.QUALITY[q]:sub(5, 6), 16) / 255 }))
		chip.quality = q
		frame.chips[#frame.chips + 1] = chip
	end
	local toggles = {
		{ "usable", "Usable by me" },
		{ "mine", "Up to my level" },
		{ "raid", "Classic raid loot" },
		{ "all", "Items with no source" },
	}
	for _, t in ipairs(toggles) do
		local chip = part(UI.Chip(frame, t[2], function()
			view[t[1]] = not view[t[1]]
			frame:Update()
		end))
		chip.key = t[1]
		frame.chips[#frame.chips + 1] = chip
	end
	local width = frame:GetWidth() > 0 and frame:GetWidth() or 730
	local h = UI.Flow(frame.chips, frame, 0, TOP + 40, width, 6)
	frame.count = part(UI.Text(frame, 12, ns.RGB.mist, { weight = "medium" }))
	frame.count:SetPoint("TOPLEFT", 2, -(TOP + 40 + h + 14))
	local hint = part(UI.Text(frame, 11, ns.RGB.fog, { justify = "RIGHT" }))
	hint:SetPoint("TOPRIGHT", -4, -(TOP + 40 + h + 15))
	hint:SetText("Shift-click to link, Ctrl-click to try on")
	local card
	card, frame.list = UI.CardList(frame, 46, function(list)
		local row = UI.Row(list)
		row.icon = UI.Icon(row, 32)
		row.icon:SetPoint("LEFT", 10, 0)
		row.name = UI.Text(row, 12.5, ns.RGB.white, { weight = "medium" })
		row.name:SetPoint("TOPLEFT", 52, -7)
		row.name:SetPoint("TOPRIGHT", -12, -7)
		row.sub = UI.Text(row, 11, ns.RGB.mist)
		row.sub:SetPoint("TOPLEFT", 52, -26)
		row.sub:SetPoint("TOPRIGHT", -12, -26)
		row:HookScript("OnEnter", function(self)
			if self.item then
				UI.ItemTooltip(self, self.item.id)
			end
		end)
		row:HookScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		row:SetScript("OnClick", function(self)
			if self.item then
				UI.ItemClick(self.item.id)
			end
		end)
		return row
	end, function(row, r)
		row.item = r
		local it = r.it
		row.icon:SetIcon(ns.Icon(it[7]), it[2])
		local badge = it[8] == "r" and ns.Hex(ns.HEX.fog, "  Classic raid") or it[8] == "e" and ns.Hex(ns.HEX.fog, "  no source") or ""
		row.name:SetText(ns.QualityText(it[2], it[1]) .. badge)
		local bits = { "item level " .. it[3] }
		if it[4] > 1 then
			bits[#bits + 1] = "requires " .. it[4]
		end
		if it[6] ~= "" then
			bits[#bits + 1] = it[6]
		end
		local only = it[12] and it[12] ~= 0 and ns.ClassList(it[12], 4)
		if only then
			bits[#bits + 1] = only
		end
		local source = ns.Gear.Source(it)
		if source ~= "" then
			bits[#bits + 1] = ns.Hex(ns.HEX.fog, source)
		end
		row.sub:SetText(table.concat(bits, "  ·  "))
	end)
	part(card)
	card:SetPoint("TOPLEFT", 0, -(TOP + 40 + h + 40))
	card:SetPoint("BOTTOMRIGHT")
end

local function build(frame)
	frame.modes = UI.Tabs(frame, MODES, function(key)
		ns.char.itemsView = key
		frame:Update()
		ns.RefreshHeader()
	end)
	frame.modes:SetPoint("TOPLEFT", 0, 0)
	buildGear(frame)
	buildSearch(frame)

	function frame:Update()
		ns.UpdatePlayer()
		local m = mode()
		self.modes:Select(m)
		self.gearCard:SetShown(m == "gear")
		for _, x in ipairs(self.searchParts) do
			x:SetShown(m == "search")
		end
		if m == "gear" then
			self.gearList:SetData(ns.Gear.SlotUpgrades(), true)
			return
		end
		for _, chip in ipairs(self.chips) do
			if chip.quality then
				chip:SetSelected(view.quality[chip.quality] and true or false)
			else
				chip:SetSelected(view[chip.key] and true or false)
			end
		end
		local slotLabel = "any"
		for _, s in ipairs(ns.slots) do
			if s.key == view.slot then
				slotLabel = s.label
			end
		end
		self.slotButton:SetLabel("Slot: " .. slotLabel)
		self.slotButton:FitWidth(110)
		for _, s in ipairs(SORTS) do
			if s[1] == view.sort then
				self.sortButton:SetLabel(s[2])
				self.sortButton:FitWidth(120)
			end
		end
		local results = search()
		self.count:SetText(#results .. " item" .. (#results == 1 and "" or "s"))
		-- The same search keeps its place when the page refreshes (a level-up); a new one starts at the top.
		local qualities = {}
		for q in pairs(view.quality) do
			qualities[#qualities + 1] = q
		end
		table.sort(qualities)
		local key = table.concat({ view.text, tostring(view.slot), table.concat(qualities, ","), tostring(view.usable), tostring(view.mine), tostring(view.raid), tostring(view.all), view.sort }, "|")
		self.list:SetData(results, self.shownKey == key)
		self.shownKey = key
	end
end

ns.AddTab({
	key = "items",
	label = "Gear",
	icon = "INV_Sword_39",
	order = 6,
	lede = function()
		if mode() == "search" then
			return "Every item you can wear, and where it comes from."
		end
		local _, spec = ns.Gear.Weights()
		return "Your best upgrade for each slot" .. (spec and (", for " .. spec) or "") .. "."
	end,
	build = build,
	show = function(frame)
		frame:Update()
	end,
})

ns.Listen("GEAR", function()
	if ns.IsOpen("items") then
		ns.Open("items")
	elseif ns.IsOpen("home") then
		ns.Open("home")
	end
end)
