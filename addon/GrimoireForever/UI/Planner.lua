-- The talent planner: a class's three trees side by side under the site's rules (5 points a row, prerequisites, ranks,
-- 51 points), the order the points go in with the level of each, Undo, Reset and Save. The Talents page opens it for a
-- new build, to edit one of yours, or on one of Grimoire's builds to start from.
local _, ns = ...
local UI = ns.UI
local R = ns.TalentRules

-- The site's proportions (50 wide cells, 18 between rows) at a size where three trees and the order fit the page: the
-- order takes two rows of 26 points.
local CELL, GAP_X, GAP_Y = 34, 20, 18
local HEAD, PAD_Y = 38, 10
local TREE_W, TREE_GAP = 233, 14
local TREE_H = HEAD + 2 * PAD_Y + 7 * CELL + 6 * GAP_Y
local PAD_X = math.floor((TREE_W - (4 * CELL + 3 * GAP_X)) / 2)
local TOP = 40
local ORDER_ICON, ORDER_STEP, ORDER_ROW = 22, 27, 38
local MAX_CELLS = 24

local function cellX(col)
	return PAD_X + col * (CELL + GAP_X)
end
local function cellY(row)
	return HEAD + PAD_Y + row * (CELL + GAP_Y)
end

local GILT = UI.colors.gilt
local LIT = { 0.95, 0.71, 0.25, 0.9 }
local DARK = { 0.17, 0.19, 0.22, 1 }

local function copy(list)
	local out = {}
	for i, v in ipairs(list) do
		out[i] = v
	end
	return out
end

-- Trees ---------------------------------------------------------------------------------------------------------

local function newCell(panel, planner)
	local b = CreateFrame("Button", nil, panel)
	b:SetSize(CELL, CELL)
	-- The state shows in the edge: gold when full, green while it takes points, faint when locked.
	b.edge = b:CreateTexture(nil, "BACKGROUND")
	b.edge:SetTexture(UI.MEDIA .. "IconShape.tga")
	b.edge:SetAllPoints()
	b.icon = b:CreateTexture(nil, "ARTWORK")
	b.icon:SetPoint("TOPLEFT", 2, -2)
	b.icon:SetPoint("BOTTOMRIGHT", -2, 2)
	b.icon:SetTexCoord(0.07, 0.93, 0.07, 0.93)
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
	b:RegisterForClicks("LeftButtonUp", "RightButtonUp")
	b:SetScript("OnClick", function(self, button)
		if not self.talent then
			return
		end
		if button == "RightButton" or (IsShiftKeyDown and IsShiftKeyDown()) then
			planner:Remove(self.talent.id)
		else
			planner:Add(self.talent.id)
		end
		planner:Tip(self)
	end)
	b:SetScript("OnEnter", function(self)
		planner:Tip(self)
	end)
	b:SetScript("OnLeave", function()
		GameTooltip:Hide()
	end)
	return b
end

local function newArrow(panel)
	local a = {}
	a.line = panel:CreateTexture(nil, "BORDER")
	a.line:SetTexture(UI.WHITE)
	a.head = UI.Mark(panel, "Chevron", 12, DARK, "BORDER")
	return a
end

--- Draws an arrow from a prerequisite to the talent that needs it: down a column, or along a row either way.
local function placeArrow(panel, a, from, to)
	a.line:ClearAllPoints()
	a.head:ClearAllPoints()
	if from.row == to.row then
		local y = cellY(from.row) + CELL / 2
		local right = to.col > from.col
		local x1 = right and (cellX(from.col) + CELL + 3) or (cellX(to.col) + CELL + 3)
		local x2 = right and (cellX(to.col) - 3) or (cellX(from.col) - 3)
		if right then
			a.line:SetPoint("TOPLEFT", panel, "TOPLEFT", x1, -(y - 1))
		else
			a.line:SetPoint("TOPLEFT", panel, "TOPLEFT", x1 + 3, -(y - 1))
		end
		a.line:SetSize(math.max(1, x2 - x1 - 3), 2)
		a.head:SetPoint("CENTER", panel, "TOPLEFT", right and (x2 - 4) or (x1 + 4), -y)
		if a.head.SetRotation then
			a.head:SetRotation(right and math.pi / 2 or -math.pi / 2)
		end
	else
		local x = cellX(to.col) + CELL / 2
		local top = cellY(from.row) + CELL + 3
		local bottom = cellY(to.row) - 3
		a.line:SetPoint("TOPLEFT", panel, "TOPLEFT", x - 1, -top)
		a.line:SetSize(2, math.max(1, bottom - top - 3))
		a.head:SetPoint("CENTER", panel, "TOPLEFT", x, -(bottom - 4))
		if a.head.SetRotation then
			a.head:SetRotation(0)
		end
	end
	a.line:Show()
	a.head:Show()
end

local function treePanel(parent, planner, index)
	local panel = UI.Card(parent)
	panel:SetSize(TREE_W, TREE_H)
	panel.index = index
	panel.treeIcon = UI.Icon(panel, 22)
	panel.treeIcon:SetPoint("TOPLEFT", 12, -8)
	panel.name = UI.Text(panel, 13, ns.RGB.white, { weight = "bold" })
	panel.name:SetPoint("LEFT", panel.treeIcon, "RIGHT", 9, 0.5)
	panel.name:SetPoint("RIGHT", panel, "TOPRIGHT", -44, -19)
	panel.points = UI.Text(panel, 16, ns.RGB.gilt, { weight = "bold", justify = "RIGHT" })
	panel.points:SetPoint("TOPRIGHT", -14, -10)
	local rule = UI.Rule(panel)
	rule:SetPoint("TOPLEFT", 1, -HEAD)
	rule:SetPoint("TOPRIGHT", -1, -HEAD)
	panel.cells, panel.arrows = {}, {}

	--- Puts a tree's talents in the cells and draws its prerequisite arrows.
	function panel:Load(tree)
		self.tree = tree
		self.treeIcon:SetIcon(ns.Icon(tree.icon))
		self.name:SetText(tree.name)
		local byId = {}
		for _, t in ipairs(tree.talents) do
			byId[t.id] = t
		end
		for i = 1, math.max(#self.cells, math.min(MAX_CELLS, #tree.talents)) do
			local t = tree.talents[i]
			local b = self.cells[i]
			if t then
				if not b then
					b = newCell(self, planner)
					self.cells[i] = b
				end
				b.talent = t
				b.icon:SetTexture(ns.Icon(t.icon))
				b:ClearAllPoints()
				b:SetPoint("TOPLEFT", cellX(t.col), -cellY(t.row))
				b:Show()
			elseif b then
				b.talent = nil
				b:Hide()
			end
		end
		local n = 0
		for _, t in ipairs(tree.talents) do
			local from = t.req and byId[t.req.id]
			if from then
				n = n + 1
				local a = self.arrows[n] or newArrow(self)
				self.arrows[n] = a
				a.from, a.to, a.qty = from, t, t.req.qty
				placeArrow(self, a, from, t)
			end
		end
		for i = n + 1, #self.arrows do
			self.arrows[i].from = nil
			self.arrows[i].line:Hide()
			self.arrows[i].head:Hide()
		end
	end

	function panel:Update(cls, ranks, full)
		self.points:SetText(R.TreePoints(self.tree, ranks))
		for _, b in ipairs(self.cells) do
			local t = b.talent
			if t then
				local rank = ranks[t.id] or 0
				local state
				if rank >= t.max then
					state = "max"
				elseif rank > 0 then
					state = "some"
				elseif R.Reachable(cls, ranks, t.id) and not full then
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
				b.rank:SetText(rank .. "/" .. t.max)
			end
		end
		for _, a in ipairs(self.arrows) do
			if a.from then
				local c = (ranks[a.from.id] or 0) >= a.qty and LIT or DARK
				a.line:SetVertexColor(c[1], c[2], c[3], c[4])
				a.head:SetVertexColor(c[1], c[2], c[3], c[4])
			end
		end
	end
	return panel
end

-- The planner -----------------------------------------------------------------------------------------------------

--- handlers: onSave(plan) with plan = { cls, order, ranks, name (as typed, maybe empty), editing, base }; onClose().
function UI.TalentPlanner(parent, handlers)
	local p = CreateFrame("Frame", nil, parent)
	p:SetAllPoints()
	p:Hide()
	p.order, p.ranks, p.past = {}, {}, {}

	-- The top row: Cancel, the name, the points; Undo, Reset and Save on the right.
	p.cancel = UI.Button(p, "Cancel", 80, 28, function(self)
		if p:Dirty() and not self.armed then
			self.armed = true
			self:SetLabel("Discard changes?")
			self:SetSelected(true)
			self:FitWidth(70)
			local token = {}
			self.token = token
			if C_Timer and C_Timer.After then
				C_Timer.After(4, function()
					if self.token == token then
						p:Disarm()
					end
				end)
			end
			return
		end
		p:Disarm()
		handlers.onClose()
	end)
	p.cancel:FitWidth(70)
	p.cancel:SetPoint("TOPLEFT", 0, 0)
	p.cancel.tip = "Back to the builds without saving."

	p.name = CreateFrame("EditBox", nil, p)
	p.name:SetSize(210, 28)
	UI.Field(p.name)
	p.name:SetTextInsets(10, 10, 0, 0)
	p.name:SetMaxLetters(40)
	p.name:SetPoint("LEFT", p.cancel, "RIGHT", 10, 0)
	p.name.hint = UI.Text(p.name, 12, ns.RGB.fog)
	p.name.hint:SetPoint("LEFT", 10, 0.5)
	p.name.hint:SetPoint("RIGHT", -10, 0.5)
	p.name:SetScript("OnTextChanged", function(self)
		self.hint:SetShown((self:GetText() or "") == "")
	end)
	p.name:SetScript("OnEscapePressed", function(self)
		self:ClearFocus()
	end)
	p.name:SetScript("OnEnterPressed", function(self)
		self:ClearFocus()
	end)
	p.name:SetScript("OnHide", function(self)
		self:ClearFocus()
	end)
	p.name:HookScript("OnEnter", function(self)
		GameTooltip:SetOwner(self, "ANCHOR_TOP")
		GameTooltip:SetText("The build's name", 1, 1, 1)
		GameTooltip:AddLine("Left empty, it is named after its points.", 0.64, 0.62, 0.58, true)
		GameTooltip:Show()
	end)
	p.name:HookScript("OnLeave", function()
		GameTooltip:Hide()
	end)

	p.points = UI.Text(p, 12.5, ns.RGB.text, { weight = "medium" })
	p.points:SetPoint("LEFT", p.name, "RIGHT", 14, 0.5)

	local row = {}
	local function button(label, onClick, kind)
		local b = UI.Button(p, label, 60, 28, onClick, kind)
		b:FitWidth(60)
		row[#row + 1] = b
		return b
	end
	p.save = button("Save build", function()
		if #p.order > 0 then
			p:Disarm()
			handlers.onSave({ cls = p.cls, order = copy(p.order), ranks = p.ranks, name = p.name:GetText() or "", editing = p.editing, base = p.base })
		end
	end, "primary")
	p.save:FitWidth(96)
	p.reset = button("Reset", function()
		p:Reset()
	end)
	p.reset.tip = "Take every point out."
	p.undo = button("Undo", function()
		p:Undo()
	end)
	p.undo.tip = "Undo the last change."
	local x = 0
	for _, b in ipairs(row) do
		b:SetPoint("TOPRIGHT", -x, 0)
		x = x + b:GetWidth() + 6
	end

	-- The trees
	p.trees = {}
	for i = 1, 3 do
		local panel = treePanel(p, p, i)
		panel:SetPoint("TOPLEFT", (i - 1) * (TREE_W + TREE_GAP), -TOP)
		p.trees[i] = panel
	end

	-- The order to spend the points in, with the level of each, under the trees.
	local orderTop = TOP + TREE_H + 12
	local card = UI.Card(p)
	card:SetPoint("TOPLEFT", 0, -orderTop)
	card:SetPoint("BOTTOMRIGHT", 0, 0)
	p.orderCard = card
	local title = UI.Text(card, 12.5, ns.RGB.white, { weight = "bold" })
	title:SetPoint("TOPLEFT", 14, -11)
	title:SetText("Point order")
	p.orderSub = UI.Text(card, 11, ns.RGB.mist)
	p.orderSub:SetPoint("LEFT", title, "RIGHT", 10, 0)
	p.orderIcons = {}
	for i = 1, R.MAX do
		local ic = UI.Icon(card, ORDER_ICON)
		ic.n = UI.Text(ic, 9.5, ns.RGB.fog, { weight = "medium", justify = "CENTER" })
		ic.n:SetPoint("TOP", ic, "BOTTOM", 0, -2)
		ic:EnableMouse(true)
		ic:SetScript("OnEnter", function(self)
			if self.step then
				local t = self.step.talent
				UI.TextTooltip(self, t.name, {
					{ "Point " .. self.step.n .. ", at level " .. self.step.level, 0.64, 0.62, 0.58 },
					{ self.step.treeName .. ", rank " .. self.step.rank .. " of " .. t.max, 0.64, 0.62, 0.58 },
				})
			end
		end)
		ic:SetScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		p.orderIcons[i] = ic
	end
	p.orderEmpty = UI.Text(card, 11.5, ns.RGB.fog)
	p.orderEmpty:SetPoint("TOPLEFT", 14, -40)
	p.orderEmpty:SetText("Click a talent to spend your first point; it comes at level 10.")

	-- State ------------------------------------------------------------------------------------------------------

	function p:Disarm()
		if self.cancel.armed then
			self.cancel.armed = false
			self.cancel:SetLabel("Cancel")
			self.cancel:SetSelected(false)
			self.cancel:FitWidth(70)
		end
	end

	--- Opens a plan: opts = { cls, order, name, editing (a build of yours to save into), base (Grimoire's build it
	--- starts from) }.
	function p:Open(opts)
		self.cls = opts.cls
		local _, kept = R.Replay(self.cls, opts.order or {})
		self.order = kept
		self.ranks = R.Replay(self.cls, kept)
		self.past = {}
		self.editing, self.base = opts.editing, opts.base
		self.startCode = R.EncodeOrder(self.cls, kept)
		self.startName = opts.name or ""
		self.name:SetText(opts.name or "")
		self.name.hint:SetShown((opts.name or "") == "")
		self:Disarm()
		for i, panel in ipairs(self.trees) do
			local tree = R.Trees(self.cls)[i]
			if tree then
				panel:Load(tree)
				panel:Show()
			else
				panel:Hide()
			end
		end
		self:Update()
	end

	--- Unsaved changes: points or a name other than the ones it opened with.
	function p:Dirty()
		if not self.cls then
			return false
		end
		return R.EncodeOrder(self.cls, self.order) ~= self.startCode or (self.name:GetText() or "") ~= self.startName
	end

	function p:Set(order)
		self.past[#self.past + 1] = self.order
		if #self.past > 200 then
			table.remove(self.past, 1)
		end
		self.order = order
		self.ranks = R.Replay(self.cls, order)
		self:Update()
	end

	function p:Add(id)
		if R.Block(self.cls, self.ranks, id) ~= nil then
			return false
		end
		local order = copy(self.order)
		order[#order + 1] = id
		self:Set(order)
		return true
	end

	--- Takes out the talent's last point, when nothing deeper leans on it.
	function p:Remove(id)
		if not R.CanRemove(self.cls, self.ranks, id) then
			return false
		end
		for i = #self.order, 1, -1 do
			if self.order[i] == id then
				local _, order = R.Without(self.cls, self.order, i)
				self:Set(order)
				return true
			end
		end
		return false
	end

	function p:Undo()
		local prev = table.remove(self.past)
		if prev then
			self.order = prev
			self.ranks = R.Replay(self.cls, prev)
			self:Update()
		end
	end

	function p:Reset()
		if #self.order > 0 then
			self:Set({})
		end
	end

	--- The tooltip of a talent cell: its rank, what it still needs, its text now and at the next rank.
	function p:Tip(cell)
		local t = cell.talent
		local info = t and ns.Talent(self.cls, t.id)
		if not info then
			return
		end
		local rank = self.ranks[t.id] or 0
		local tree = R.Trees(self.cls)[info.tree]
		GameTooltip:SetOwner(cell, "ANCHOR_RIGHT")
		GameTooltip:SetText(t.name, 1, 1, 1)
		GameTooltip:AddLine("Rank " .. rank .. "/" .. t.max, 0.64, 0.62, 0.58)
		local need = t.row * 5
		if R.PointsAbove(tree, self.ranks, t.row) < need then
			GameTooltip:AddLine("Requires " .. need .. " points in " .. tree.name .. " Talents", 1, 0.13, 0.13)
		end
		if t.req and (self.ranks[t.req.id] or 0) < t.req.qty then
			local req = ns.Talent(self.cls, t.req.id)
			local reqName = req and req.talent.name or "?"
			GameTooltip:AddLine("Requires " .. t.req.qty .. " point" .. (t.req.qty > 1 and "s" or "") .. " in " .. reqName, 1, 0.13, 0.13)
		end
		local desc = t.desc or {}
		if desc[math.max(1, rank)] then
			GameTooltip:AddLine(desc[math.max(1, rank)], 1, 0.82, 0, true)
		end
		if rank > 0 and rank < t.max and desc[rank + 1] then
			GameTooltip:AddLine(" ")
			GameTooltip:AddLine("Next rank:", 1, 1, 1)
			GameTooltip:AddLine(desc[rank + 1], 1, 0.82, 0, true)
		end
		if t.status == "new" then
			GameTooltip:AddLine("New in Forever", 0.6, 0.89, 0.48)
		elseif t.status == "changed" then
			GameTooltip:AddLine("Changed from Classic", 0.95, 0.77, 0.42)
		end
		if rank < t.max and #self.order >= R.MAX then
			GameTooltip:AddLine("All 51 points are spent.", 0.64, 0.62, 0.58)
		end
		GameTooltip:AddLine("Click to add a point, right-click to take one back.", 0.47, 0.45, 0.42, true)
		GameTooltip:Show()
	end

	--- The level each point comes at: for your own class, sooner with the Legacy perk Talented.
	function p:Shift()
		return (self.cls == ns.player.class) and ns.PointShift() or 0
	end

	function p:Update()
		if not self.cls then
			return
		end
		local spent = #self.order
		local full = spent >= R.MAX
		for _, panel in ipairs(self.trees) do
			if panel.tree then
				panel:Update(self.cls, self.ranks, full)
			end
		end
		local left = R.MAX - spent
		self.points:SetText(ns.Hex(ns.HEX.white, spent) .. ns.Hex(ns.HEX.mist, " / 51 points") .. (left > 0 and "" or ns.Hex(ns.HEX.gold, "  ·  all spent")))
		self.name.hint:SetText(ns.AutoBuildName(self.cls, self.ranks))
		local shift = self:Shift()
		self.orderSub:SetText(spent > 0 and ("Spend them in this order as you level: the last one at level " .. ns.PointLevel(spent, shift) .. ".") or "")
		-- As many icons a row as the card holds, rows wrapping under each other.
		local width = (self.orderCard:GetWidth() or 0) - 28
		if width <= 0 then
			width = 700
		end
		local perRow = math.max(1, math.floor((width + ORDER_STEP - ORDER_ICON) / ORDER_STEP))
		local counts = {}
		for i, ic in ipairs(self.orderIcons) do
			local id = self.order[i]
			local info = id and ns.Talent(self.cls, id)
			if info then
				counts[id] = (counts[id] or 0) + 1
				local level = ns.PointLevel(i, shift)
				ic.step = { n = i, level = level, talent = info.talent, treeName = info.treeName, rank = counts[id] }
				ic:SetIcon(ns.Icon(info.talent.icon))
				ic.n:SetText(level)
				ic:ClearAllPoints()
				ic:SetPoint("TOPLEFT", 14 + ((i - 1) % perRow) * ORDER_STEP, -(34 + math.floor((i - 1) / perRow) * ORDER_ROW))
				ic:Show()
			else
				ic.step = nil
				ic:Hide()
			end
		end
		self.orderEmpty:SetShown(spent == 0)
		self.undo:SetEnabled(#self.past > 0)
		self.reset:SetEnabled(spent > 0)
		self.save:SetEnabled(spent > 0)
		self.save:SetLabel(self.editing and "Save changes" or "Save build")
		self.save:FitWidth(96)
		local x = 0
		for _, b in ipairs(row) do
			b:ClearAllPoints()
			b:SetPoint("TOPRIGHT", -x, 0)
			x = x + b:GetWidth() + 6
		end
	end

	return p
end
