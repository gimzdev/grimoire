-- Talents: Grimoire's builds and your own for every class, point by point, checked against your own talents. Follow one
-- (and stop following it), make your own from your talents, from a link of the site's talent calculator or in the
-- planner, and keep them for every character of the class on your account.
local _, ns = ...
local UI = ns.UI

local LEFT = 236
-- mode: "builds" (the list and a build) or "plan" (the planner over the whole page)
local view = { cls = nil, build = nil, mode = "builds" }

local function stepTooltip(owner, step, cls, stateText)
	local info = step.info
	if not info then
		return
	end
	local t = info.talent
	local lines = {
		{ info.treeName .. ", rank " .. step.rank .. " of " .. t.max, 0.64, 0.62, 0.58 },
	}
	if t.desc and t.desc[step.rank] then
		lines[#lines + 1] = { t.desc[step.rank], 1, 0.82, 0 }
	end
	lines[#lines + 1] = { "Point " .. step.n .. ", at level " .. step.level, 0.64, 0.62, 0.58 }
	if t.status == "new" then
		lines[#lines + 1] = { "New in Forever", 0.6, 0.89, 0.48 }
	elseif t.status == "changed" then
		lines[#lines + 1] = { "Changed from Classic", 0.95, 0.77, 0.42 }
	end
	if stateText then
		lines[#lines + 1] = { stateText, 1, 1, 1 }
	end
	UI.TextTooltip(owner, t.name, lines)
end

-- A step's state, drawn with the site's marks: spent (a green check), not spent here (a red cross), reached by your level
-- (a gold dot).
local STATE = {
	done = { "Check", ns.RGB.green, "Spent", 14 },
	missing = { "Close", ns.RGB.red, "Not spent here yet", 12 },
	reached = { "Disc16", ns.RGB.gilt, "Your level has this point", 6 },
}

-- A Grimoire build's evidence on its card: who it is for, the day and client build it was checked on, and a mark where
-- guides agree or players measured it (none otherwise).
local CONFIDENCE = { live = "played at these levels", consensus = "two guides agree" }
local function evidenceText(b)
	local parts = {}
	if b.who then
		parts[#parts + 1] = "For: " .. b.who
	end
	if b.checked then
		parts[#parts + 1] = "Checked " .. b.checked .. (b.build and (" on " .. b.build) or "") .. (CONFIDENCE[b.confidence] and ("  ·  " .. CONFIDENCE[b.confidence]) or "")
	end
	local into = b.next and ns.FindBuild(b.next.id)
	if into then
		parts[#parts + 1] = "At " .. b.next.at .. ": respec into " .. ns.BuildTitle(into) .. "."
	end
	if #parts == 0 then
		return nil
	end
	return table.concat(parts, "\n")
end

local function specName(cls, slug)
	for _, s in ipairs(ns.classes[cls] and ns.classes[cls].specs or {}) do
		if s.slug == slug then
			return s.name
		end
	end
	return slug
end

--- The rows of the build list: your builds for the class, then Grimoire's in their groups, Leveling, PvE and PvP. A
--- title over each list when there is more than one: yours and Grimoire's, or Grimoire's groups. A group shows its first
--- build and a row to show the others; it opens by itself when the build shown or the one you follow is among them.
local function listRows(cls)
	local rows = {}
	local mine = ns.CustomBuilds(cls)
	local groups = ns.BuildGroups(cls)
	local titles = #mine > 0 or #groups > 1
	if #mine > 0 then
		rows[#rows + 1] = { header = "Your builds" }
		for _, b in ipairs(mine) do
			rows[#rows + 1] = b
		end
	end
	view.open = view.open or {}
	for _, g in ipairs(groups) do
		if titles then
			rows[#rows + 1] = { header = (#groups == 1) and "Grimoire's builds" or g.label }
		end
		local key = cls .. ":" .. g.key
		local open = view.open[key]
		if open == nil then
			open = false
			for i = 2, #g.builds do
				local id = g.builds[i].id
				if id == view.build or (id == ns.char.build and ns.player.class == cls) then
					open = true
				end
			end
		end
		for i, b in ipairs(g.builds) do
			if i == 1 or open then
				rows[#rows + 1] = b
			end
		end
		if #g.builds > 1 then
			rows[#rows + 1] = { more = key, open = open, count = #g.builds - 1, group = g.key == "leveling" and "leveling" or g.label }
		end
	end
	return rows
end

--- A small rounded tag, the Home page's: "Following" in gold, with a check before it; plain: the words alone.
local function pill(parent, plain)
	local f = CreateFrame("Frame", nil, parent)
	f:SetHeight(22)
	local s = UI.Surface(f, 11)
	local c = UI.colors.gilt
	s:SetFill(c[1], c[2], c[3], 0.14)
	s:SetBorder(c[1], c[2], c[3], 0.45)
	f.text = UI.Text(f, 11, ns.RGB.gold, { weight = "bold" })
	if plain then
		f.text:SetPoint("LEFT", 10, 0.5)
	else
		f.mark = UI.Mark(f, "Check", 11, ns.RGB.gold)
		f.mark:SetPoint("LEFT", 10, 0)
		f.text:SetPoint("LEFT", f.mark, "RIGHT", 5, 0.5)
	end
	function f:Set(text)
		self.text:SetText(text)
		self:SetWidth(math.ceil(UI.TextWidth(self.text)) + (plain and 20 or 37))
	end
	return f
end

--- An edit box in the site's field look. readOnly: the box holds a value to copy and puts it back if typed over.
local function box(parent, width, readOnly)
	local e = CreateFrame("EditBox", nil, parent)
	e:SetSize(width, 28)
	UI.Field(e)
	e:SetTextInsets(10, 10, 0, 0)
	e:SetMaxLetters(255)
	e:SetScript("OnHide", function(self)
		self:ClearFocus()
	end)
	if readOnly then
		e:SetScript("OnTextChanged", function(self, user)
			if user then
				self:SetText(self.value or "")
				self:HighlightText()
			end
		end)
		e:HookScript("OnEditFocusGained", function(self)
			self:HighlightText()
		end)
		e:SetScript("OnEscapePressed", function(self)
			self:ClearFocus()
		end)
		e:SetScript("OnEnterPressed", function(self)
			self:ClearFocus()
		end)
	end
	return e
end

local function build(frame)
	-- Left: classes and their builds ---------------------------------------------------------------------------------
	frame.browse = CreateFrame("Frame", nil, frame)
	frame.browse:SetAllPoints()
	local browse = frame.browse
	local classLabel = UI.Text(browse, 11, ns.RGB.mist, { weight = "medium" })
	classLabel:SetPoint("TOPLEFT", 2, 0)
	classLabel:SetText("Class")
	frame.chips = {}
	for _, cls in ipairs(ns.classOrder) do
		local c = ns.classes[cls]
		local rgb = { tonumber(c.color:sub(1, 2), 16) / 255, tonumber(c.color:sub(3, 4), 16) / 255, tonumber(c.color:sub(5, 6), 16) / 255 }
		local chip = UI.Chip(browse, c.name, function()
			if view.cls ~= cls then
				view.cls = cls
				view.build = nil
				view.pasting, view.notice = false, nil
			end
			frame:Update()
		end, rgb)
		chip.cls = cls
		frame.chips[#frame.chips + 1] = chip
	end
	local chipsHeight = UI.Flow(frame.chips, browse, 0, 20, LEFT, 6)
	local listTop = chipsHeight + 60
	local buildLabel = UI.Text(browse, 11, ns.RGB.mist, { weight = "medium" })
	buildLabel:SetPoint("TOPLEFT", 2, -(chipsHeight + 36))
	buildLabel:SetText("Builds")

	-- New build: from your talents, from a link, or in the planner.
	frame.newBuild = UI.Button(browse, "New build", 100, 24, function(self)
		local entries = {}
		if view.cls == ns.player.class then
			entries[#entries + 1] = { "From my talents", "talents" }
		end
		entries[#entries + 1] = { "From a link", "link" }
		entries[#entries + 1] = { "In the planner", "plan" }
		UI.Menu(self, entries, function(how)
			frame:NewBuild(how)
		end)
	end)
	UI.SetFont(frame.newBuild.label, "medium", 11.5)
	frame.newBuild:AddChevron()
	frame.newBuild:FitWidth(90)
	frame.newBuild:SetPoint("TOPRIGHT", browse, "TOPLEFT", LEFT, -(chipsHeight + 30))
	frame.newBuild.tipTitle = "New build"
	frame.newBuild.tipLines = { "Make a build of your own: from the talents you have, from a link of the talent calculator on wowgrimoire.app, or point by point in the planner. It is kept for every character of the class on your account." }

	-- A link to paste, under the button, and a line for what went wrong.
	frame.paste = box(browse, LEFT, false)
	frame.paste:SetPoint("TOPLEFT", 0, -listTop)
	frame.paste:SetTextInsets(10, 30, 0, 0)
	frame.paste:SetScript("OnEnterPressed", function(self)
		local b, err = ns.BuildFromLink(self:GetText() or "", view.cls)
		if b then
			view.pasting, view.notice = false, nil
			view.build = b.id
			self:SetText("")
			self:ClearFocus()
		else
			view.notice = { err, "red" }
		end
		frame:Update()
	end)
	frame.paste:SetScript("OnEscapePressed", function(self)
		view.pasting, view.notice = false, nil
		self:ClearFocus()
		frame:Update()
	end)
	frame.paste.hint = UI.Text(frame.paste, 12, ns.RGB.fog)
	frame.paste.hint:SetPoint("LEFT", 10, 0.5)
	frame.paste.hint:SetPoint("RIGHT", -30, 0.5)
	frame.paste.hint:SetText("Paste a link here")
	frame.paste:SetScript("OnTextChanged", function(self)
		self.hint:SetShown((self:GetText() or "") == "")
	end)
	local close = CreateFrame("Button", nil, frame.paste)
	close:SetSize(20, 20)
	close:SetPoint("RIGHT", -5, 0)
	close.x = UI.Mark(close, "Close", 10, ns.RGB.mist)
	close.x:SetPoint("CENTER")
	close:SetScript("OnEnter", function(self)
		self.x:SetVertexColor(unpack(ns.RGB.white))
	end)
	close:SetScript("OnLeave", function(self)
		self.x:SetVertexColor(unpack(ns.RGB.mist))
	end)
	close:SetScript("OnClick", function()
		view.pasting, view.notice = false, nil
		frame:Update()
	end)
	frame.pasteClose = close
	frame.notice = UI.Text(browse, 11, ns.RGB.mist, { wrap = true, spacing = 2 })
	frame.notice:SetWidth(LEFT - 4)

	local card
	card, frame.builds = UI.CardList(browse, 54, function(list)
		local row = UI.Row(list)
		row.name = UI.Text(row, 13, ns.RGB.white, { weight = "bold" })
		row.name:SetPoint("TOPLEFT", 14, -11)
		row.name:SetPoint("TOPRIGHT", -10, -11)
		row.sub = UI.Text(row, 11, ns.RGB.mist)
		row.sub:SetPoint("TOPLEFT", 14, -31)
		row.sub:SetPoint("TOPRIGHT", -10, -31)
		row.more = UI.Text(row, 11.5, ns.RGB.gold, { weight = "medium" })
		row.more:SetPoint("LEFT", 14, 0.5)
		row.chevron = UI.Mark(row, "Chevron", 9, ns.RGB.gold)
		row.chevron:SetPoint("LEFT", row.more, "RIGHT", 6, 0)
		row:SetScript("OnClick", function(self)
			if self.item and self.item.more then
				-- show or hide the rest of a group of Grimoire's builds
				view.open = view.open or {}
				view.open[self.item.more] = not self.item.open
				frame:Update()
				return
			end
			if self.item and not self.item.header and view.build ~= self.item.id then
				view.build = self.item.id
				view.renaming, view.linkFor = nil, nil
				if not view.pasting then
					view.notice = nil
				end
				frame:Update()
			end
		end)
		return row
	end, function(row, b)
		row.item = b
		local header = UI.HeaderRow(row)
		if b.more then
			header:Hide()
			row.rule:Hide()
			row.name:Hide()
			row.sub:Hide()
			row.more:SetText(b.open and "Show less" or (b.count .. " more " .. b.group .. (b.count == 1 and " build" or " builds")))
			row.more:Show()
			row.chevron:SetRotation(b.open and math.pi or 0)
			row.chevron:Show()
			row:EnableMouse(true)
			row:SetSelected(false)
			return
		end
		row.more:Hide()
		row.chevron:Hide()
		if b.header then
			header:SetText(b.header)
			header:Show()
			row.rule:Show()
			row.name:Hide()
			row.sub:Hide()
			row:EnableMouse(false)
			row:SetSelected(false)
			return
		end
		header:Hide()
		row.rule:Hide()
		row.name:Show()
		row.sub:Show()
		row:EnableMouse(true)
		UI.FitFont(row.name, b.name, "bold", 13)
		row.name:SetText(b.name)
		local mine = ns.char.build == b.id and ns.player.class == view.cls
		local what
		if b.custom and #b.order == 0 then
			what = "No points yet"
		else
			-- the spec, or a PvE build's role (DPS, Tank, Healer)
			local role = ns.BuildRoleTag(b)
			what = (role or (b.spec and specName(view.cls, b.spec)) or "") .. "  ·  " .. table.concat(b.points or {}, "/")
		end
		row.sub:SetText(what .. (mine and ns.Hex(ns.HEX.green, "  ·  following") or ""))
		row:SetSelected(view.build == b.id)
	end, function(item)
		return item.header and 30 or item.more and 30 or 54
	end)
	card:SetPoint("BOTTOMLEFT", 0, 0)
	card:SetWidth(LEFT)
	frame.listCard = card

	-- Right: the build ------------------------------------------------------------------------------------------------
	local right = CreateFrame("Frame", nil, browse)
	right:SetPoint("TOPLEFT", LEFT + 24, 0)
	right:SetPoint("BOTTOMRIGHT")
	frame.right = right
	right.following = pill(right)
	right.following:SetPoint("TOPRIGHT", 0, -1)
	right.following:Set("Following")
	right.name = UI.Text(right, 18, ns.RGB.white, { weight = "bold" })
	right.name:SetPoint("TOPLEFT", 0, 0)
	right.rename = box(right, 260, false)
	right.rename:SetPoint("TOPLEFT", 0, 3)
	right.rename:SetMaxLetters(40)
	UI.SetFont(right.rename, "bold", 14)
	right.rename:SetScript("OnEnterPressed", function(self)
		if view.renaming then
			ns.RenameBuild(view.renaming, self:GetText())
		end
		view.renaming = nil
		self:ClearFocus()
		frame:Update()
	end)
	right.rename:SetScript("OnEscapePressed", function(self)
		view.renaming = nil
		self:ClearFocus()
		frame:Update()
	end)
	right.renameNote = UI.Text(right, 11, ns.RGB.mist)
	right.renameNote:SetPoint("LEFT", right.rename, "RIGHT", 12, 0)
	right.renameNote:SetText("Enter to save, Esc to cancel.")
	right.meta = UI.Text(right, 12, ns.RGB.mist)
	right.meta:SetPoint("TOPLEFT", 0, -28)
	right.meta:SetPoint("TOPRIGHT", 0, -28)
	right.summary = UI.Text(right, 12, ns.RGB.text, { wrap = true, spacing = 4 })
	right.summary:SetPoint("TOPLEFT", 0, -54)
	right.summary:SetPoint("TOPRIGHT", 0, -54)
	-- Under the summary, for Grimoire's builds: who it is for, and when and how it was checked.
	right.evidence = UI.Text(right, 11, ns.RGB.mist, { wrap = true, spacing = 3 })
	right.evidence:SetPoint("TOPLEFT", right.summary, "BOTTOMLEFT", 0, -6)
	right.evidence:SetPoint("TOPRIGHT", right.summary, "BOTTOMRIGHT", 0, -6)

	-- The row of actions; the ones a build does not have are left out without a gap.
	right.actions = CreateFrame("Frame", nil, right)
	right.actions:SetHeight(28)
	right.buttons = {}
	local function action(label, onClick, kind)
		local b = UI.Button(right.actions, label, 80, 28, onClick, kind)
		b:FitWidth(60)
		right.buttons[#right.buttons + 1] = b
		return b
	end
	right.follow = action("Follow this build", function()
		local b = ns.FindBuild(view.build)
		if not b or view.cls ~= ns.player.class then
			return
		end
		if ns.char.build == b.id then
			ns.StopFollowing()
			ns.Print("you no longer follow " .. b.name .. ": level-ups will not name a talent point.")
		else
			ns.SelectBuild(b.id)
			ns.Print("following " .. b.name .. ". Each level-up tells you where the point goes.")
		end
		frame:Update()
	end, "primary")
	-- The build you follow on keys 1 to =: a preview with Apply and Undo opens under the status line (Bars.lua).
	right.bars = action("Set up my bars", function()
		view.bars = view.bars ~= view.build and view.build or nil
		frame:Update()
	end)
	right.bars.tip = "Put this build's spells on keys 1 to = of your main bar. You see the keys first, and Undo puts them back."
	right.notes = action("Notes")
	right.notes:SetScript("OnEnter", function(self)
		self.hovered = true
		self:SetSelected(self.selected)
		local b = ns.FindBuild(view.build)
		if b and #b.notes > 0 then
			local lines = {}
			for _, n in ipairs(b.notes) do
				lines[#lines + 1] = { n, 1, 1, 1 }
			end
			if b.sources and #b.sources > 0 then
				lines[#lines + 1] = { "Compare with: " .. table.concat(b.sources, ", "), 0.62, 0.6, 0.55 }
			end
			UI.TextTooltip(self, "Notes", lines, "ANCHOR_BOTTOMLEFT")
		end
	end)
	right.notes:SetScript("OnLeave", function(self)
		self.hovered = false
		self:SetSelected(self.selected)
		GameTooltip:Hide()
	end)
	right.customize = action("Customize", function()
		local b = ns.FindBuild(view.build)
		if b then
			frame:OpenPlanner({ cls = view.cls, order = b.order, name = "My " .. ns.BuildTitle(b), base = b.id })
		end
	end)
	right.customize.tip = "Open this build in the planner as the start of one of your own."
	right.edit = action("Edit", function()
		local b = ns.FindBuild(view.build)
		if b then
			frame:OpenPlanner({ cls = view.cls, order = b.order, name = b.name, editing = b.id })
		end
	end)
	right.edit.tip = "Change the points in the planner."
	right.renameButton = action("Rename", function()
		view.renaming = view.renaming ~= view.build and view.build or nil
		view.linkFor = nil
		frame:Update()
		if view.renaming then
			local b = ns.FindBuild(view.build)
			right.rename:SetText(b and b.name or "")
			right.rename:SetFocus()
			right.rename:HighlightText()
		end
	end)
	right.link = action("Link", function()
		view.linkFor = view.linkFor ~= view.build and view.build or nil
		view.renaming = nil
		frame:Update()
		if view.linkFor then
			right.linkBox:SetFocus()
			right.linkBox:HighlightText()
		end
	end)
	right.link.tip = "This build as a link to the talent calculator on wowgrimoire.app."
	right.delete = action("Delete", function(self)
		if self.armed and self.armed == view.build then
			local id = view.build
			self.armed = nil
			view.build, view.renaming, view.linkFor = nil, nil, nil
			ns.DeleteBuild(id)
			frame:Update()
			return
		end
		self.armed = view.build
		local token = {}
		self.token = token
		frame:Update()
		if C_Timer and C_Timer.After then
			-- The ask runs out after a few seconds (only this ask: a later one keeps its own time).
			C_Timer.After(4, function()
				if self.armed and self.token == token then
					self.armed = nil
					if frame:IsVisible() then
						frame:Update()
					end
				end
			end)
		end
	end)
	right.status = UI.Text(right, 11.5, ns.RGB.mist, { wrap = true, spacing = 2 })
	right.status:SetMaxLines(2)
	-- Spends the next point of the build you follow, when it is legal now (Bars.lua); its tooltip says which.
	right.learn = UI.Button(right, "Learn next point", 120, 24, function()
		if frame.learnStep then
			ns.Bars.LearnNext(frame.learnStep)
			frame:Update()
		end
	end)
	right.learn:FitWidth(110)
	right.barsPanel = ns.Bars.Panel(right)
	right.barsPanel:Hide()
	right.linkBox = box(right, 300, true)
	right.linkNote = UI.Text(right, 11, ns.RGB.mist)
	right.linkNote:SetText("Copy it with Ctrl+C: it opens in the talent calculator on wowgrimoire.app.")

	-- Every point in order, in a card with its column names over it.
	right.card = UI.Card(right)
	local head = CreateFrame("Frame", nil, right.card)
	head:SetHeight(18)
	head:SetPoint("TOPLEFT", 6, -10)
	head:SetPoint("TOPRIGHT", -22, -10)
	right.head = head
	-- Over the row's columns: level at 10, the talent's icon at 64, tree ending at -100, rank ending at -24.
	local cols = {
		{ "Level", 10 },
		{ "Talent", 64 },
		{ "Tree", -100 },
		{ "Rank", -24 },
	}
	for _, col in ipairs(cols) do
		local t = UI.Text(head, 10.5, ns.RGB.fog, { weight = "medium" })
		if col[2] >= 0 then
			t:SetPoint("LEFT", col[2], 0)
		else
			t:SetPoint("RIGHT", col[2], 0)
		end
		t:SetText(col[1])
	end
	right.list = UI.List(right.card, 32, function(list)
		local row = UI.Row(list)
		row.level = UI.Text(row, 12, ns.RGB.mist)
		row.level:SetPoint("LEFT", 10, 0.5)
		row.state = row:CreateTexture(nil, "ARTWORK")
		row.state:SetPoint("CENTER", row, "LEFT", 47, 0)
		row.icon = UI.Icon(row, 22)
		row.icon:SetPoint("LEFT", 64, 0)
		row.name = UI.Text(row, 12, ns.RGB.white, { weight = "medium" })
		row.name:SetPoint("LEFT", 96, 0.5)
		row.rank = UI.Text(row, 12, ns.RGB.text, { justify = "RIGHT" })
		row.rank:SetPoint("RIGHT", -24, 0.5)
		row.tree = UI.Text(row, 11, ns.RGB.mist)
		row.tree:SetPoint("RIGHT", -100, 0.5)
		row.name:SetPoint("RIGHT", row.tree, "LEFT", -8, 0.5)
		row:HookScript("OnEnter", function(self)
			stepTooltip(self, self.item, view.cls, self.stateText)
		end)
		row:HookScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		return row
	end, function(row, step)
		row.item = step
		local info = step.info
		local t = info and info.talent
		row.level:SetText(ns.PointLevel(step.n, frame.shift or 0))
		row.icon:SetIcon(ns.Icon(t and t.icon))
		row.name:SetText(t and t.name or "?")
		row.tree:SetText(info and info.treeName or "")
		row.rank:SetText(step.rank .. "/" .. (t and t.max or "?"))
		local state = frame.state and frame.state[step.n]
		local st = STATE[state]
		if st then
			row.state:SetTexture(UI.MEDIA .. st[1] .. ".tga")
			row.state:SetVertexColor(st[2][1], st[2][2], st[2][3], 1)
			row.state:SetSize(st[4], st[4])
			row.state:Show()
			row.stateText = st[3]
		else
			row.state:Hide()
			row.stateText = nil
		end
		local isNext = frame.nextStep and frame.nextStep.n == step.n
		row:SetSelected(isNext)
		if isNext then
			row.stateText = "Your next point"
		end
		local dim = state == "done" or state == "reached"
		row.name:SetTextColor(unpack(dim and ns.RGB.mist or ns.RGB.white))
	end)
	right.list:SetPoint("TOPLEFT", right.card, "TOPLEFT", 6, -32)
	right.list:SetPoint("BOTTOMRIGHT", right.card, "BOTTOMRIGHT", -6, 6)
	right.empty = UI.Text(right.card, 12, ns.RGB.fog, { wrap = true })
	right.empty:SetPoint("TOPLEFT", 16, -44)
	right.empty:SetPoint("TOPRIGHT", -16, -44)
	right.empty:SetText("No points yet. Edit opens the planner: click a talent there to add a point.")

	-- The planner, over the whole page ---------------------------------------------------------------------------
	frame.planner = UI.TalentPlanner(frame, {
		onSave = function(plan)
			local b
			if plan.editing and ns.FindCustomBuild(plan.editing) then
				b = ns.UpdateBuild(plan.editing, plan.order, plan.name)
			else
				local name = ns.CleanBuildName(plan.name)
				b = ns.SaveBuild(plan.cls, plan.order, name ~= "" and name or ns.AutoBuildName(plan.cls, plan.ranks), { from = plan.base and "grimoire" or "planner", base = plan.base })
			end
			view.mode = "builds"
			view.cls = plan.cls
			view.build = b and b.id or view.build
			view.renaming, view.linkFor = nil, nil
			frame:Update()
		end,
		onClose = function()
			view.mode = "builds"
			frame:Update()
		end,
	})

	function frame:OpenPlanner(opts)
		UI.CloseMenu()
		view.mode = "plan"
		view.pasting, view.notice, view.renaming, view.linkFor = false, nil, nil, nil
		self.planner:Open(opts)
		self:Update()
	end

	--- New build: "talents" (from what you have spent), "link" (shows the box to paste one) or "plan" (an empty plan).
	function frame:NewBuild(how)
		view.renaming, view.linkFor = nil, nil
		if how == "talents" then
			view.pasting = false
			local b, info = ns.BuildFromTalents()
			if b then
				view.build = b.id
				view.notice = (info or 0) > 0 and { info .. " of your points do not fit Grimoire's trees and were left out.", "mist" } or nil
			else
				view.notice = { info, "red" }
			end
			self:Update()
		elseif how == "link" then
			view.pasting, view.notice = true, nil
			self:Update()
			self.paste:SetText("")
			self.paste:SetFocus()
		elseif how == "plan" then
			self:OpenPlanner({ cls = view.cls, order = {}, name = "" })
		end
	end

	--- Lays the action buttons out from the left, skipping hidden ones and going on to a second line when they do not fit
	--- (one of your builds that you follow has seven). Returns the height they take.
	local function layoutActions()
		local width = right:GetWidth()
		if not width or width <= 0 then
			width = 468
		end
		local x, y = 0, 0
		for _, b in ipairs(right.buttons) do
			if b:IsShown() then
				if x > 0 and x + b:GetWidth() > width then
					x, y = 0, y + 36
				end
				b:ClearAllPoints()
				b:SetPoint("TOPLEFT", right.actions, "TOPLEFT", x, -y)
				x = x + b:GetWidth() + 8
			end
		end
		right.actions:SetHeight(y + 28)
		return y + 28
	end

	function frame:Update()
		ns.UpdatePlayer()
		local P = ns.player
		if ns.pendingBuild then
			local b, cls = ns.FindBuild(ns.pendingBuild)
			ns.pendingBuild = nil
			if b then
				view.cls, view.build, view.mode = cls, b.id, "builds"
			end
		end
		view.cls = view.cls or P.class or "warrior"
		-- Grimoire moved the build you follow along its respec (Bars.lua): a page that showed it shows the new one.
		if view.followed and view.build == view.followed and ns.char.build and ns.char.build ~= view.followed then
			view.build = ns.char.build
		end
		view.followed = ns.char.build
		if view.mode == "plan" then
			self.browse:Hide()
			self.planner:Show()
			self.planner:Update()
			ns.RefreshHeader()
			return
		end
		self.planner:Hide()
		self.browse:Show()
		ns.RefreshHeader()

		-- The list, under the box to paste a link or a line about the last new build.
		local rows = listRows(view.cls)
		local found, foundCls = ns.FindBuild(view.build)
		if not found or foundCls ~= view.cls then
			local mine = ns.SelectedBuild()
			local first, other
			for _, r in ipairs(rows) do
				if not r.header and not r.more then
					first = first or r
					if not r.custom and r.kind ~= "leveling" then
						other = other or r
					end
				end
			end
			-- Below 60 the class's first leveling build comes up; at 60 the first of Grimoire's others (PvE first).
			local pick
			if (P.level or 1) < 60 then
				pick = ns.LevelingPick(view.cls)
			else
				pick = other
			end
			view.build = (mine and view.cls == P.class) and mine.id or (pick and pick.id) or (first and first.id)
		end
		for _, chip in ipairs(self.chips) do
			chip:SetSelected(chip.cls == view.cls)
		end
		local y = listTop
		self.paste:SetShown(view.pasting and true or false)
		if view.pasting then
			y = y + 34
		end
		local note = view.notice or (view.pasting and { "Paste a link from the talent calculator on wowgrimoire.app with Ctrl+V, then press Enter.", "mist" }) or nil
		self.notice:ClearAllPoints()
		if note then
			self.notice:SetPoint("TOPLEFT", 2, -y)
			self.notice:SetText(note[1])
			self.notice:SetTextColor(unpack(ns.RGB[note[2]] or ns.RGB.mist))
			self.notice:Show()
			y = y + math.ceil(self.notice:GetStringHeight()) + 12
		else
			self.notice:Hide()
		end
		self.listCard:ClearAllPoints()
		self.listCard:SetPoint("TOPLEFT", 0, -y)
		self.listCard:SetPoint("BOTTOMLEFT", 0, 0)
		self.listCard:SetWidth(LEFT)
		self.builds:SetData(rows, true)
		-- Bring a newly selected build into view (a new one is at the end of your builds).
		if self.revealed ~= view.build then
			self.revealed = view.build
			for i, r in ipairs(rows) do
				if r.id == view.build then
					self.builds:Reveal(i)
				end
			end
		end

		local b = ns.FindBuild(view.build)
		right:SetShown(b ~= nil)
		if not b then
			return
		end
		local own = view.cls == P.class
		local following = own and ns.char.build == b.id
		local custom = b.custom and true or false

		-- Title: the name, or the box to rename it; "Following" at the right.
		right.following:SetShown(following)
		local edge = following and right.following or nil
		local renaming = custom and view.renaming == b.id
		right.name:SetShown(not renaming)
		right.rename:SetShown(renaming)
		right.renameNote:SetShown(renaming)
		right.name:SetPoint("TOPRIGHT", edge or right, edge and "TOPLEFT" or "TOPRIGHT", edge and -12 or 0, 0)
		UI.FitFont(right.name, b.name, "bold", 18)
		right.name:SetText(b.name)

		local trees = ns.talents[view.cls].trees
		local split = {}
		for i, tree in ipairs(trees) do
			split[#split + 1] = tree.name .. " " .. ((b.points or {})[i] or 0)
		end
		local kind = custom and "Your build" or (specName(view.cls, b.spec) .. "  ·  " .. ns.BuildKindLabel(b.kind))
		right.meta:SetText(ns.ClassText(view.cls) .. ns.Hex(ns.HEX.mist, "  ·  " .. kind .. "  ·  " .. table.concat(split, " / ")))
		right.summary:SetText(b.summary or "")
		local evidence = not custom and evidenceText(b) or nil
		right.evidence:SetText(evidence or "")
		right.evidence:SetShown(evidence ~= nil)
		local y2 = 54 + math.ceil(right.summary:GetStringHeight()) + 14 + (evidence and (6 + math.ceil(right.evidence:GetStringHeight())) or 0)
		right.actions:ClearAllPoints()
		right.actions:SetPoint("TOPLEFT", 0, -y2)
		right.actions:SetPoint("TOPRIGHT", 0, -y2)

		-- Actions: Follow or Stop following (your class), Notes and Customize (Grimoire's), Edit, Rename, Link and
		-- Delete (yours).
		right.follow:SetShown(own)
		right.follow:SetLabel(following and "Stop following" or "Follow this build")
		right.follow:SetKind(not following and "primary" or nil)
		right.follow:FitWidth(110)
		right.follow.tip = following and "Level-ups stop naming a talent point; your talents stay as they are." or nil
		local hasBar = following and ns.Bars.Layout(b, view.cls) ~= nil
		right.bars:SetShown(hasBar)
		right.bars:SetSelected(hasBar and view.bars == b.id)
		right.bars:FitWidth(100)
		right.notes:SetShown(not custom and #b.notes > 0)
		right.notes:FitWidth(70)
		right.customize:SetShown(not custom)
		right.edit:SetShown(custom)
		right.renameButton:SetShown(custom)
		right.renameButton:SetSelected(renaming)
		right.link:SetShown(custom)
		right.link:SetSelected(custom and view.linkFor == b.id)
		right.delete:SetShown(custom)
		local armed = right.delete.armed and right.delete.armed == b.id
		if not armed then
			right.delete.armed = nil
		end
		right.delete:SetLabel(armed and "Click to delete" or "Delete")
		right.delete:SetSelected(armed)
		right.delete:FitWidth(60)
		right.delete.tip = armed and "Click again to delete this build for good." or nil
		local actionsHeight = layoutActions()

		-- Under the actions: how your talents compare, or the link to copy.
		local steps, state, nextStep, verified, ready = ns.BuildProgress(b, view.cls)
		self.state, self.nextStep = own and state or nil, own and nextStep or nil
		-- Levels move up to five sooner for a character with the Talented perk.
		self.shift = own and ns.PointShift() or 0
		local nextName = nextStep and nextStep.info and ns.Hex(ns.HEX.gold, nextStep.info.talent.name) or "?"
		local done = 0
		for _, s in ipairs(state) do
			if s == "done" then
				done = done + 1
			end
		end
		local text
		-- The respec the build you follow can make now (Bars.lua): under the point, or instead of it once none is left.
		local into = following and ns.Bars.OpenRespec(b, view.cls)
		local spent = into and ns.Bars.Complete(b, view.cls)
		if #steps == 0 then
			text = "No points planned yet."
		elseif spent then
			text = ns.Bars.RespecText(b, into, "Respec")
		elseif not own then
			text = "Every point in order, from level 10 to " .. ns.PointLevel(#steps, 0) .. "."
		elseif ns.PointsAvailable() == 0 then
			text = "Your first point comes at level " .. ns.PointLevel(1, self.shift) .. "."
		elseif ns.PlanEnded(b, view.cls) then
			text = verified and ns.Hex(ns.HEX.green, "Your talents match all " .. #steps .. " points this build plans.") .. " Edit it to plan the rest." or ("This build plans " .. #steps .. " points and you have more. Edit it to plan the rest.")
		elseif verified then
			if not nextStep then
				text = ns.Hex(ns.HEX.green, "Your talents match this build.")
			elseif ready then
				text = "Next: " .. nextName .. " (" .. done .. " of your points match)"
			else
				text = "At level " .. ns.PointLevel(nextStep.n, self.shift) .. ": " .. nextName .. " (" .. done .. " of your points match)"
			end
		else
			text = nextStep and ("Level " .. ns.PointLevel(nextStep.n, self.shift) .. ": " .. nextName) or ""
		end
		if into and not spent then
			text = text ~= "" and (text .. "\n" .. ns.Bars.RespecText(b, into, "Or respec")) or ns.Bars.RespecText(b, into, "Respec")
		end
		right.status:SetMaxLines(into and 5 or 2)
		right.status:SetText(text)
		local y3 = y2 + actionsHeight + 10
		local linking = custom and view.linkFor == b.id
		right.status:ClearAllPoints()
		right.linkBox:ClearAllPoints()
		right.linkNote:ClearAllPoints()
		right.status:SetShown(not linking)
		right.linkBox:SetShown(linking)
		right.linkNote:SetShown(linking)
		-- Learn next point, beside the status, while the build's next point is yours to spend: it says which point, or
		-- why the game would refuse it now (your talents went another way than the build's).
		local learnStep, why, blocked
		if following and ready and not linking then
			local step, how, other = ns.Bars.NextPoint(b, view.cls)
			if step then
				learnStep = step
			else
				why, blocked = how, other
			end
		end
		self.learnStep = learnStep
		local showLearn = learnStep ~= nil or why == "tier" or why == "prereq" or why == "max"
		right.learn:SetShown(showLearn)
		if showLearn then
			local waits = ns.Bars.Waiting("talent")
			right.learn:SetEnabled(learnStep ~= nil and not waits)
			local shown = learnStep or blocked or nextStep
			local t = shown and shown.info and shown.info.talent
			right.learn.tipTitle = t and t.name or "Learn next point"
			local lines = {}
			if t then
				lines[#lines + 1] = { shown.info.treeName .. ", rank " .. shown.rank .. " of " .. t.max, 0.64, 0.62, 0.58 }
				if t.desc and t.desc[shown.rank] then
					lines[#lines + 1] = { t.desc[shown.rank], 1, 0.82, 0 }
				end
			end
			if waits then
				lines[#lines + 1] = { "Waits for the end of combat.", 1, 1, 1 }
			elseif learnStep then
				lines[#lines + 1] = { "Spends one talent point here now, as your build says." .. (InCombatLockdown and InCombatLockdown() and " In combat, it waits for the fight to end." or ""), 1, 1, 1 }
			else
				lines[#lines + 1] = { "Not now: " .. (ns.Bars.WHY[why] or "the game would not allow it."), 1, 0.5, 0.42 }
			end
			right.learn.tipLines = lines
		end
		if linking then
			right.linkBox.value = ns.BuildLink(view.cls, b.order)
			right.linkBox:SetText(right.linkBox.value)
			right.linkBox:SetCursorPosition(0)
			right.linkBox:SetPoint("TOPLEFT", 0, -y3)
			right.linkBox:SetPoint("TOPRIGHT", 0, -y3)
			right.linkNote:SetPoint("TOPLEFT", 2, -(y3 + 36))
			right.linkNote:SetPoint("TOPRIGHT", 0, -(y3 + 36))
			y3 = y3 + 36 + 14 + 14
		else
			if showLearn then
				right.learn:ClearAllPoints()
				right.learn:SetPoint("TOPRIGHT", right, "TOPRIGHT", 0, -(y3 - 5))
			end
			right.status:SetPoint("TOPLEFT", 0, -y3)
			right.status:SetPoint("TOPRIGHT", showLearn and -(right.learn:GetWidth() + 12) or 0, -y3)
			y3 = y3 + math.max(showLearn and 20 or 14, math.ceil(right.status:GetStringHeight())) + 14
		end
		-- The bars preview, between the status and the points, while Set up my bars is open.
		local showBars = hasBar and view.bars == b.id
		right.barsPanel:SetShown(showBars)
		if showBars then
			right.barsPanel:ClearAllPoints()
			right.barsPanel:SetPoint("TOPLEFT", 0, -y3)
			right.barsPanel:SetPoint("TOPRIGHT", 0, -y3)
			right.barsPanel:Update()
			y3 = y3 + right.barsPanel:GetHeight() + 12
		end
		right.card:ClearAllPoints()
		right.card:SetPoint("TOPLEFT", 0, -y3)
		right.card:SetPoint("BOTTOMRIGHT")
		right.empty:SetShown(#steps == 0)
		right.head:SetShown(#steps > 0)
		local fresh = self.shownBuild ~= b.id or self.shownCount ~= #steps
		self.shownBuild, self.shownCount = b.id, #steps
		right.list:SetData(steps, not fresh)
		if fresh then
			-- A build opens on your next point, or at its first.
			right.list:ScrollTo(nextStep and own and math.max(1, nextStep.n - 4) or 1)
		end
	end

	-- A set-up, an undo or a point that waited for combat to end: the buttons and the preview follow.
	ns.Listen("BARS", function()
		if frame:IsVisible() and view.mode == "builds" then
			frame:Update()
		end
	end)
end

ns.AddTab({
	key = "talents",
	label = "Talents",
	icon = "Ability_Marksmanship",
	order = 2,
	title = function()
		return view.mode == "plan" and "Talent planner" or "Talents"
	end,
	lede = function()
		if view.mode == "plan" then
			return ns.ClassText(view.cls) .. ns.Hex(ns.HEX.mist, "  ·  Click a talent to add a point, right-click to take its last point back.")
		end
		return "Grimoire's builds and your own, point by point, checked against your talents."
	end,
	build = build,
	show = function(frame)
		-- once your talents fit the build a respec goes into, the build you follow is that one (Bars.lua)
		ns.Bars.FollowPath()
		frame:Update()
	end,
})
