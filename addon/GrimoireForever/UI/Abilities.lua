-- Abilities: every trainer spell by the level it is learned at, with what you know and what is waiting.
local _, ns = ...
local UI = ns.UI

local view = { cls = nil, filter = "all" }
local FILTERS = { { "all", "All" }, { "train", "To train" }, { "new", "New in Forever" } }

local function rows(cls, filter)
	local own = cls == ns.player.class
	local talentsOf = ns.TalentNames(cls)
	local trainSet, knownRank = {}, {}
	if own then
		for _, a in ipairs(ns.ToTrain(ns.player.level)) do
			trainSet[a.id] = true
		end
		knownRank = ns.KnownRanks()
	end
	local out, lastLevel = {}, nil
	for _, a in ipairs(ns.abilities[cls] or {}) do
		local keep = filter == "all" or (filter == "train" and trainSet[a.id]) or (filter == "new" and a.new)
		if keep then
			if a.level ~= lastLevel then
				out[#out + 1] = { header = true, level = a.level }
				lastLevel = a.level
			end
			local state, why
			if own then
				local learnable, reason = ns.Learnable(a)
				if ns.Knows(a.id) then
					state = "known"
				elseif not learnable then
					state, why = "never", reason
				elseif trainSet[a.id] then
					state = "train"
				elseif not ns.FromTrainer(a, knownRank, talentsOf) then
					state = "talent"
				elseif a.level <= ns.player.level then
					state = (knownRank[ns.SpellKey(a)] or 0) > ns.RankNumber(a.rank) and "below" or "skip"
				end
			elseif talentsOf[a.name] then
				state = "talent"
			end
			out[#out + 1] = { a = a, state = state, why = why }
		end
	end
	return out
end

local function build(frame)
	frame.chips = {}
	for _, cls in ipairs(ns.classOrder) do
		local c = ns.classes[cls]
		local rgb = { tonumber(c.color:sub(1, 2), 16) / 255, tonumber(c.color:sub(3, 4), 16) / 255, tonumber(c.color:sub(5, 6), 16) / 255 }
		local chip = UI.Chip(frame, c.name, function()
			view.cls = cls
			frame:Update()
		end, rgb)
		chip.cls = cls
		frame.chips[#frame.chips + 1] = chip
	end
	local width = frame:GetWidth() > 0 and frame:GetWidth() or 730
	local h = UI.Flow(frame.chips, frame, 0, 0, width, 6)
	frame.filters = {}
	for _, f in ipairs(FILTERS) do
		local chip = UI.Chip(frame, f[2], function()
			view.filter = f[1]
			frame:Update()
		end)
		chip.key = f[1]
		frame.filters[#frame.filters + 1] = chip
	end
	frame.filterTop = h + 10
	UI.Flow(frame.filters, frame, 0, frame.filterTop, width, 6)
	frame.summary = UI.Text(frame, 12, ns.RGB.mist, { justify = "RIGHT" })
	frame.summary:SetPoint("TOPRIGHT", -4, -(h + 16))
	local card
	card, frame.list = UI.CardList(frame, 34, function(list)
		local row = UI.Row(list)
		row.icon = UI.Icon(row, 24)
		row.icon:SetPoint("LEFT", 12, 0)
		row.level = UI.Text(row, 12, ns.RGB.white, { weight = "bold" })
		row.level:SetPoint("BOTTOMLEFT", 12, 9)
		row.rule = UI.Rule(row)
		row.rule:SetPoint("BOTTOMLEFT", 12, 3)
		row.rule:SetPoint("BOTTOMRIGHT", -12, 3)
		row.name = UI.Text(row, 12, ns.RGB.white, { weight = "medium" })
		row.name:SetPoint("LEFT", 46, 0.5)
		row.badge = UI.Text(row, 11, ns.RGB.new, { justify = "RIGHT" })
		row.badge:SetPoint("RIGHT", -150, 0.5)
		row.state = UI.Text(row, 11, ns.RGB.mist, { justify = "RIGHT" })
		row.state:SetPoint("RIGHT", -12, 0.5)
		row:HookScript("OnEnter", function(self)
			if self.item and self.item.a then
				local a = self.item.a
				local lines = {}
				if a.rank ~= "" then
					lines[#lines + 1] = a.rank
				end
				lines[#lines + 1] = "Learned at level " .. a.level
				UI.SpellTooltip(self, a.id, a.name, lines)
			end
		end)
		row:HookScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		return row
	end, function(row, item)
		row.item = item
		if item.header then
			row.level:SetText("Level " .. item.level)
			row.level:Show()
			row.rule:Show()
			row.icon:Hide()
			row.name:SetText("")
			row.badge:SetText("")
			row.state:SetText("")
			row:SetSelected(false)
			row:EnableMouse(false)
			return
		end
		local a = item.a
		row:EnableMouse(true)
		row.level:Hide()
		row.rule:Hide()
		row.icon:Show()
		row.icon:SetIcon(ns.Icon(a.icon))
		row.name:SetText(a.name .. (a.rank ~= "" and ns.Hex(ns.HEX.mist, "  " .. a.rank) or ""))
		row.badge:SetText(a.new and "New in Forever" or "")
		if item.state == "known" then
			row.state:SetText(ns.Hex(ns.HEX.green, "known"))
		elseif item.state == "train" then
			row.state:SetText(ns.Hex(ns.HEX.gold, "train now"))
		elseif item.state == "talent" then
			row.state:SetText(ns.Hex(ns.HEX.fog, "talent"))
		elseif item.state == "skip" then
			row.state:SetText(ns.Hex(ns.HEX.fog, "a higher rank is ready"))
		elseif item.state == "below" then
			row.state:SetText(ns.Hex(ns.HEX.fog, "a higher rank is known"))
		elseif item.state == "never" then
			row.state:SetText(ns.Hex(ns.HEX.fog, item.why or "not for you"))
		else
			row.state:SetText("")
		end
		row:SetSelected(item.state == "train")
	end, function(item)
		return item.header and 38 or 34
	end)
	card:SetPoint("TOPLEFT", 0, -(h + 48))
	card:SetPoint("BOTTOMRIGHT")

	function frame:Update()
		ns.UpdatePlayer()
		view.cls = view.cls or ns.player.class or "warrior"
		for _, chip in ipairs(self.chips) do
			chip:SetSelected(chip.cls == view.cls)
		end
		-- "To train" is for your own class only.
		local own = view.cls == ns.player.class
		if view.filter == "train" and not own then
			view.filter = "all"
		end
		for _, chip in ipairs(self.filters) do
			chip:SetSelected(chip.key == view.filter)
			chip:SetShown(chip.key ~= "train" or own)
		end
		UI.Flow(self.filters, self, 0, self.filterTop, self:GetWidth() > 0 and self:GetWidth() or 730, 6)
		local data = rows(view.cls, view.filter)
		local count = 0
		for _, r in ipairs(data) do
			if not r.header then
				count = count + 1
			end
		end
		if view.cls == ns.player.class then
			local n = #ns.ToTrain(ns.player.level)
			self.summary:SetText(n > 0 and ns.Hex(ns.HEX.gold, n .. " to train at level " .. ns.player.level) or ("Nothing to train at level " .. ns.player.level))
		else
			self.summary:SetText(count .. " spell ranks")
		end
		-- A new class or filter starts at your level; a refresh (a new spell, a stance) keeps the place.
		local key = view.cls .. "/" .. view.filter
		local fresh = self.shownKey ~= key
		self.shownKey = key
		self.list:SetData(data, not fresh)
		if fresh and view.filter == "all" and own then
			for i, r in ipairs(data) do
				if r.header and r.level >= ns.player.level then
					self.list:ScrollTo(math.max(1, i - 2))
					break
				end
			end
		end
	end
end

ns.AddTab({
	key = "abilities",
	label = "Abilities",
	icon = "INV_Misc_Book_11",
	order = 3,
	lede = "Every trainer spell by the level it is learned at, with what you know and what is waiting.",
	build = build,
	show = function(frame)
		frame:Update()
	end,
})
