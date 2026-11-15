-- Raid check: which buffs, debuffs and utilities your group brings, and what is missing.
local _, ns = ...
local UI = ns.UI

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

--- The group as { class, group } rows (just the player when alone).
local function roster()
	local out = {}
	if IsInRaid and IsInRaid() then
		for i = 1, (GetNumGroupMembers() or 0) do
			local name, _, subgroup, _, _, fileName = GetRaidRosterInfo(i)
			if plain(fileName) and CLASS_BY_FILE[fileName] then
				out[#out + 1] = { name = plain(name) and name or "?", cls = CLASS_BY_FILE[fileName], group = plain(subgroup) and subgroup or 1 }
			end
		end
	else
		local units = { "player" }
		if IsInGroup and IsInGroup() then
			for i = 1, 4 do
				units[#units + 1] = "party" .. i
			end
		end
		for _, unit in ipairs(units) do
			if UnitExists(unit) then
				local _, fileName = UnitClass(unit)
				local name = UnitName(unit)
				if plain(fileName) and CLASS_BY_FILE[fileName] then
					out[#out + 1] = { name = plain(name) and name or "?", cls = CLASS_BY_FILE[fileName], group = 1 }
				end
			end
		end
	end
	return out
end

local KIND_ORDER = { buff = 1, debuff = 2, utility = 3 }
local KIND_TITLE = { buff = "Buffs", debuff = "Debuffs on the boss", utility = "Utility" }

local function specLabel(cls, specs)
	local names = {}
	for _, s in ipairs(ns.raid.specs) do
		if s.cls == cls then
			for _, want in ipairs(specs) do
				if s.spec == want then
					names[#names + 1] = s.label
				end
			end
		end
	end
	return table.concat(names, " or ")
end

--- Each effect with its cover: full, partial (a class that can bring it is there, maybe not in that spec) or none.
local function coverage(members)
	local groups = {}
	for _, m in ipairs(members) do
		groups[m.group] = true
	end
	local groupCount = 0
	for _ in pairs(groups) do
		groupCount = groupCount + 1
	end
	local out = {}
	for _, e in ipairs(ns.raid.effects) do
		local sure, maybe, sureGroups, maybeGroups = {}, {}, {}, {}
		for _, m in ipairs(members) do
			-- A member counts once: surely when any of their class's ways needs no particular spec.
			local any, certain = false, false
			for _, p in ipairs(e.providers) do
				if p.cls == m.cls then
					any = true
					certain = certain or not p.specs
				end
			end
			if certain then
				sure[#sure + 1] = m
				sureGroups[m.group] = true
			elseif any then
				maybe[#maybe + 1] = m
				maybeGroups[m.group] = true
			end
		end
		local state, text
		if #members <= 1 then
			-- Alone: what you bring, and who else would.
			if #sure > 0 then
				state, text = "full", "you bring it"
			elseif #maybe > 0 then
				state, text = "partial", "your spec may"
			else
				state, text = "other", nil
			end
		elseif (e.key == "might" or e.key == "wisdom") and #sure > 0 then
			-- Each paladin gives one blessing to a class, and Kings comes first: Might or Wisdom needs a second paladin.
			if #sure >= 2 then
				state, text = "full", "covered"
			else
				state, text = "partial", "needs a second paladin"
			end
		elseif e.scope == "party" and groupCount > 1 then
			local covered, possible = 0, 0
			for g in pairs(groups) do
				if sureGroups[g] then
					covered = covered + 1
				elseif maybeGroups[g] then
					possible = possible + 1
				end
			end
			if covered == groupCount then
				state = "full"
			elseif covered + possible > 0 then
				state = "partial"
			else
				state = "none"
			end
			text = covered .. " of " .. groupCount .. " groups" .. (possible > 0 and (", " .. possible .. " maybe") or "")
		elseif #sure > 0 then
			state, text = "full", "covered"
		elseif #maybe > 0 then
			state, text = "partial", "if the spec is right"
		else
			state, text = "none", "missing"
		end
		out[#out + 1] = { e = e, state = state, text = text, sure = sure, maybe = maybe }
	end
	-- In a group the gaps come first; alone, what you bring does.
	local rank = #members <= 1 and { full = 0, partial = 1, other = 2 } or { none = 0, partial = 1, full = 2 }
	table.sort(out, function(a, b)
		if a.e.kind ~= b.e.kind then
			return KIND_ORDER[a.e.kind] < KIND_ORDER[b.e.kind]
		end
		if rank[a.state] ~= rank[b.state] then
			return rank[a.state] < rank[b.state]
		end
		return a.e.name < b.e.name
	end)
	-- A header before buffs, debuffs and utility.
	local rows, last = {}, nil
	for _, c in ipairs(out) do
		if c.e.kind ~= last then
			last = c.e.kind
			rows[#rows + 1] = { header = KIND_TITLE[last] or last }
		end
		rows[#rows + 1] = c
	end
	return rows
end

--- The classes that bring an effect, in their colours.
local function providerClasses(e)
	local seen, names = {}, {}
	for _, p in ipairs(e.providers) do
		if not seen[p.cls] then
			seen[p.cls] = true
			names[#names + 1] = ns.ClassText(p.cls)
		end
	end
	return table.concat(names, ", ")
end

-- Cover, drawn with the site's marks: covered (a green check), maybe (a gold dot), missing (a red cross).
local STATE_MARK = {
	full = { "Check", ns.RGB.green, 14 },
	partial = { "Disc16", ns.RGB.gilt, 7 },
	none = { "Close", ns.RGB.red, 12 },
}

--- The line under the page title: who is in the group.
local function whoLine()
	local members = roster()
	local inGroup = (IsInRaid and IsInRaid()) or (IsInGroup and IsInGroup())
	if not inGroup then
		return "Not in a group: what you bring, and which classes bring the rest."
	end
	local counts, order = {}, {}
	for _, m in ipairs(members) do
		if not counts[m.cls] then
			order[#order + 1] = m.cls
		end
		counts[m.cls] = (counts[m.cls] or 0) + 1
	end
	local parts = {}
	for _, cls in ipairs(order) do
		parts[#parts + 1] = counts[cls] .. " " .. ns.ClassText(cls)
	end
	return ((IsInRaid() and "Raid" or "Party") .. " of " .. #members) .. ":  " .. table.concat(parts, ", ")
end

local function build(frame)
	local card
	card, frame.list = UI.CardList(frame, 32, function(list)
		local row = UI.Row(list)
		row.state = row:CreateTexture(nil, "ARTWORK")
		row.state:SetPoint("CENTER", row, "LEFT", 20, 0)
		row.name = UI.Text(row, 12, ns.RGB.white, { weight = "medium" })
		row.name:SetPoint("LEFT", 36, 0.5)
		row.name:SetWidth(230)
		row.cover = UI.Text(row, 12, ns.RGB.text, { justify = "RIGHT" })
		row.cover:SetPoint("LEFT", row.name, "RIGHT", 8, 0)
		row.cover:SetPoint("RIGHT", -12, 0.5)
		row:HookScript("OnEnter", function(self)
			local c = self.item
			if not c or c.header then
				return
			end
			local lines = { { c.e.text, 1, 1, 1 } }
			local who = {}
			for _, m in ipairs(c.sure) do
				who[#who + 1] = ns.ClassText(m.cls, m.name)
			end
			for _, m in ipairs(c.maybe) do
				who[#who + 1] = ns.ClassText(m.cls, m.name) .. " (if spec)"
			end
			if #who > 0 then
				lines[#lines + 1] = { "In your group: " .. table.concat(who, ", "), 1, 0.82, 0 }
			end
			local by = {}
			for _, p in ipairs(c.e.providers) do
				by[#by + 1] = ns.ClassText(p.cls) .. (p.specs and (" (" .. specLabel(p.cls, p.specs) .. ")") or "") .. ": " .. p.name
			end
			lines[#lines + 1] = { "Brought by: " .. table.concat(by, ", "), 0.64, 0.62, 0.58 }
			lines[#lines + 1] = { c.e.scope == "party" and "Reaches the caster's group only." or c.e.scope == "target" and "On one target." or "Reaches the whole raid.", 0.64, 0.62, 0.58 }
			UI.TextTooltip(self, c.e.name, lines)
		end)
		row:HookScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		return row
	end, function(row, c)
		row.item = c
		local header = UI.HeaderRow(row)
		if c.header then
			header:SetText(c.header)
			header:Show()
			row.rule:Show()
			row.state:Hide()
			row.name:Hide()
			row.cover:Hide()
			row:EnableMouse(false)
			return
		end
		header:Hide()
		row.rule:Hide()
		row.name:Show()
		row.cover:Show()
		row:EnableMouse(true)
		row.name:SetText(c.e.name)
		if c.state == "other" then
			-- Alone and not yours: who brings it.
			row.state:Hide()
			row.name:SetTextColor(unpack(ns.RGB.mist))
			row.cover:SetText(providerClasses(c.e))
		else
			local m = STATE_MARK[c.state]
			row.state:SetTexture(UI.MEDIA .. m[1] .. ".tga")
			row.state:SetVertexColor(m[2][1], m[2][2], m[2][3], 1)
			row.state:SetSize(m[3], m[3])
			row.state:Show()
			row.name:SetTextColor(unpack(ns.RGB.white))
			if c.state == "none" then
				row.cover:SetText(ns.Hex(ns.HEX.red, "missing") .. "   " .. providerClasses(c.e))
			else
				row.cover:SetText(ns.Hex(c.state == "full" and ns.HEX.green or ns.HEX.gold, c.text))
			end
		end
	end, function(c)
		return c.header and 38 or 32
	end)
	frame.card = card
	frame.note = UI.Text(frame, 11, ns.RGB.fog, { wrap = true })
	frame.note:SetPoint("BOTTOMLEFT", 2, 0)
	frame.note:SetPoint("BOTTOMRIGHT", -2, 0)
	frame.note:SetText("Grimoire sees classes, not specs: a buff only some specs bring shows as \"if the spec is right\". Forever made several debuffs personal, so stacking players for Shadow Weaving, Improved Scorch, Winter's Chill or Improved Shadow Bolt no longer helps others.")

	function frame:Update()
		local members = roster()
		self.card:ClearAllPoints()
		self.card:SetPoint("TOPLEFT", 0, 0)
		self.card:SetPoint("BOTTOMRIGHT", 0, math.ceil(self.note:GetStringHeight()) + 14)
		self.list:Layout()
		self.list:SetData(coverage(members), true)
	end
end

ns.AddTab({
	key = "raid",
	label = "Raid check",
	icon = "Spell_Holy_PrayerOfFortitude",
	order = 7,
	lede = function()
		return whoLine()
	end,
	build = build,
	show = function(frame)
		frame:Update()
	end,
})
