-- Leveling: your route from 1 to 60 step by step (the guide window follows it), and where to quest at any level.
local _, ns = ...
local UI = ns.UI
local Guide = ns.Guide

local view = { mode = "route", level = nil, faction = nil }
local page
local TERRITORY = { [0] = "Alliance", [1] = "Horde", [2] = "Contested", [3] = "Sanctuary", [4] = "PvP" }
local KIND_HEX = {
	[Guide.ACCEPT] = ns.HEX.gold,
	[Guide.TURNIN] = ns.HEX.green,
	[Guide.DO] = ns.HEX.white,
	[Guide.ZONE] = ns.HEX.blue,
	[Guide.FLY] = ns.HEX.blue,
	[Guide.BOAT] = ns.HEX.blue,
	[Guide.FLIGHTPATH] = ns.HEX.blue,
	[Guide.TRAIN] = ns.HEX.gold,
	[Guide.GRIND] = ns.HEX.red,
	[Guide.HEARTH] = ns.HEX.blue,
	[Guide.BIND] = ns.HEX.blue,
	[Guide.TELEPORT] = ns.HEX.blue,
}

-- Where to quest at your level (the second view) ---------------------------------------------------------------------

local function zoneText(z)
	local parts = { ns.Hex(ns.HEX.white, z.name), ns.Hex(ns.HEX.mist, ns.Levels(z.lo, z.hi)) }
	if TERRITORY[z.t] then
		parts[#parts + 1] = ns.Hex(ns.HEX.fog, TERRITORY[z.t])
	end
	if z.new then
		parts[#parts + 1] = ns.Hex(ns.HEX.new, "new in Forever")
	end
	return table.concat(parts, "   ")
end

local function zoneBlocks()
	local level, faction = view.level, view.faction
	local out = {}
	local zones, notes = ns.ZonesFor(level, faction)
	out[#out + 1] = { "card" }
	out[#out + 1] = { "h", "Level " .. level .. ", " .. (faction == "horde" and "Horde" or "Alliance") }
	if #zones == 0 then
		out[#out + 1] = { "p", "No questing zones listed for this level." }
	end
	for _, z in ipairs(zones) do
		out[#out + 1] = { "li", zoneText(z) }
	end
	for _, note in ipairs(notes) do
		out[#out + 1] = { "note", note }
	end
	out[#out + 1] = { "end" }
	local dungeons = ns.DungeonsFor(level)
	if #dungeons > 0 then
		out[#out + 1] = { "card" }
		out[#out + 1] = { "h", "Dungeons around this level" }
		for _, d in ipairs(dungeons) do
			out[#out + 1] = { "li", ns.Hex(ns.HEX.white, d.name) .. "   " .. ns.Hex(ns.HEX.mist, ns.Levels(d.lo, d.hi)) .. (d.location ~= "" and ("   " .. ns.Hex(ns.HEX.fog, d.location)) or "") .. (d.isNew and ("   " .. ns.Hex(ns.HEX.new, "new in Forever")) or "") }
		end
		out[#out + 1] = { "end" }
	end
	out[#out + 1] = { "card" }
	out[#out + 1] = { "h", "The whole road" }
	local byId = {}
	for _, z in ipairs(ns.zones) do
		byId[z.id] = z
	end
	for _, band in ipairs(ns.route) do
		local names = {}
		for _, id in ipairs(band[faction] or band.alliance) do
			if byId[id] then
				names[#names + 1] = byId[id].name
			end
		end
		local here = level >= band.lo and level <= band.hi
		out[#out + 1] = { "row", (here and ns.Hex(ns.HEX.gilt, band.lo .. " to " .. band.hi .. "\nyou are here") or (band.lo .. " to " .. band.hi)), ns.Hex(ns.HEX.white, table.concat(names, ", ")) .. "\n" .. ns.Hex(ns.HEX.mist, band.note) }
	end
	out[#out + 1] = { "note", "Zones overlap on purpose. Move on when the quests turn green; the step-by-step route is on this page's other tab." }
	out[#out + 1] = { "buttons", { { "Leveling guide", function()
		ns.OpenGuide("leveling")
	end } } }
	out[#out + 1] = { "end" }
	return out
end

-- The route (the first view) --------------------------------------------------------------------------------------

--- The route as list rows: a header where each zone visit starts, then its steps.
local function routeRows(route)
	local out = {}
	local function header(area, from)
		out[#out + 1] = { header = true, area = area, from = from, to = from, count = 0 }
		return out[#out]
	end
	local current = header(route.steps[1] and route.steps[1][4] or 0, route.steps[1] and route.steps[1][7] or 1)
	for i, step in ipairs(route.steps) do
		if step[1] == Guide.ZONE then
			current = header(step[2], step[7])
		end
		current.to = step[7]
		if step[1] == Guide.TURNIN then
			current.count = current.count + 1
		end
		-- A visit's later steps (more quests from the same person, more objectives at the same camp) go under its first.
		out[#out + 1] = { index = i, step = step, cont = (Guide.Group(i)) ~= i }
	end
	return out
end

local function stepTooltip(row)
	local item = row.item
	if not item or item.header then
		return
	end
	local step = item.step
	local main, sub = Guide.Describe(step)
	local lines = {}
	if sub and sub ~= "" then
		lines[#lines + 1] = sub
	end
	lines[#lines + 1] = { Guide.ZoneName(step[4]) .. string.format("  %.1f, %.1f", step[5], step[6]) .. ", at level " .. step[7], 0.64, 0.62, 0.58 }
	lines[#lines + 1] = { "Click to make it your current step. Right-click to skip it, or take the skip back.", 0.47, 0.45, 0.42 }
	UI.TextTooltip(row, main, lines)
end

local function buildRoute(frame)
	local holder = CreateFrame("Frame", nil, frame)
	holder:SetPoint("TOPLEFT", 0, -46)
	holder:SetPoint("BOTTOMRIGHT")
	frame.routeView = holder

	-- Now: the current step, with the buttons that move through the route.
	local now = UI.Card(holder, 12)
	now:SetPoint("TOPLEFT")
	now:SetPoint("TOPRIGHT")
	now:SetHeight(96)
	frame.now = now
	now.kind = UI.Text(now, 11, UI.colors.gilt, { weight = "bold" })
	now.kind:SetPoint("TOPLEFT", 18, -15)
	now.where = UI.Text(now, 11, ns.RGB.fog)
	now.where:SetPoint("LEFT", now.kind, "RIGHT", 8, 0)
	now.title = UI.Text(now, 15, ns.RGB.white, { weight = "bold" })
	now.title:SetPoint("TOPLEFT", now.kind, "BOTTOMLEFT", 0, -6)
	now.sub = UI.Text(now, 12, ns.RGB.text, { wrap = true })
	now.sub:SetPoint("TOPLEFT", now.title, "BOTTOMLEFT", 0, -6)
	if now.sub.SetMaxLines then
		now.sub:SetMaxLines(2)
	end
	-- Both lines stop short of the buttons.
	now:SetScript("OnSizeChanged", function(self, w)
		local room = math.max(100, (w or self:GetWidth() or 0) - 18 - 270)
		self.title:SetWidth(room)
		self.sub:SetWidth(room)
	end)
	now.skip = UI.Button(now, "Skip", 70, 28, function()
		Guide.Next()
	end)
	now.skip:SetPoint("RIGHT", -18, 0)
	now.skip.tip = "Skip this step and go on to the next."
	now.back = UI.Button(now, "Back", 70, 28, function()
		Guide.Back()
	end)
	now.back:SetPoint("RIGHT", now.skip, "LEFT", -8, 0)
	now.back.tip = "Show the step before this one."
	now.done = UI.Button(now, "Done", 70, 28, function()
		local i = Guide.Index()
		if i then
			Guide.Complete(i)
		end
	end, "primary")
	now.done:SetPoint("RIGHT", now.back, "LEFT", -8, 0)
	now.done.tip = "Mark this step done. Most steps tick themselves: quests, levels and zones as they happen, flights and boats by where you are."

	local card
	card, frame.list = UI.CardList(holder, 30, function(list)
		local row = UI.Row(list)
		row.level = UI.Text(row, 11, ns.RGB.fog, { justify = "RIGHT" })
		row.level:SetPoint("LEFT", 6, 0.5)
		row.level:SetWidth(28)
		row.check = UI.Mark(row, "Check", 13, ns.RGB.green)
		row.check:SetPoint("LEFT", 40, 0)
		row.kind = UI.Text(row, 11, ns.RGB.gold, { weight = "bold" })
		row.kind:SetPoint("LEFT", 58, 0.5)
		row.kind:SetWidth(78)
		row.text = UI.Text(row, 12, ns.RGB.text)
		row.text:SetPoint("LEFT", 140, 0.5)
		row.text:SetPoint("RIGHT", -150, 0.5)
		row.where = UI.Text(row, 11, ns.RGB.fog, { justify = "RIGHT" })
		row.where:SetPoint("RIGHT", -12, 0.5)
		row.where:SetWidth(132)
		row.header = UI.Text(row, 13, ns.RGB.white, { weight = "bold" })
		row.header:SetPoint("BOTTOMLEFT", 12, 9)
		row.headerNote = UI.Text(row, 11, ns.RGB.mist, { justify = "RIGHT" })
		row.headerNote:SetPoint("BOTTOMRIGHT", -12, 9.5)
		row.rule = UI.Rule(row)
		row.rule:SetPoint("BOTTOMLEFT", 12, 3)
		row.rule:SetPoint("BOTTOMRIGHT", -12, 3)
		row:HookScript("OnEnter", stepTooltip)
		row:HookScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		row:SetScript("OnClick", function(self, button)
			local item = self.item
			if not item or item.header then
				return
			end
			if button == "RightButton" then
				Guide.ToggleSkip(item.index)
			else
				Guide.Set(item.index)
				if not (ns.GuideFrame and ns.GuideFrame:IsShown()) then
					ns.db.guideShown = true
					ns.char.guide.keep = true
					ns.UpdateGuideFrame()
				end
			end
		end)
		return row
	end, function(row, item)
		row.item = item
		local headerRow = item.header and true or false
		row.header:SetShown(headerRow)
		row.headerNote:SetShown(headerRow)
		row.rule:SetShown(headerRow)
		row.level:SetShown(not headerRow)
		row.kind:SetShown(not headerRow)
		row.text:SetShown(not headerRow)
		row.where:SetShown(not headerRow)
		if headerRow then
			row.check:Hide()
			row:SetSelected(false)
			row:EnableMouse(false)
			row.header:SetText(Guide.ZoneName(item.area))
			local levels = item.from == item.to and ("level " .. item.from) or ("levels " .. item.from .. " to " .. item.to)
			row.headerNote:SetText(levels .. (item.count > 0 and (", " .. item.count .. (item.count == 1 and " quest" or " quests")) or ""))
			return
		end
		row:EnableMouse(true)
		local step = item.step
		local current = Guide.Index()
		local skipped = Guide.IsSkipped(item.index)
		local past = item.index < (current or 1)
		row.level:SetText(item.cont and "" or step[7])
		row.kind:SetText(ns.Hex(skipped and ns.HEX.fog or KIND_HEX[step[1]] or ns.HEX.gold, Guide.KindLabel(step) or ""))
		local text = Guide.Summary(step)
		if skipped then
			row.text:SetText(ns.Hex(ns.HEX.fog, text))
			row.where:SetText(ns.Hex(ns.HEX.fog, "skipped"))
		else
			row.text:SetText(past and ns.Hex(ns.HEX.mist, text) or text)
			-- A quest to hand in says the experience it gives, in the column the guide window keeps it in; where each
			-- step is shows in its tooltip.
			local xp = step[1] == Guide.TURNIN and not past and Guide.QuestXpText(step[2])
			row.where:SetText(xp and ns.Hex(ns.HEX.xp, xp) or "")
		end
		row.check:SetShown(past and not skipped)
		row:SetSelected(item.index == current)
	end, function(item)
		return item.header and 40 or 30
	end)
	card:SetPoint("TOPLEFT", now, "BOTTOMLEFT", 0, -12)
	card:SetPoint("BOTTOMRIGHT")
end

local function updateNow(frame)
	local now = frame.now
	local room = math.max(100, (now:GetWidth() or 0) - 18 - 270)
	now.title:SetWidth(room)
	now.sub:SetWidth(room)
	local i, step, route = Guide.Index()
	if not i then
		now.kind:SetText("")
		now.title:SetText("No route for this character")
		now.sub:SetText("")
		return
	end
	local waitTitle, waitText = Guide.Waiting()
	if waitTitle then
		now.kind:SetText(ns.Hex(ns.HEX.gold, "NOT YET"))
		now.where:SetText("")
		now.title:SetText(waitTitle)
		now.sub:SetText(waitText)
		now.back:SetEnabled(false)
		now.skip:SetEnabled(false)
		return
	end
	local hex = KIND_HEX[step[1]] or ns.HEX.gold
	now.kind:SetText(ns.Hex(hex, (Guide.KindLabel(step) or ""):upper()))
	now.where:SetText(string.format("Step %d of %d", i, #route.steps) .. "   " .. Guide.ZoneName(step[4]))
	local main, sub = Guide.Describe(step)
	now.title:SetText(main)
	if step[1] == Guide.DO then
		local parts = {}
		for _, o in ipairs(Guide.Objectives(step)) do
			local c = o.done and ns.HEX.green or ns.HEX.text
			parts[#parts + 1] = ns.Hex(c, o.text .. (o.kind ~= 4 and (" " .. o.have .. "/" .. o.need) or ""))
		end
		now.sub:SetText(table.concat(parts, ns.Hex(ns.HEX.fog, "   ")))
	elseif step[1] == Guide.GRIND then
		local left, count = Guide.GrindText(step)
		now.sub:SetText((sub or "") .. (left and ns.Hex(ns.HEX.fog, "   ") .. left .. (count ~= "" and (": " .. count) or "") or ""))
	else
		now.sub:SetText(sub or "")
	end
	-- The rest of the visit: what else to do with the same person, or at the same camp.
	local first, last = Guide.Group(i)
	local also = {}
	for j = first, last do
		if j ~= i and not Guide.IsDone(j, route.steps[j]) then
			also[#also + 1] = (Guide.Describe(route.steps[j]))
		end
	end
	if #also > 0 then
		local line = ns.Hex(ns.HEX.fog, "Also here: ") .. table.concat(also, ns.Hex(ns.HEX.fog, "  ·  "))
		local text = now.sub:GetText()
		now.sub:SetText((text and text ~= "") and (text .. "\n" .. line) or line)
	end
	now.back:SetEnabled(i > 1)
	now.skip:SetEnabled(i < #route.steps)
end

-- The page --------------------------------------------------------------------------------------------------------

local function build(frame)
	page = frame
	-- Top bar: the guide window, your route (your race and class's, kept with you: nothing to pick), and the two views.
	frame.window = UI.Button(frame, "Guide window", 130, 30, function()
		local shown = ns.GuideFrame and ns.GuideFrame:IsShown()
		ns.db.guideShown = not shown
		ns.char.guide = ns.char.guide or {}
		ns.char.guide.keep = not shown or nil
		ns.UpdateGuideFrame()
		frame:Update()
	end)
	frame.window:SetPoint("TOPLEFT", 0, 0)
	frame.window.tip = "The small window with the arrow, the distance and the step to do now. Drag it anywhere."
	frame.routeName = UI.Text(frame, 13, ns.RGB.mist, { weight = "medium" })
	frame.routeName:SetPoint("LEFT", frame.window, "RIGHT", 14, 0)
	frame.modes = UI.Tabs(frame, { { "route", "Step by step" }, { "zones", "Where to quest" } }, function(key)
		view.mode = key
		frame:Update(true)
	end)
	frame.modes:SetPoint("TOPRIGHT", 0, 1)

	buildRoute(frame)

	-- Zones for your level and your side.
	local zones = CreateFrame("Frame", nil, frame)
	zones:SetPoint("TOPLEFT", 0, -46)
	zones:SetPoint("BOTTOMRIGHT")
	frame.zoneView = zones
	frame.doc = UI.Document(zones)
	frame.doc:SetAllPoints()

	function frame:Update(reveal)
		self.modes:Select(view.mode)
		local routeMode = view.mode == "route"
		self.routeView:SetShown(routeMode)
		self.zoneView:SetShown(not routeMode)
		self.window:SetShown(routeMode)
		self.routeName:SetShown(routeMode)
		if routeMode then
			local route = Guide.Route()
			self.routeName:SetText(route and (route.name .. ns.Hex(ns.HEX.fog, "   from " .. route.start .. " to 60")) or "")
			local shown = ns.GuideFrame and ns.GuideFrame:IsShown() or false
			self.window:SetLabel(shown and "Hide guide window" or "Show guide window")
			self.window:FitWidth(130)
			self.window:SetKind((not shown) and "primary" or nil)
			updateNow(self)
			if route then
				if self.rowsFor ~= route.id then
					self.rows = routeRows(route)
					self.rowsFor = route.id
					reveal = true
				end
				self.list:SetData(self.rows, true)
				-- The current step in sight: scrolled to on opening, and kept in view as the guide moves on.
				local i = Guide.Index()
				for n, r in ipairs(self.rows) do
					if r.index == i then
						if reveal then
							self.list:ScrollTo(math.max(1, n - 3))
						else
							self.list:Reveal(n)
						end
						break
					end
				end
			end
		else
			view.level, view.faction = math.min(60, ns.player.level or 1), ns.player.faction or "alliance"
			self.doc:SetBlocks(zoneBlocks())
		end
	end
end

ns.AddTab({
	key = "leveling",
	label = "Leveling",
	icon = "INV_Misc_Map02",
	order = 4,
	lede = "Your route from 1 to 60, step by step, with an arrow to every place: quests, flights, boats, trainers.",
	build = build,
	show = function(frame)
		ns.UpdatePlayer()
		frame:Update(true)
	end,
})

ns.Listen("GUIDE", function()
	if page and ns.IsOpen("leveling") then
		page:Update()
	end
end)
