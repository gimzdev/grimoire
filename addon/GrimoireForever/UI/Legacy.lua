-- The Legacy page: the account's challenges (ticked by hand, or by the game for the character you play) and this
-- character's perk plan on the three trees, with the site's own plan links in and out.
local _, ns = ...
local UI = ns.UI
local L = ns.Legacy

local CELL, GAP_X, GAP_Y = 36, 18, 12
local TREE_W, TREE_H, HEAD = 232, 244, 40
local TREE_GAP = 16
local GRID_W = 4 * CELL + 3 * GAP_X
local PAD_X = math.floor((TREE_W - GRID_W) / 2)
local PAD_Y = 12

local function cellX(col)
	return PAD_X + (col - 1) * (CELL + GAP_X)
end
local function cellY(row)
	return HEAD + PAD_Y + (row - 1) * (CELL + GAP_Y)
end

local function colorOf(c)
	return c[1], c[2], c[3]
end

-- Challenges ----------------------------------------------------------------------------------------------------

local function stepsWhere(test)
	local out = {}
	for _, c in ipairs(ns.legacy.challenges) do
		if test(c) then
			out[#out + 1] = c
		end
	end
	table.sort(out, function(a, b)
		return (a.step or 0) < (b.step or 0)
	end)
	return out
end

--- What a challenge asks, in a line. The game lists a raid's encounters under its text ("Defeat the following
--- encounters in ..."): every boss there.
local function goal(c)
	if c.raid then
		local the = c.desc:find(" in the ", 1, true) and "the " or ""
		return (c.key == "onyxia" and "Defeat Onyxia in " or "Defeat every boss in ") .. the .. c.raid .. "."
	end
	return c.desc
end

--- The rows of the challenge list: section headers, ladders (a check per step) and single challenges.
local function challengeRows()
	local rows = {}
	local function header(group, name)
		local done, total = L.CountDone(group)
		rows[#rows + 1] = { kind = "header", text = name, right = done .. " of " .. total }
	end
	header("classes", "Classes")
	for _, slug in ipairs(ns.classOrder or {}) do
		local steps = stepsWhere(function(c)
			return c.cls == slug
		end)
		if #steps > 0 then
			local cls = ns.classes[slug]
			local tags = {}
			for i, s in ipairs(steps) do
				tags[i] = "level " .. s.level
			end
			rows[#rows + 1] = { kind = "ladder", icon = cls and cls.icon, label = ns.ClassText(slug), steps = steps, tags = tags }
		end
	end
	header("crafting", "Crafting")
	local profs, seen = {}, {}
	for _, c in ipairs(ns.legacy.challenges) do
		if c.prof and not seen[c.prof] then
			seen[c.prof] = true
			profs[#profs + 1] = c
		end
	end
	for _, first in ipairs(profs) do
		local steps = stepsWhere(function(c)
			return c.prof == first.prof
		end)
		local tags = {}
		for i, s in ipairs(steps) do
			tags[i] = "skill " .. s.skill
		end
		rows[#rows + 1] = { kind = "ladder", icon = first.icon, label = first.profName, steps = steps, tags = tags }
	end
	header("pvp", "PvP")
	local ranks = stepsWhere(function(c)
		return c.ladder == "rank"
	end)
	local rankTags = {}
	for i, s in ipairs(ranks) do
		rankTags[i] = tostring(s.rank)
	end
	rows[#rows + 1] = { kind = "ladder", icon = "INV_BannerPVP_02", label = "Honor rank", steps = ranks, tags = rankTags }
	local weeks = stepsWhere(function(c)
		return c.ladder == "season"
	end)
	local weekTags = {}
	for i, s in ipairs(weeks) do
		weekTags[i] = "week " .. s.week
	end
	rows[#rows + 1] = { kind = "ladder", icon = "INV_Misc_Note_02", label = "Field of Honor", steps = weeks, tags = weekTags }
	for _, c in ipairs(ns.legacy.challenges) do
		if c.factions then
			rows[#rows + 1] = { kind = "single", c = c, sub = ns.Hex("a9c8f5", c.factions.alliance) .. " or " .. ns.Hex("f5a196", c.factions.horde) }
		end
	end
	header("dungeons", "Dungeons and raids")
	for _, c in ipairs(ns.legacy.challenges) do
		if c.dungeons then
			rows[#rows + 1] = { kind = "single", c = c, sub = "Levels " .. c.band .. ": the final boss of " .. #c.dungeons .. " dungeons. Hover for the list." }
		elseif c.raid then
			rows[#rows + 1] = { kind = "single", c = c, sub = goal(c) }
		end
	end
	header("other", "Other")
	for _, c in ipairs(ns.legacy.challenges) do
		if c.group == "other" then
			rows[#rows + 1] = { kind = "single", c = c, sub = c.desc, icon = c.icon }
		end
	end
	return rows
end

local function challengeTooltip(owner, c)
	local lines = { { goal(c), 1, 0.82, 0 } }
	if c.dungeons then
		for _, d in ipairs(c.dungeons) do
			lines[#lines + 1] = { "  " .. d, 0.9, 0.89, 0.84 }
		end
	end
	if c.factions and not (c.factions.allianceId or c.factions.hordeId) then
		lines[#lines + 1] = { "Tick it by hand: the game does not tell add-ons about this battleground's reputations yet.", 0.64, 0.62, 0.58 }
	end
	if c.ladder then
		lines[#lines + 1] = { "Ticking it ticks the steps before it.", 0.64, 0.62, 0.58 }
	end
	local by = L.SeenOn(c.key)
	if by and L.Done(c.key) then
		lines[#lines + 1] = { "Seen in game on " .. by .. ".", 0.53, 0.83, 0.42 }
	end
	UI.TextTooltip(owner, c.name, lines)
end

--- A check box for one challenge, with its tag (a level, a skill, a rank) beside it.
local function checkBox(parent)
	local b = UI.Check(parent, 18)
	b.tag = UI.Text(parent, 11, ns.RGB.mist)
	b.tag:SetPoint("LEFT", b, "RIGHT", 8, 0.5)
	b:HookScript("OnEnter", function(self)
		if self.c then
			challengeTooltip(self, self.c)
		end
	end)
	b:HookScript("OnLeave", function()
		GameTooltip:Hide()
	end)
	b:SetScript("OnClick", function(self)
		if self.c then
			L.Toggle(self.c.key)
		end
	end)
	function b:Bind(c, tag)
		self.c = c
		local on = L.Done(c.key)
		self:SetOn(on)
		self.tag:SetText(tag or "")
		self.tag:SetTextColor(colorOf(on and ns.RGB.white or ns.RGB.mist))
		self:Show()
		self.tag:Show()
	end
	function b:Clear()
		self.c = nil
		self:Hide()
		self.tag:Hide()
	end
	return b
end

local function buildChallenges(view)
	local card
	card, view.list = UI.CardList(view, 36, function(list)
		local row = UI.Row(list)
		row.icon = UI.Icon(row, 22)
		row.icon:SetPoint("LEFT", 12, 0)
		row.label = UI.Text(row, 12.5, ns.RGB.white, { weight = "medium" })
		row.label:SetPoint("LEFT", 44, 0.5)
		row.label:SetWidth(176)
		row.checks = {}
		for i = 1, 5 do
			row.checks[i] = checkBox(row)
		end
		row.title = UI.Text(row, 12.5, ns.RGB.white, { weight = "medium" })
		row.title:SetPoint("TOPLEFT", 44, -9)
		row.title:SetPoint("TOPRIGHT", -12, -9)
		row.sub = UI.Text(row, 11, ns.RGB.mist)
		row.sub:SetPoint("TOPLEFT", 44, -28)
		row.sub:SetPoint("TOPRIGHT", -12, -28)
		row.right = UI.Text(row, 11, ns.RGB.fog, { justify = "RIGHT" })
		row.right:SetPoint("BOTTOMRIGHT", -12, 10)
		row:HookScript("OnEnter", function(self)
			if self.item and self.item.kind == "single" then
				challengeTooltip(self, self.item.c)
			end
		end)
		row:HookScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		row:SetScript("OnClick", function(self)
			if self.item and self.item.kind == "single" then
				L.Toggle(self.item.c.key)
			end
		end)
		return row
	end, function(row, item)
		row.item = item
		local header = UI.HeaderRow(row)
		for _, b in ipairs(row.checks) do
			b:Clear()
		end
		row.icon:Hide()
		row.label:Hide()
		row.title:Hide()
		row.sub:Hide()
		row.right:Hide()
		if item.kind == "header" then
			header:SetText(item.text)
			header:Show()
			row.rule:Show()
			row.right:SetText(item.right)
			row.right:Show()
			row:EnableMouse(false)
			return
		end
		header:Hide()
		row.rule:Hide()
		row:EnableMouse(true)
		if item.kind == "ladder" then
			if item.icon then
				row.icon:SetIcon(ns.Icon(item.icon))
				row.icon:Show()
			end
			row.label:SetText(item.label)
			row.label:Show()
			local step = #item.steps > 3 and 94 or 124
			for i, c in ipairs(item.steps) do
				local b = row.checks[i]
				if b then
					b:ClearAllPoints()
					b:SetPoint("LEFT", row, "LEFT", 236 + (i - 1) * step, 0)
					b:Bind(c, item.tags[i])
				end
			end
		else
			local c = item.c
			local b = row.checks[1]
			b:ClearAllPoints()
			b:SetPoint("LEFT", row, "LEFT", 14, 0)
			b:Bind(c, "")
			row.title:SetText(c.name)
			row.title:SetTextColor(colorOf(L.Done(c.key) and ns.RGB.white or ns.RGB.text))
			row.title:Show()
			row.sub:SetText(item.sub or "")
			row.sub:Show()
		end
	end, function(item)
		if item.kind == "header" then
			return 40
		end
		return item.kind == "single" and 52 or 36
	end)
	card:SetPoint("TOPLEFT", 0, 0)
	card:SetPoint("BOTTOMRIGHT", 0, 42)
	view.note = UI.Text(view, 11, ns.RGB.fog, { wrap = true })
	view.note:SetPoint("BOTTOMLEFT", 2, 2)
	view.note:SetPoint("BOTTOMRIGHT", -140, 2)
	view.note:SetText("Levels, tradeskills and Classic battleground reputations tick themselves on each character you log in. Tick the rest by hand: they are kept for your whole account.")
	view.clear = UI.Button(view, "Clear all", 120, 26, function(self)
		if self.armed then
			self.armed = false
			self:SetLabel("Clear all")
			self:SetSelected(false)
			L.ClearAll()
		else
			self.armed = true
			self:SetLabel("Click to confirm")
			self:SetSelected(true)
			if C_Timer and C_Timer.After then
				C_Timer.After(4, function()
					if self.armed then
						self.armed = false
						self:SetLabel("Clear all")
						self:SetSelected(false)
					end
				end)
			end
		end
	end)
	view.clear:SetPoint("BOTTOMRIGHT", 0, 2)
	function view:Update()
		self.list:SetData(challengeRows(), true)
	end
end

-- Perks ---------------------------------------------------------------------------------------------------------

local function perkTooltip(owner, perk, tree, ranks)
	local rank = ranks[perk.id] or 0
	GameTooltip:SetOwner(owner, "ANCHOR_RIGHT")
	GameTooltip:SetText(perk.name, 1, 1, 1)
	GameTooltip:AddLine("Rank " .. rank .. "/" .. perk.max, 0.64, 0.62, 0.58)
	if perk.gate > 0 and not L.GateMet(tree, ranks, perk) then
		GameTooltip:AddLine("Requires " .. perk.gate .. " points in " .. tree.name, 1, 0.13, 0.13)
	end
	if perk.req and not L.ReqMet(ranks, perk) then
		local req = L.Perk(perk.req)
		GameTooltip:AddLine("Requires " .. req.max .. " point" .. (req.max > 1 and "s" or "") .. " in " .. req.name, 1, 0.13, 0.13)
	end
	if perk.active and #perk.active > 0 then
		GameTooltip:AddDoubleLine(perk.active[1] or "", perk.active[2] or "", 1, 1, 1, 1, 1, 1)
	end
	GameTooltip:AddLine(perk.ranks[math.max(1, rank)], 1, 0.82, 0, true)
	if rank > 0 and rank < perk.max then
		GameTooltip:AddLine(" ")
		GameTooltip:AddLine("Next rank:", 1, 1, 1)
		GameTooltip:AddLine(perk.ranks[rank + 1], 1, 0.82, 0, true)
	end
	GameTooltip:AddLine("Click to add a point, right-click to take one back.", 0.47, 0.45, 0.42, true)
	GameTooltip:Show()
end

local GILT = UI.colors.gilt
local LIT = { 0.95, 0.71, 0.25, 0.9 }
local DARK = { 0.17, 0.19, 0.22, 1 }

local function treePanel(view, parent, tree)
	local panel = UI.Card(parent)
	panel:SetSize(TREE_W, TREE_H)
	panel.tree = tree
	local icon = UI.Icon(panel, 22)
	icon:SetPoint("TOPLEFT", 12, -9)
	icon:SetIcon(ns.Icon(tree.icon))
	local name = UI.Text(panel, 13, ns.RGB.white, { weight = "bold" })
	name:SetPoint("LEFT", icon, "RIGHT", 9, 0.5)
	name:SetText(tree.name)
	panel.points = UI.Text(panel, 16, ns.RGB.gilt, { weight = "bold", justify = "RIGHT" })
	panel.points:SetPoint("TOPRIGHT", -14, -11)
	local rule = UI.Rule(panel)
	rule:SetPoint("TOPLEFT", 1, -HEAD)
	rule:SetPoint("TOPRIGHT", -1, -HEAD)

	-- Arrows from a prerequisite to the perk that needs it: a line and the site's chevron at its end.
	panel.arrows = {}
	local byId = {}
	for _, p in ipairs(tree.perks) do
		byId[p.id] = p
	end
	for _, p in ipairs(tree.perks) do
		local from = p.req and byId[p.req]
		if from then
			local a = { from = from, to = p }
			local y1 = cellY(from.row) + CELL / 2
			a.line = panel:CreateTexture(nil, "BORDER")
			a.line:SetTexture(UI.WHITE)
			a.head = UI.Mark(panel, "Chevron", 12, DARK, "BORDER")
			if from.row == p.row then
				local x1 = cellX(from.col) + CELL + 3
				local x2 = cellX(p.col) - 3
				a.line:SetPoint("TOPLEFT", panel, "TOPLEFT", x1, -(y1 - 1))
				a.line:SetSize(math.max(1, x2 - x1 - 3), 2)
				a.head:SetPoint("CENTER", panel, "TOPLEFT", x2 - 4, -y1)
				if a.head.SetRotation then
					a.head:SetRotation(math.pi / 2)
				end
			else
				local x = cellX(p.col) + CELL / 2
				local top = cellY(from.row) + CELL + 3
				local bottom = cellY(p.row) - 3
				a.line:SetPoint("TOPLEFT", panel, "TOPLEFT", x - 1, -top)
				a.line:SetSize(2, math.max(1, bottom - top - 3))
				a.head:SetPoint("CENTER", panel, "TOPLEFT", x, -(bottom - 4))
			end
			panel.arrows[#panel.arrows + 1] = a
		end
	end

	-- Slots the game keeps for later perks.
	for _, s in ipairs(tree.slots) do
		local f = CreateFrame("Frame", nil, panel)
		f:SetSize(CELL, CELL)
		f:SetPoint("TOPLEFT", cellX(s[2]), -cellY(s[1]))
		UI.Surface(f, 8, { 0, 0, 0, 0.25 }, { 1, 1, 1, 0.08 })
		local q = UI.Text(f, 15, ns.RGB.fog, { weight = "medium", justify = "CENTER" })
		q:SetPoint("CENTER", 0, 0.5)
		q:SetText("?")
		f:EnableMouse(true)
		f:SetScript("OnEnter", function(self)
			UI.TextTooltip(self, "Unknown", { "To be added in a future update." })
		end)
		f:SetScript("OnLeave", function()
			GameTooltip:Hide()
		end)
	end

	panel.cells = {}
	for _, p in ipairs(tree.perks) do
		local b = CreateFrame("Button", nil, panel)
		b:SetSize(CELL, CELL)
		b:SetPoint("TOPLEFT", cellX(p.col), -cellY(p.row))
		-- The state shows in the edge: gold when full, green while it takes points, faint when locked.
		b.edge = b:CreateTexture(nil, "BACKGROUND")
		b.edge:SetTexture(UI.MEDIA .. "IconShape.tga")
		b.edge:SetAllPoints()
		b.icon = b:CreateTexture(nil, "ARTWORK")
		b.icon:SetPoint("TOPLEFT", 2, -2)
		b.icon:SetPoint("BOTTOMRIGHT", -2, 2)
		b.icon:SetTexCoord(0.07, 0.93, 0.07, 0.93)
		b.icon:SetTexture(ns.Icon(p.icon))
		if b.CreateMaskTexture and b.icon.AddMaskTexture then
			local mask = b:CreateMaskTexture(nil, "ARTWORK")
			mask:SetTexture(UI.MEDIA .. "IconMask.tga", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
			mask:SetAllPoints(b.icon)
			b.icon:AddMaskTexture(mask)
		end
		-- The rank in a small dark pill over the corner.
		b.badge = CreateFrame("Frame", nil, b)
		b.badge:SetSize(28, 15)
		b.badge:SetPoint("BOTTOMRIGHT", 8, -6)
		UI.Surface(b.badge, 7.5, { 0.05, 0.055, 0.07, 0.95 }, { 1, 1, 1, 0.1 })
		b.rank = UI.Text(b.badge, 9.5, ns.RGB.green, { weight = "bold", justify = "CENTER" })
		b.rank:SetPoint("CENTER", 0, 0.5)
		b.perk = p
		b:RegisterForClicks("LeftButtonUp", "RightButtonUp")
		b:SetScript("OnClick", function(self, button)
			if button == "RightButton" or (IsShiftKeyDown and IsShiftKeyDown()) then
				view:Remove(self.perk.id)
			else
				view:Add(self.perk.id)
			end
			perkTooltip(self, self.perk, tree, view.ranks)
		end)
		b:SetScript("OnEnter", function(self)
			perkTooltip(self, self.perk, tree, view.ranks)
		end)
		b:SetScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		panel.cells[#panel.cells + 1] = b
	end

	function panel:Update(ranks, full)
		self.points:SetText(L.TreeSpent(self.tree, ranks))
		for _, b in ipairs(self.cells) do
			local p = b.perk
			local rank = ranks[p.id] or 0
			local state
			if rank >= p.max then
				state = "max"
			elseif rank > 0 then
				state = "some"
			elseif L.Open(ranks, p.id) and not full then
				state = "open"
			else
				state = "locked"
			end
			if state == "max" then
				b.edge:SetVertexColor(GILT[1], GILT[2], GILT[3], 1)
				b.rank:SetTextColor(unpack(UI.colors.giltBright))
			elseif state == "locked" then
				b.edge:SetVertexColor(1, 1, 1, 0.12)
				b.rank:SetTextColor(unpack(ns.RGB.fog))
			else
				b.edge:SetVertexColor(0.61, 0.8, 0.45, 1)
				b.rank:SetTextColor(unpack(ns.RGB.green))
			end
			if b.icon.SetDesaturated then
				b.icon:SetDesaturated(state == "locked")
			end
			local shade = state == "locked" and 0.45 or 1
			b.icon:SetVertexColor(shade, shade, shade)
			b.rank:SetText(rank .. "/" .. p.max)
		end
		for _, a in ipairs(self.arrows) do
			local lit = (ranks[a.from.id] or 0) >= a.from.max
			local c = lit and LIT or DARK
			a.line:SetVertexColor(c[1], c[2], c[3], c[4])
			a.head:SetVertexColor(c[1], c[2], c[3], c[4])
		end
	end
	return panel
end

local function buildPerks(view)
	view.ranks, view.order = {}, {}

	view.points = UI.Text(view, 13, ns.RGB.text, { weight = "medium" })
	view.points:SetPoint("TOPLEFT", 2, -2)
	view.status = UI.Text(view, 11, ns.RGB.mist)
	view.status:SetPoint("TOPLEFT", 2, -24)
	view.status:SetPoint("TOPRIGHT", -4, -24)

	-- The buttons line up from the right; one that is hidden leaves no gap.
	local row = {}
	local function button(label, onClick)
		local b = UI.Button(view, label, 60, 26, onClick)
		b:FitWidth(54)
		row[#row + 1] = b
		return b
	end
	local function layout()
		local x = 0
		for _, b in ipairs(row) do
			if b:IsShown() then
				b:ClearAllPoints()
				b:SetPoint("TOPRIGHT", -x, 0)
				x = x + b:GetWidth() + 6
			end
		end
	end
	view.fromGame = button("From game", function()
		local ranks = L.FromGame()
		if ranks then
			L.SetPlan(L.OrderFor(ranks))
			ns.Print("your Legacy perks in game are loaded into the plan.")
		end
	end)
	view.fromGame.tip = "Load the perks this character has in game."
	view.paste = button("Paste link", function()
		view:ShowBox("paste")
	end)
	view.paste.tip = "Paste a plan link from wowgrimoire.app."
	view.link = button("Link", function()
		view:ShowBox("link")
	end)
	view.link.tip = "This plan as a link to open on wowgrimoire.app."
	view.reset = button("Reset", function()
		L.SetPlan({})
	end)
	view.undo = button("Undo", function()
		L.Undo()
	end)
	view.undo.tip = "Undo the last change to the plan."
	view.builds = button("Builds", function(self)
		local entries, current = {}, nil
		local mine = L.Encode(view.order)
		for _, b in ipairs(ns.legacy.builds or {}) do
			entries[#entries + 1] = { b.name, b.id }
			if b.code == mine then
				current = b.id
			end
		end
		UI.Menu(self, entries, function(id)
			for _, b in ipairs(ns.legacy.builds or {}) do
				if b.id == id then
					L.SetPlan(L.Decode(b.code))
					ns.Print("plan loaded: " .. b.name .. ".")
				end
			end
		end, 1, current)
	end)
	view.builds:AddChevron()
	view.builds:FitWidth(54)
	view.builds.tip = "Start from one of Grimoire's builds: leveling, raiding, battlegrounds or crafting."
	view.builds:SetShown(#(ns.legacy.builds or {}) > 0)
	view.Layout = layout
	layout()

	local TOP = 52
	view.trees = {}
	for i, tree in ipairs(ns.legacy.trees) do
		local panel = treePanel(view, view, tree)
		panel:SetPoint("TOPLEFT", (i - 1) * (TREE_W + TREE_GAP), -TOP)
		view.trees[i] = panel
	end

	-- The order to spend the points in, in a card under the trees.
	local orderTop = TOP + TREE_H + TREE_GAP
	local order = UI.Card(view)
	order:SetPoint("TOPLEFT", 0, -orderTop)
	order:SetPoint("TOPRIGHT", 0, -orderTop)
	order:SetHeight(92)
	view.orderCard = order
	view.orderLabel = UI.Text(order, 12.5, ns.RGB.white, { weight = "bold" })
	view.orderLabel:SetPoint("TOPLEFT", 14, -12)
	view.orderLabel:SetText("Point order")
	local orderSub = UI.Text(order, 11, ns.RGB.mist)
	orderSub:SetPoint("LEFT", view.orderLabel, "RIGHT", 10, 0)
	orderSub:SetText("Spend them in this order as you earn them.")
	view.orderIcons = {}
	for i = 1, 16 do
		local ic = UI.Icon(order, 28)
		ic:SetPoint("TOPLEFT", 14 + (i - 1) * 34, -38)
		ic.n = UI.Text(ic, 9.5, ns.RGB.fog, { weight = "medium", justify = "CENTER" })
		ic.n:SetPoint("TOP", ic, "BOTTOM", 0, -3)
		ic.n:SetText(i)
		ic:EnableMouse(true)
		ic:SetScript("OnEnter", function(self)
			if self.perk then
				UI.TextTooltip(self, "Point " .. i .. ": " .. self.perk.name, {})
			end
		end)
		ic:SetScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		view.orderIcons[i] = ic
	end
	view.orderEmpty = UI.Text(order, 11, ns.RGB.fog)
	view.orderEmpty:SetPoint("TOPLEFT", 14, -44)
	view.orderEmpty:SetText("Click a perk to add your first point.")

	-- One box for both ways: the plan's link to copy, or a link to paste (a full plan's link is 65 letters long).
	local boxY = -(orderTop + 92 + 14)
	view.box = CreateFrame("EditBox", nil, view)
	view.box:SetSize(430, 28)
	UI.Field(view.box)
	view.box:SetTextInsets(10, 10, 0, 0)
	view.box:SetMaxLetters(255)
	view.box:SetPoint("TOPLEFT", 0, boxY)
	view.box:Hide()
	view.boxNote = UI.Text(view, 11, ns.RGB.mist, { wrap = true })
	view.boxNote:SetPoint("TOPLEFT", view.box, "TOPRIGHT", 12, -7)
	view.boxNote:SetPoint("TOPRIGHT", view, "TOPRIGHT", -4, boxY - 7)
	view.box:SetScript("OnEscapePressed", function(self)
		self:ClearFocus()
		self:Hide()
		view.boxNote:SetText("")
	end)
	view.box:SetScript("OnEnterPressed", function(self)
		if view.boxMode == "paste" then
			local _, order = L.Replay(L.Decode(self:GetText()))
			if #order > 0 then
				L.SetPlan(order)
				ns.Print("plan loaded: " .. #order .. " points.")
				self:ClearFocus()
				self:Hide()
				view.boxNote:SetText("")
			else
				view.boxNote:SetText(ns.Hex(ns.HEX.red, "That link has no Legacy plan in it."))
			end
		else
			self:ClearFocus()
		end
	end)
	view.box:SetScript("OnTextChanged", function(self, user)
		if view.boxMode == "link" and user then
			self:SetText(view.boxValue or "")
			self:HighlightText()
		end
	end)
	view.box:HookScript("OnEditFocusGained", function(self)
		if view.boxMode == "link" then
			self:HighlightText()
		end
	end)
	function view:ShowBox(mode)
		self.boxMode = mode
		self.box:Show()
		if mode == "link" then
			self.boxValue = L.Link(self.order)
			self.box:SetText(self.boxValue)
			self.boxNote:SetText("Copy it with Ctrl+C, then open it in a browser.")
		else
			self.boxValue = nil
			self.box:SetText("")
			self.boxNote:SetText("Paste a link with Ctrl+V, then press Enter.")
		end
		self.box:SetFocus()
		if mode == "link" then
			self.box:HighlightText()
		end
	end

	view.note = UI.Text(view, 10.5, ns.RGB.fog, { wrap = true })
	view.note:SetPoint("BOTTOMLEFT", 2, 2)
	view.note:SetPoint("BOTTOMRIGHT", -2, 2)
	local build = (ns.legacy.source or ""):match("(%d+%.%d+%.%d+%.%d+)")
	view.note:SetText("Perks, ranks and what opens them come from the Forever beta client" .. (build and (" (build " .. build .. ")") or "") .. " through talentsforever.com (CC BY 4.0), so Blizzard can still change them. The question marks are perks the game says are coming.")

	function view:Add(id)
		if L.Block(self.ranks, id) == nil then
			local order = {}
			for i, v in ipairs(self.order) do
				order[i] = v
			end
			order[#order + 1] = id
			L.SetPlan(order)
		end
	end
	function view:Remove(id)
		if not L.CanRemove(self.ranks, id) then
			return
		end
		local at
		for i = #self.order, 1, -1 do
			if self.order[i] == id then
				at = i
				break
			end
		end
		if at then
			local _, order = L.Without(self.order, at)
			L.SetPlan(order)
		end
	end
	function view:Update()
		self.ranks, self.order = L.Plan()
		local cap = L.Cap()
		local spent = #self.order
		local earned = L.Earned()
		local per = {}
		for i, panel in ipairs(self.trees) do
			panel:Update(self.ranks, spent >= cap)
			per[i] = L.TreeSpent(panel.tree, self.ranks)
		end
		local left = cap - spent
		self.points:SetText("Points " .. ns.Hex(ns.HEX.white, spent .. " / " .. cap) .. "     Left " .. ns.Hex(left > 0 and ns.HEX.green or ns.HEX.gold, left) .. "     " .. ns.Hex(ns.HEX.mist, table.concat(per, " / ")))
		if spent == 0 then
			self.status:SetText("Each character spends up to " .. cap .. " points, one per rank. Click a perk to add a point, right-click to take one back.")
		elseif spent > earned then
			self.status:SetText("This plan uses " .. spent .. " points and your ticked challenges give " .. earned .. ": " .. (spent - earned) .. " more to go.")
		else
			self.status:SetText("Your ticked challenges (" .. earned .. " points) cover this plan.")
		end
		for i, ic in ipairs(self.orderIcons) do
			local id = self.order[i]
			local p = id and L.Perk(id)
			ic.perk = p
			if p then
				ic:SetIcon(ns.Icon(p.icon))
				ic:Show()
			else
				ic:Hide()
			end
		end
		self.orderEmpty:SetShown(spent == 0)
		self.undo:SetEnabled(L.CanUndo())
		self.reset:SetEnabled(spent > 0)
		self.fromGame:SetShown(L.FromGame() ~= nil)
		self.Layout()
		if self.box:IsShown() and self.boxMode == "link" then
			self.boxValue = L.Link(self.order)
			self.box:SetText(self.boxValue)
		end
	end
end

-- The page ------------------------------------------------------------------------------------------------------

local function build(frame)
	frame.tabs = UI.Tabs(frame, { { "challenges", "Challenges" }, { "perks", "Perk planner" } }, function(key)
		frame:Select(key)
	end)
	frame.tabs:SetPoint("TOPLEFT", 0, 0)

	frame.challenges = CreateFrame("Frame", nil, frame)
	frame.challenges:SetPoint("TOPLEFT", 0, -46)
	frame.challenges:SetPoint("BOTTOMRIGHT", 0, 0)
	buildChallenges(frame.challenges)
	frame.perks = CreateFrame("Frame", nil, frame)
	frame.perks:SetPoint("TOPLEFT", 0, -46)
	frame.perks:SetPoint("BOTTOMRIGHT", 0, 0)
	buildPerks(frame.perks)

	function frame:Select(view)
		ns.char.legacyView = view
		self:Update()
	end
	function frame:Update()
		local view = ns.char.legacyView == "perks" and "perks" or "challenges"
		self.tabs:Select(view)
		self.challenges:SetShown(view == "challenges")
		self.perks:SetShown(view == "perks")
		if view == "challenges" then
			self.challenges:Update()
		else
			self.perks:Update()
		end
		ns.RefreshHeader()
	end
end

ns.AddTab({
	key = "legacy",
	label = "Legacy",
	icon = "INV_Shield_06",
	order = 7.5,
	lede = function()
		return ns.Hex(ns.HEX.gilt, L.Earned()) .. " of " .. ns.legacy.total .. " Legacy Points earned, up to " .. L.Cap() .. " a character."
	end,
	build = build,
	show = function(frame)
		frame:Update()
	end,
})

ns.Listen("LEGACY", function()
	if ns.IsOpen and ns.IsOpen("legacy") then
		ns.Open("legacy")
	end
end)
