-- The home page: this character at a glance. Its model on the left with its racials under it, and beside it a few tiles
-- with what matters now: the next talent point, the trainer, where to level, Legacy points and the next upgrades. The
-- details are in tooltips.
local _, ns = ...
local UI = ns.UI

--- Questing zones and route notes for a level and faction.
function ns.ZonesFor(level, faction)
	local byId = {}
	for _, z in ipairs(ns.zones) do
		byId[z.id] = z
	end
	local out, notes, seen = {}, {}, {}
	for _, band in ipairs(ns.route) do
		if level >= band.lo and level <= band.hi then
			notes[#notes + 1] = band.note
			for _, id in ipairs(band[faction] or band.alliance) do
				if not seen[id] and byId[id] then
					seen[id] = true
					out[#out + 1] = byId[id]
				end
			end
		end
	end
	return out, notes
end

--- Dungeons whose level range takes in a level.
function ns.DungeonsFor(level)
	local out = {}
	for _, d in ipairs(ns.dungeons) do
		if d.kind == "dungeon" and d.lo > 0 and level >= d.lo - 2 and level <= d.hi then
			out[#out + 1] = d
		end
	end
	table.sort(out, function(a, b)
		return a.lo < b.lo
	end)
	return out
end

local HERO, GAP = 236, 12
local ROWS = 4 -- zones, dungeons and racials shown in a tile

local function rgbOf(hex)
	return { tonumber(hex:sub(1, 2), 16) / 255, tonumber(hex:sub(3, 4), 16) / 255, tonumber(hex:sub(5, 6), 16) / 255 }
end

--- A tile: a card with a small title.
local function tile(parent, title)
	local t = UI.Card(parent)
	t.title = UI.Text(t, 11, ns.RGB.mist, { weight = "medium" })
	t.title:SetPoint("TOPLEFT", 16, -14)
	t.title:SetPoint("TOPRIGHT", -16, -14)
	t.title:SetText(title or "")
	return t
end

--- A small rounded tag: tone is "gold" (ready), "green" (done) or "plain".
local function pill(parent)
	local f = CreateFrame("Frame", nil, parent)
	f:SetHeight(22)
	local s = UI.Surface(f, 11)
	f.text = UI.Text(f, 11, ns.RGB.gold, { weight = "bold", justify = "CENTER" })
	f.text:SetPoint("CENTER", 0, 0.5)
	function f:Set(text, tone)
		self.text:SetText(text)
		self:SetWidth(math.ceil(UI.TextWidth(self.text)) + 22)
		local c = tone == "green" and ns.RGB.green or tone == "plain" and { 1, 1, 1 } or UI.colors.gilt
		local t = tone == "green" and ns.RGB.new or tone == "plain" and ns.RGB.text or ns.RGB.gold
		s:SetFill(c[1], c[2], c[3], tone == "plain" and 0.06 or 0.14)
		s:SetBorder(c[1], c[2], c[3], tone == "plain" and 0.12 or 0.45)
		self.text:SetTextColor(t[1], t[2], t[3], 1)
		self:Show()
	end
	return f
end

--- An icon with a tooltip: a spell (ic.spell) or a title and lines (ic.tipTitle, ic.tipLines).
local function hoverIcon(parent, size)
	local ic = UI.Icon(parent, size)
	ic:EnableMouse(true)
	ic:SetScript("OnEnter", function(self)
		if self.spell then
			local lines, rank = {}, ns.RankLabel(self.spell.rank)
			if rank ~= "" then
				lines[1] = rank
			end
			lines[#lines + 1] = "Learned at level " .. self.spell.level
			UI.SpellTooltip(self, self.spell.id, self.spell.name, lines)
		elseif self.tipTitle then
			UI.TextTooltip(self, self.tipTitle, self.tipLines or {})
		end
	end)
	ic:SetScript("OnLeave", function()
		GameTooltip:Hide()
	end)
	return ic
end

-- The character ---------------------------------------------------------------------------------------------------

local function buildHero(frame)
	local card = UI.Card(frame)
	card:SetPoint("TOPLEFT")
	card:SetPoint("BOTTOMLEFT")
	card:SetWidth(HERO)
	-- The class's colour as a soft light behind the character, inside the card, and a shadow under the feet.
	card.glow = card:CreateTexture(nil, "BORDER")
	card.glow:SetTexture(UI.MEDIA .. "Glow.tga")
	card.glow:SetSize(HERO - 4, 300)
	card.glow:SetPoint("CENTER", card, "CENTER", 0, 40)
	card.floor = card:CreateTexture(nil, "BORDER", nil, 1)
	card.floor:SetTexture(UI.MEDIA .. "Glow.tga")
	card.floor:SetSize(200, 40)
	card.floor:SetPoint("BOTTOM", card, "BOTTOM", 0, 116)
	card.floor:SetVertexColor(0, 0, 0, 0.6)
	-- The model turns as you drag it.
	local model = CreateFrame("PlayerModel", nil, card)
	model:SetPoint("TOPLEFT", 1, -30)
	model:SetPoint("BOTTOMRIGHT", -1, 100)
	model:EnableMouse(true)
	model.rotation = 0.6
	-- The character is loaded when the page shows, not on every refresh; the game says when it changes (new gear, a
	-- shapeshift) and the model follows.
	function model:Load()
		self:SetUnit("player")
		self:SetPortraitZoom(0)
		self:SetRotation(self.rotation, false)
		self.loaded = true
	end
	model:SetScript("OnShow", model.Load)
	if model.RegisterUnitEvent then
		model:RegisterUnitEvent("UNIT_MODEL_CHANGED", "player")
	end
	model:SetScript("OnEvent", function(self)
		if self:IsVisible() and self.RefreshUnit then
			self:RefreshUnit()
			self:SetRotation(self.rotation, false)
		end
	end)
	-- Turning runs only while the button is held, and straight to the angle (the game would ease into each one).
	local function turn(self)
		local x = GetCursorPosition()
		self.rotation = (self.rotation + (x - self.dragX) * 0.012) % (2 * math.pi)
		self.dragX = x
		self:SetRotation(self.rotation, false)
	end
	local function stop(self)
		self.dragX = nil
		self:SetScript("OnUpdate", nil)
	end
	model:SetScript("OnMouseDown", function(self, button)
		if button == "LeftButton" then
			self.dragX = GetCursorPosition()
			self:SetScript("OnUpdate", turn)
		end
	end)
	model:SetScript("OnMouseUp", stop)
	model:SetScript("OnHide", function(self)
		stop(self)
		self.loaded = false
	end)
	card.model = model
	card.hint = UI.Text(card, 10.5, ns.RGB.fog, { justify = "CENTER" })
	card.hint:SetPoint("TOP", 0, -12)
	card.hint:SetText("Drag to turn")
	card.guide = UI.Button(card, "Class guide", HERO - 32, 28)
	card.guide:SetPoint("BOTTOMLEFT", 16, 18)
	card.guide:SetPoint("BOTTOMRIGHT", -16, 18)
	-- The racials, a row of icons over the guide's button: each says what it does on hover.
	card.racials = {}
	for i = 1, 6 do
		local ic = hoverIcon(card, 28)
		ic:Hide()
		card.racials[i] = ic
	end
	return card
end

--- The character's racials: a class's own version of one replaces the shared one; those only the class gets come after.
local function racialsOf(P)
	local race = ns.races[P.race or ""]
	local cls = ns.classes[P.class or ""]
	if not race then
		return {}
	end
	local variants, items, own = {}, {}, {}
	for _, v in ipairs(race.variants[P.class or ""] or {}) do
		variants[v.name] = v
	end
	for _, r in ipairs(race.racials) do
		items[#items + 1] = variants[r.name] or r
		own[r.name] = true
	end
	for _, v in ipairs(race.variants[P.class or ""] or {}) do
		if not own[v.name] then
			items[#items + 1] = { name = v.name, icon = v.icon, desc = v.desc, passive = v.passive, only = cls and cls.name }
		end
	end
	return items, race
end

local function showHero(card)
	local P = ns.player
	local cls = ns.classes[P.class or ""]
	local c = cls and rgbOf(cls.color) or UI.colors.gilt
	card.glow:SetVertexColor(c[1], c[2], c[3], 0.3)
	if not card.model.loaded then
		card.model:Load()
	end
	card.guide:SetLabel(cls and (cls.name .. " guide") or "Guides")
	-- What Forever changed for the class, on hover over its guide.
	if cls and cls.forever and cls.forever ~= "" then
		card.guide.tipTitle = "What changed for " .. cls.name .. "s"
		card.guide.tipLines = { cls.forever, { "Click for the full " .. cls.name .. " guide.", 0.64, 0.62, 0.58 } }
	else
		card.guide.tipTitle, card.guide.tipLines = nil, nil
	end
	card.guide:SetScript("OnClick", function()
		if P.class and ns.OpenGuide then
			ns.OpenGuide(P.class)
		else
			ns.Open("guides")
		end
	end)
	local items, race = racialsOf(P)
	local n = math.min(#items, #card.racials)
	local size, gap = 28, 8
	local x0 = (HERO - (n * size + (n - 1) * gap)) / 2
	for i, ic in ipairs(card.racials) do
		local x = items[i]
		if x and i <= n then
			ic:SetIcon(ns.Icon(x.icon))
			ic.tipTitle = x.name
			ic.tipLines = { x.desc, { (race and race.name or "") .. " racial" .. (x.passive and ", passive" or "") .. (x.only and (", " .. x.only .. " only") or ""), 0.64, 0.62, 0.58 } }
			ic:ClearAllPoints()
			ic:SetPoint("BOTTOMLEFT", card, "BOTTOMLEFT", x0 + (i - 1) * (size + gap), 60)
			ic:Show()
		else
			ic:Hide()
		end
	end
end

-- The tiles -------------------------------------------------------------------------------------------------------

local function buildTalent(t)
	t.icon = hoverIcon(t, 42)
	t.icon:SetPoint("TOPLEFT", 16, -38)
	t.name = UI.Text(t, 14, ns.RGB.white, { weight = "bold", wrap = true, spacing = 1 })
	t.name:SetPoint("TOPLEFT", 70, -39)
	t.name:SetPoint("TOPRIGHT", -14, -39)
	t.name:SetMaxLines(2)
	t.sub = UI.Text(t, 11.5, ns.RGB.mist)
	t.sub:SetPoint("TOPLEFT", t.name, "BOTTOMLEFT", 0, -4)
	t.sub:SetPoint("TOPRIGHT", t.name, "BOTTOMRIGHT", 0, -4)
	t.pill = pill(t)
	t.pill:SetPoint("TOPLEFT", 16, -96)
	t.button = UI.Button(t, "Open my build", 120, 28, function()
		ns.Open("talents")
	end, "primary")
	t.button:SetPoint("BOTTOMLEFT", 16, 16)
end

local function showTalent(t)
	local P = ns.player
	local cls = ns.classes[P.class or ""]
	local build = ns.SelectedBuild()
	t.icon.spell, t.icon.tipTitle, t.icon.tipLines = nil, nil, nil
	t.pill:Hide()
	if build then
		local _, state, nextStep, verified, ready = ns.BuildProgress(build, P.class)
		local lines = {}
		if nextStep and nextStep.info then
			local info = nextStep.info
			local tal = info.talent
			t.icon:SetIcon(ns.Icon(tal.icon))
			t.name:SetText(tal.name)
			t.sub:SetText(info.treeName .. "  ·  rank " .. nextStep.rank .. " of " .. tal.max)
			t.icon.tipTitle = tal.name
			if tal.desc and tal.desc[nextStep.rank] then
				lines[#lines + 1] = tal.desc[nextStep.rank]
			end
			lines[#lines + 1] = { build.name .. ", point " .. nextStep.n .. ".", 0.64, 0.62, 0.58 }
			if ready then
				t.pill:Set("Ready to spend", "gold")
			else
				t.pill:Set("At level " .. ns.PointLevel(nextStep.n), "plain")
			end
		elseif ns.PlanEnded(build, P.class) then
			-- A build of your own that plans fewer points than you have.
			t.icon:SetIcon(ns.Icon(cls and cls.icon))
			t.name:SetText("No point planned")
			t.sub:SetText(build.name)
			t.icon.tipTitle = build.name
			lines[#lines + 1] = "This build plans " .. #build.order .. " of 51 points and you have more. Edit it on the Talents page to plan the rest."
			t.pill:Set("Plan more", "plain")
		else
			t.icon:SetIcon(ns.Icon(cls and cls.icon))
			t.name:SetText(verified and "Every point matches" or build.name)
			t.sub:SetText(build.name)
			t.icon.tipTitle = build.name
			t.pill:Set(verified and "Done" or "Following", verified and "green" or "plain")
		end
		local missing = 0
		for _, s in ipairs(state) do
			if s == "missing" then
				missing = missing + 1
			end
		end
		if missing > 1 then
			lines[#lines + 1] = { missing .. " points of the build are still unspent or elsewhere.", 0.94, 0.5, 0.42 }
		end
		t.icon.tipLines = lines
		t.button:SetLabel("Open my build")
	else
		t.icon:SetIcon(ns.Icon(cls and cls.icon))
		t.name:SetText("No build yet")
		t.sub:SetText(ns.PointsAvailable() == 0 and "Talents start at level 10" or "Pick one to follow")
		t.icon.tipTitle = "Talent builds"
		t.icon.tipLines = { "Follow a build for your class, one of Grimoire's or your own, and this tile shows each point as it comes." }
		t.button:SetLabel("Choose a build")
	end
	t.button:FitWidth(110)
end

local function buildTrainer(t)
	t.count = UI.Text(t, 30, ns.RGB.white, { weight = "bold" })
	t.count:SetPoint("TOPLEFT", 16, -36)
	t.unit = UI.Text(t, 12, ns.RGB.mist)
	t.unit:SetPoint("BOTTOMLEFT", t.count, "BOTTOMRIGHT", 8, 4)
	t.unit:SetWidth(150)
	t.icons = {}
	for i = 1, 5 do
		local ic = hoverIcon(t, 28)
		ic:SetPoint("TOPLEFT", 16 + (i - 1) * 34, -90)
		t.icons[i] = ic
	end
	t.more = UI.Text(t, 11, ns.RGB.fog)
	t.button = UI.Button(t, "All abilities", 110, 28, function()
		ns.Open("abilities")
	end)
	t.button:FitWidth(100)
	t.button:SetPoint("BOTTOMLEFT", 16, 16)
end

local function showTrainer(t)
	local P = ns.player
	local list = ns.ToTrain(P.level)
	local shown
	if #list > 0 then
		t.count:SetText(#list)
		t.unit:SetText(#list == 1 and "spell to train now" or "spells to train now")
		shown = list
	else
		local at, nextList = ns.NextSpells(P.level)
		t.count:SetText(at or "-")
		t.unit:SetText(at and "next level with new spells" or "nothing left to train")
		shown = nextList or {}
	end
	local n = 0
	for i, ic in ipairs(t.icons) do
		local a = shown[i]
		if a then
			ic:SetIcon(ns.Icon(a.icon))
			ic.spell = a
			ic:Show()
			n = i
		else
			ic.spell = nil
			ic:Hide()
		end
	end
	t.more:ClearAllPoints()
	if #shown > n and n > 0 then
		t.more:SetPoint("LEFT", t.icons[n], "RIGHT", 8, 0)
		t.more:SetText("+" .. (#shown - n))
		t.more:Show()
	else
		t.more:Hide()
	end
end

--- A short list of rows in a tile: a gold dot and a text; onClick makes them buttons.
local function rows(t, count, onClick)
	local out = {}
	for i = 1, count do
		local r = onClick and UI.Row(t) or CreateFrame("Frame", nil, t)
		r:SetHeight(22)
		r.dot = r:CreateTexture(nil, "ARTWORK")
		r.dot:SetTexture(UI.MEDIA .. "Disc16.tga")
		r.dot:SetSize(5, 5)
		r.dot:SetPoint("LEFT", 8, 0)
		r.dot:SetVertexColor(unpack(UI.colors.gilt))
		r.text = UI.Text(r, 12, ns.RGB.white)
		r.text:SetPoint("LEFT", 20, 0.5)
		r.text:SetPoint("RIGHT", -4, 0.5)
		if onClick then
			r:SetScript("OnClick", function(self)
				if self.item then
					onClick(self.item)
				end
			end)
			r:HookScript("OnEnter", function(self)
				if self.item then
					UI.TextTooltip(self, self.item.name, { { "Click to see its loot.", 0.64, 0.62, 0.58 } })
				end
			end)
			r:HookScript("OnLeave", function()
				GameTooltip:Hide()
			end)
		end
		out[i] = r
	end
	return out
end

local function place(list, left, right, top)
	for i, r in ipairs(list) do
		r:ClearAllPoints()
		r:SetPoint("TOPLEFT", left, -(top + (i - 1) * 23))
		r:SetPoint("TOPRIGHT", right, -(top + (i - 1) * 23))
	end
end

local function buildLevel(t)
	t.title:SetText("Questing zones")
	t.dtitle = UI.Text(t, 11, ns.RGB.mist, { weight = "medium" })
	t.dtitle:SetText("Dungeons for your level")
	t.zones = rows(t, ROWS)
	t.dungeons = rows(t, ROWS, function(d)
		if ns.OpenDungeon then
			ns.OpenDungeon(d.slug)
		else
			ns.Open("dungeons")
		end
	end)
	t.route = UI.Button(t, "Leveling route", 120, 28, function()
		ns.Open("leveling")
	end)
	t.route:FitWidth(110)
	t.route:SetPoint("BOTTOMLEFT", 16, 16)
	t.all = UI.Button(t, "Dungeons and loot", 140, 28, function()
		ns.Open("dungeons")
	end)
	t.all:FitWidth(120)
	function t:Layout()
		local w = self:GetWidth() or 0
		if w <= 0 then
			return
		end
		local half = math.floor(w / 2)
		self.title:ClearAllPoints()
		self.title:SetPoint("TOPLEFT", 16, -14)
		self.title:SetWidth(half - 24)
		place(self.zones, 8, -(w - half + 6), 36)
		place(self.dungeons, half + 4, -8, 36)
		self.dtitle:ClearAllPoints()
		self.dtitle:SetPoint("TOPLEFT", half + 12, -14)
		self.all:ClearAllPoints()
		self.all:SetPoint("BOTTOMLEFT", half + 12, 16)
	end
	t:SetScript("OnSizeChanged", function(self)
		self:Layout()
	end)
end

local function levelText(name, lo, hi, isNew)
	-- A zone whose levels are not announced yet just says it is new.
	local levels = (lo and lo > 0) and ns.Hex(ns.HEX.mist, "  " .. ns.Levels(lo, hi)) or ""
	return ns.Hex(ns.HEX.white, name) .. levels .. (isNew and ns.Hex(ns.HEX.new, "  new") or "")
end

local GUIDE_DOT = { "gold", "green", "white", "blue", "blue", "blue", "blue", "gold", "red", "blue", "blue" }

local function showLevel(t)
	local P = ns.player
	t:Layout()
	local zones, notes = ns.ZonesFor(math.min(60, P.level), P.faction or "alliance")
	local Guide = ns.Guide
	local at, step, route
	if Guide and ns.guide then
		at, step, route = Guide.Index()
	end
	if at then
		-- The leveling guide's step to do now and the next ones.
		t.title:SetText("Leveling guide" .. ns.Hex(ns.HEX.fog, "   step " .. at .. " of " .. #route.steps))
		local list = { step }
		for _, s in ipairs(Guide.Upcoming(#t.zones - 1)) do
			list[#list + 1] = s
		end
		for i, r in ipairs(t.zones) do
			local s = list[i]
			if s then
				local c = ns.RGB[GUIDE_DOT[s[1]] or "gold"] or UI.colors.gilt
				r.dot:SetVertexColor(c[1], c[2], c[3], 1)
				r.text:SetText(i == 1 and ns.Hex(ns.HEX.white, Guide.Short(s)) or ns.Hex(ns.HEX.mist, Guide.Short(s)))
				r:Show()
			else
				r:Hide()
			end
		end
		t.route:SetLabel("Step by step")
		t.route:FitWidth(110)
	else
		t.title:SetText("Questing zones")
		for i, r in ipairs(t.zones) do
			local z = zones[i]
			if z then
				local extra = (i == #t.zones and #zones > i) and ns.Hex(ns.HEX.fog, "  +" .. (#zones - i)) or ""
				r.dot:SetVertexColor(unpack(UI.colors.gilt))
				r.text:SetText(levelText(z.name, z.lo, z.hi, z.new) .. extra)
				r:Show()
			else
				r:Hide()
			end
		end
	end
	-- The route's note for this level shows on hover over the zones' title.
	t.note = notes[#notes]
	local dungeons = ns.DungeonsFor(P.level)
	for i, r in ipairs(t.dungeons) do
		local d = dungeons[i]
		if d then
			r.item = d
			local extra = (i == #t.dungeons and #dungeons > i) and ns.Hex(ns.HEX.fog, "  +" .. (#dungeons - i)) or ""
			r.text:SetText(levelText(d.name, d.lo, d.hi, d.isNew) .. extra)
			r:Show()
		else
			r.item = nil
			r:Hide()
		end
	end
	t.dtitle:SetText(#dungeons > 0 and "Dungeons for your level" or "No dungeon for your level yet")
end

local function buildLegacy(t)
	t.count = UI.Text(t, 30, ns.RGB.white, { weight = "bold" })
	t.count:SetPoint("TOPLEFT", 16, -36)
	t.total = UI.Text(t, 16, ns.RGB.mist, { weight = "bold" })
	t.total:SetPoint("BOTTOMLEFT", t.count, "BOTTOMRIGHT", 4, 3)
	t.unit = UI.Text(t, 12, ns.RGB.mist)
	t.unit:SetPoint("TOPLEFT", 16, -82)
	t.unit:SetPoint("TOPRIGHT", -16, -82)
	-- A progress bar: a track and its gold fill.
	t.track = CreateFrame("Frame", nil, t)
	t.track:SetHeight(6)
	t.track:SetPoint("TOPLEFT", 16, -110)
	t.track:SetPoint("TOPRIGHT", -16, -110)
	UI.Shape(t.track, 3, { 1, 1, 1, 0.08 })
	t.fill = CreateFrame("Frame", nil, t.track)
	t.fill:SetPoint("TOPLEFT")
	t.fill:SetPoint("BOTTOMLEFT")
	t.fill:SetWidth(6)
	UI.Shape(t.fill, 3, UI.colors.gilt, "ARTWORK")
	t.button = UI.Button(t, "Open Legacy", 110, 28, function()
		ns.Open("legacy")
	end)
	t.button:FitWidth(100)
	t.button:SetPoint("BOTTOMLEFT", 16, 16)
end

local function showLegacy(t)
	local L = ns.Legacy
	if not (L and ns.legacy) then
		t:Hide()
		return
	end
	local earned, total = L.Earned(), ns.legacy.total
	t.count:SetText(earned)
	t.total:SetText("/ " .. total)
	local w = t.track:GetWidth() or 0
	if w <= 0 then
		w = (t:GetWidth() or 232) - 32
	end
	t.fill:SetWidth(math.max(6, math.floor(w * math.min(1, earned / math.max(1, total)))))
	t.unit:SetText("Legacy Points earned")
end

local function buildUpgrades(t)
	t.title:SetText("Next upgrades")
	t.list = {}
	for i = 1, ROWS - 1 do
		local r = CreateFrame("Button", nil, t)
		r:SetHeight(28)
		r:SetPoint("TOPLEFT", 16, -(36 + (i - 1) * 32))
		r:SetPoint("TOPRIGHT", -12, -(36 + (i - 1) * 32))
		r.icon = UI.Icon(r, 26)
		r.icon:SetPoint("LEFT", 0, 0)
		r.gain = UI.Text(r, 12, ns.RGB.green, { weight = "bold", justify = "RIGHT" })
		r.gain:SetPoint("RIGHT", -2, 0.5)
		r.text = UI.Text(r, 12, ns.RGB.white, { weight = "medium" })
		r.text:SetPoint("LEFT", 36, 0.5)
		r.text:SetPoint("RIGHT", r.gain, "LEFT", -8, 0.5)
		r:SetScript("OnEnter", function(self)
			if self.id then
				UI.ItemTooltip(self, self.id)
			end
		end)
		r:SetScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		r:SetScript("OnClick", function(self)
			if self.id and IsModifiedClick and (IsModifiedClick("CHATLINK") or IsModifiedClick("DRESSUP")) then
				UI.ItemClick(self.id)
				return
			end
			ns.char.itemsView = "gear"
			ns.Open("items")
		end)
		t.list[i] = r
	end
	t.none = UI.Text(t, 12, ns.RGB.mist, { wrap = true })
	t.none:SetPoint("TOPLEFT", 16, -40)
	t.none:SetPoint("TOPRIGHT", -16, -40)
	t.button = UI.Button(t, "All slots", 90, 28, function()
		ns.char.itemsView = "gear"
		ns.Open("items")
	end)
	t.button:FitWidth(80)
	t.button:SetPoint("BOTTOMLEFT", 16, 16)
end

local function showUpgrades(t)
	if not ns.Gear then
		t:Hide()
		return
	end
	-- The biggest upgrades near your level, one a slot, an upgrade you can wear now first.
	local list = {}
	for _, r in ipairs(ns.Gear.SlotUpgrades()) do
		if r.best then
			list[#list + 1] = r
		end
	end
	table.sort(list, function(a, b)
		if (a.best.from ~= nil) ~= (b.best.from ~= nil) then
			return a.best.from == nil
		end
		return a.best.rank > b.best.rank
	end)
	for i, row in ipairs(t.list) do
		local r = list[i]
		if r then
			local it = r.best.it
			row.id = r.best.id
			row.icon:SetIcon(ns.Icon(it[7]), it[2])
			row.text:SetText(ns.QualityText(it[2], it[1]))
			row.gain:SetText(r.best.empty and "new" or ns.Gear.Percent(r.best.pct))
			row:Show()
		else
			row.id = nil
			row:Hide()
		end
	end
	t.none:SetShown(#list == 0)
	t.none:SetText("Nothing better near your level.")
end

local function build(frame)
	frame.hero = buildHero(frame)
	local area = CreateFrame("Frame", nil, frame)
	area:SetPoint("TOPLEFT", HERO + GAP, 0)
	area:SetPoint("BOTTOMRIGHT")
	frame.area = area
	local TOP_H, MID_H = 176, 190
	frame.talent = tile(area, "Next talent point")
	frame.talent:SetPoint("TOPLEFT")
	frame.talent:SetPoint("TOPRIGHT", area, "TOP", -GAP / 2, 0)
	frame.talent:SetHeight(TOP_H)
	buildTalent(frame.talent)
	frame.trainer = tile(area, "Your trainer")
	frame.trainer:SetPoint("TOPLEFT", area, "TOP", GAP / 2, 0)
	frame.trainer:SetPoint("TOPRIGHT")
	frame.trainer:SetHeight(TOP_H)
	buildTrainer(frame.trainer)
	frame.level = tile(area, "")
	frame.level:SetPoint("TOPLEFT", 0, -(TOP_H + GAP))
	frame.level:SetPoint("TOPRIGHT", 0, -(TOP_H + GAP))
	frame.level:SetHeight(MID_H)
	buildLevel(frame.level)
	local y = TOP_H + MID_H + 2 * GAP
	frame.legacy = tile(area, "Legacy")
	frame.legacy:SetPoint("TOPLEFT", 0, -y)
	frame.legacy:SetPoint("BOTTOMRIGHT", area, "BOTTOM", -GAP / 2, 0)
	buildLegacy(frame.legacy)
	frame.upgrades = tile(area, "Next upgrades")
	frame.upgrades:SetPoint("TOPLEFT", area, "TOP", GAP / 2, -y)
	frame.upgrades:SetPoint("BOTTOMRIGHT")
	buildUpgrades(frame.upgrades)
	-- The route's note for this level, on hover over the zones' title.
	local hit = CreateFrame("Frame", nil, frame.level)
	hit:SetPoint("TOPLEFT", 8, -6)
	hit:SetSize(150, 22)
	hit:EnableMouse(true)
	hit:SetScript("OnEnter", function(self)
		if frame.level.note then
			UI.TextTooltip(self, "Where to level", { frame.level.note })
		end
	end)
	hit:SetScript("OnLeave", function()
		GameTooltip:Hide()
	end)
end

local function show(frame)
	ns.UpdatePlayer()
	showHero(frame.hero)
	showTalent(frame.talent)
	showTrainer(frame.trainer)
	showLevel(frame.level)
	showLegacy(frame.legacy)
	showUpgrades(frame.upgrades)
end

ns.AddTab({
	key = "home",
	label = "Home",
	icon = "INV_Misc_Book_09",
	order = 1,
	-- The header is the character: name, then level, race, class and faction.
	title = function()
		return ns.player.name or "Adventurer"
	end,
	lede = function()
		local P = ns.player
		local race = ns.races[P.race or ""]
		local cls = ns.classes[P.class or ""]
		local who = (race and race.name or "") .. " " .. (cls and ns.ClassText(P.class) or "")
		return "Level " .. P.level .. " " .. who .. (P.faction and ("  ·  " .. (P.faction == "horde" and "Horde" or "Alliance")) or "")
	end,
	build = build,
	show = show,
})
