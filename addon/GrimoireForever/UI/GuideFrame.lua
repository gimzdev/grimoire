-- The leveling guide's window: a card for the step to do now, or for the run of steps the guide groups at one place.
-- At its left a compass whose arrow turns toward the place, with the distance and the time to walk it; beside it the
-- step's kind, then the step in words: what (the quest, the flight, the trainer), who and, when it is not the zone you
-- are in, where; then its checklist, the objectives as the quest log counts them, counts and experience in one column
-- at the right. The buttons sit at the top right, quiet until the cursor comes: back and next look through the route
-- without moving your place, Current comes back to it, the list button opens the route under the card, and the cross
-- hides the window. Under the card your level's experience, with what its quests still to hand in will add; then what
-- comes next, or the route as a list that scrolls, yours marked in gold. The window's top edge stays put and its height
-- follows what it shows, until you size it from its bottom right corner. Drag it anywhere, scale it with Ctrl and the
-- mouse wheel; right-click it for its look, its units and the lock that keeps it as it is.
local _, ns = ...
local UI = ns.UI
local Guide = ns.Guide

local WIDTH = 300 -- its width until you size it (its height follows its card, up to FIT_H)
local MIN_W, MIN_H, MAX_W, MAX_H = 240, 76, 520, 640
local FIT_H = 560 -- the tallest it grows to fit a card, and the list under it
local MIN_SCALE, MAX_SCALE = 0.7, 1.5
local RADIUS = 10 -- the card's corners
local TOP = 11 -- the card's top margin: the compass and the kind's row start here
local ROW = 18 -- the middle of the top row, where the kind and the buttons sit
local BUTTON = 20 -- the buttons' size
local FOOT = 26 -- the footer: what comes next
local COL = 54 -- the compass's column, as wide as its longest distance ("1,234 yd")
local GAP = 10 -- between the compass and the words
local XP_H = 2 -- the experience bar
local LIST_H = 198 -- the route's list, in a window that fits what it shows
local LIST_MIN = 58 -- the least room it takes in a window sized by hand: a visit's heading and two lines
local ROW_ZONE, ROW_HEAD, ROW_ITEM = 22, 21, 18 -- its rows: a zone, a visit's heading, and each line under it
local LIST_BACK, LIST_AHEAD = 4, 60 -- the visits it holds before yours and after it
local EASE = 0.035 -- the arrow's time constant: it settles within about a tenth of a second
local POP = 0.3 -- the check's time to grow in when you arrive
local TAU = 2 * math.pi
local LAYOUT = 2 -- the window's layout: a place or size saved for an earlier one is let go

local KIND_COLOR = {
	[Guide.ACCEPT] = "gold",
	[Guide.TURNIN] = "green",
	[Guide.DO] = "white",
	[Guide.ZONE] = "blue",
	[Guide.FLY] = "blue",
	[Guide.BOAT] = "blue",
	[Guide.FLIGHTPATH] = "blue",
	[Guide.TRAIN] = "gold",
	[Guide.GRIND] = "red",
	[Guide.HEARTH] = "blue",
	[Guide.BIND] = "blue",
	[Guide.TELEPORT] = "blue",
}

local HEARTHSTONE_ICON = "Interface\\Icons\\INV_Misc_Rune_01"
local TELEPORT_ICON = "Interface\\Icons\\Spell_Arcane_Blink" -- when the game cannot say the spell's own

-- The game's own quest marks for the two steps every quest has: ! to take it, ? to hand it in.
local KIND_ICON = {
	[Guide.ACCEPT] = "Interface\\GossipFrame\\AvailableQuestIcon",
	[Guide.TURNIN] = "Interface\\GossipFrame\\ActiveQuestIcon",
}

-- The card: a fill a shade lighter at the top than at the bottom over a darker footer, the experience bar's line over
-- the footer, and a rim brightest along the top, as if lit from above. Three looks (Options): dark; clear, the
-- world showing through a little; and classic, warm with a gold edge. gilt: the gold line along the top; well: the
-- compass's, in the card and loose.
local THEMES = {
	dark = {
		top = UI.hex("1c1f25", 0.95), bottom = UI.hex("15171b", 0.95), foot = UI.hex("101215", 0.96),
		rimTop = { 1, 1, 1, 0.13 }, rimBottom = { 1, 1, 1, 0.06 }, rule = { 1, 1, 1, 0.07 },
		gilt = 0.55, shadow = 0.5, well = 0.34, looseWell = 0.62,
	},
	clear = {
		top = UI.hex("1c1f25", 0.72), bottom = UI.hex("15171b", 0.66), foot = UI.hex("101215", 0.76),
		rimTop = { 1, 1, 1, 0.18 }, rimBottom = { 1, 1, 1, 0.08 }, rule = { 1, 1, 1, 0.09 },
		gilt = 0.4, shadow = 0.22, well = 0.34, looseWell = 0.52,
	},
	classic = {
		top = UI.hex("2a2116", 0.96), bottom = UI.hex("1b150d", 0.96), foot = UI.hex("140f09", 0.97),
		rimTop = { 0.86, 0.69, 0.36, 0.6 }, rimBottom = { 0.86, 0.69, 0.36, 0.3 }, rule = { 0.86, 0.69, 0.36, 0.18 },
		gilt = 0.85, shadow = 0.5, well = 0.36, looseWell = 0.62,
	},
}
local function look()
	return THEMES[ns.db and ns.db.guideTheme] or THEMES.dark
end

-- How the card's words give way in a short window, in turn: the most lines for the title, the line under it and each
-- line of the checklist; and whether checklist lines past the room fold into a "+2 more".
local FITS = {
	{ 3, 3, 3, false },
	{ 3, 2, 2, false },
	{ 2, 2, 2, false },
	{ 2, 1, 1, false },
	{ 2, 1, 1, true },
	{ 1, 1, 1, true },
	{ 1, 0, 1, true },
}
-- The Skyborne's note has no objectives: its text gives way a line at a time.
local NOTE_FITS = { { 2, 8, 1 }, { 2, 6, 1 }, { 2, 5, 1 }, { 2, 4, 1 }, { 2, 3, 1 }, { 1, 3, 1 }, { 1, 2, 1 }, { 1, 1, 1 } }

local frame
local render

local function clamp(v, lo, hi)
	return math.max(lo, math.min(hi, v))
end

local function mix(a, b, t)
	return { a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t, (a[4] or 1) + ((b[4] or 1) - (a[4] or 1)) * t }
end

--- An angle in -pi..pi: the short way round.
local function wrap(a)
	return (a + math.pi) % TAU - math.pi
end

local function arrowColor(angle)
	-- Green ahead, gold to the side, red behind.
	local a = math.abs(angle)
	a = a > math.pi and 2 * math.pi - a or a
	local t = a / math.pi
	local g, gold, red = ns.RGB.green, UI.colors.gilt, ns.RGB.red
	if t < 0.5 then
		local u = t / 0.5
		return g[1] + (gold[1] - g[1]) * u, g[2] + (gold[2] - g[2]) * u, g[3] + (gold[3] - g[3]) * u
	end
	local u = (t - 0.5) / 0.5
	return gold[1] + (red[1] - gold[1]) * u, gold[2] + (red[2] - gold[2]) * u, gold[3] + (red[3] - gold[3]) * u
end

-- Drawing --------------------------------------------------------------------------------------------------------

local QUARTER = {
	TOPLEFT = { 0, 0.5, 0, 0.5 },
	TOPRIGHT = { 0.5, 1, 0, 0.5 },
	BOTTOMLEFT = { 0, 0.5, 0.5, 1 },
	BOTTOMRIGHT = { 0.5, 1, 0.5, 1 },
}

--- A texture that is not snapped to whole pixels, so curves and a turning arrow stay smooth.
local function piece(owner, layer, sublevel, texture, coords)
	local t = owner:CreateTexture(nil, layer, nil, sublevel)
	t:SetTexture(texture or UI.WHITE)
	if coords then
		t:SetTexCoord(coords[1], coords[2], coords[3], coords[4])
	end
	if t.SetSnapToPixelGrid then
		t:SetSnapToPixelGrid(false)
		t:SetTexelSnappingBias(0)
	end
	return t
end

--- Colours a texture from its top to its bottom (the game starts a vertical gradient at the bottom).
local function shade(tex, top, bottom)
	if CreateColor then
		tex:SetGradient("VERTICAL", CreateColor(bottom[1], bottom[2], bottom[3], bottom[4]), CreateColor(top[1], top[2], top[3], top[4]))
	else
		local c = mix(top, bottom, 0.5)
		tex:SetVertexColor(c[1], c[2], c[3], c[4])
	end
end

--- A soft shadow around the card, a little low: the edges of Media/Shadow.tga, as under the main window but closer in.
local function shadow(f)
	local OUT, CORNER, DROP = 12, 18, 3
	local a, b = 24 / 64, 40 / 64
	f.shadowParts = {}
	local function part(l, r, t, bt)
		local tex = piece(f, "BACKGROUND", -8, UI.MEDIA .. "Shadow.tga", { l, r, t, bt })
		tex:SetVertexColor(0, 0, 0, look().shadow)
		f.shadowParts[#f.shadowParts + 1] = tex
		return tex
	end
	local tl, tr, bl, br = part(0, a, 0, a), part(b, 1, 0, a), part(0, a, b, 1), part(b, 1, b, 1)
	for _, t in ipairs({ tl, tr, bl, br }) do
		t:SetSize(CORNER, CORNER)
	end
	tl:SetPoint("TOPLEFT", f, "TOPLEFT", -OUT, OUT - DROP)
	tr:SetPoint("TOPRIGHT", f, "TOPRIGHT", OUT, OUT - DROP)
	bl:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", -OUT, -OUT - DROP)
	br:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", OUT, -OUT - DROP)
	local top, bottom, left, right = part(a, b, 0, a), part(a, b, b, 1), part(0, a, a, b), part(b, 1, a, b)
	top:SetPoint("TOPLEFT", tl, "TOPRIGHT")
	top:SetPoint("BOTTOMRIGHT", tr, "BOTTOMLEFT")
	bottom:SetPoint("TOPLEFT", bl, "TOPRIGHT")
	bottom:SetPoint("BOTTOMRIGHT", br, "BOTTOMLEFT")
	left:SetPoint("TOPLEFT", tl, "BOTTOMLEFT")
	left:SetPoint("BOTTOMRIGHT", bl, "TOPRIGHT")
	right:SetPoint("TOPLEFT", tr, "BOTTOMLEFT")
	right:SetPoint("BOTTOMRIGHT", br, "TOPRIGHT")
end

--- The card: a rounded fill of corner discs and bands, so the part above the footer takes the top to bottom gradient and
--- the footer its own colour, under a hairline rim. Paint(h, foot) colours it for a height, with the footer from foot
--- down (nil for none).
local function card(f)
	local r = RADIUS - 1
	local fill, rim = {}, {}
	for point, q in pairs(QUARTER) do
		fill[point] = piece(f, "BACKGROUND", -6, UI.MEDIA .. "Disc32.tga", q)
		fill[point]:SetSize(r, r)
		fill[point]:SetPoint(point, point:find("LEFT") and 1 or -1, point:find("TOP") and -1 or 1)
		rim[point] = piece(f, "BACKGROUND", -5, UI.MEDIA .. "Ring" .. RADIUS .. ".tga", q)
		rim[point]:SetSize(RADIUS, RADIUS)
		rim[point]:SetPoint(point)
	end
	fill.top = piece(f, "BACKGROUND", -6)
	fill.top:SetPoint("TOPLEFT", 1 + r, -1)
	fill.top:SetPoint("BOTTOMRIGHT", f, "TOPRIGHT", -1 - r, -1 - r)
	fill.bottom = piece(f, "BACKGROUND", -6)
	fill.bottom:SetPoint("TOPLEFT", f, "BOTTOMLEFT", 1 + r, 1 + r)
	fill.bottom:SetPoint("BOTTOMRIGHT", -1 - r, 1)
	-- The straight middle in two bands: above the footer, and the footer.
	local bands = { piece(f, "BACKGROUND", -6), piece(f, "BACKGROUND", -6) }
	rim.top = piece(f, "BACKGROUND", -5)
	rim.top:SetPoint("TOPLEFT", RADIUS, 0)
	rim.top:SetPoint("TOPRIGHT", -RADIUS, 0)
	rim.top:SetHeight(1)
	rim.bottom = piece(f, "BACKGROUND", -5)
	rim.bottom:SetPoint("BOTTOMLEFT", RADIUS, 0)
	rim.bottom:SetPoint("BOTTOMRIGHT", -RADIUS, 0)
	rim.bottom:SetHeight(1)
	rim.left = piece(f, "BACKGROUND", -5)
	rim.left:SetPoint("TOPLEFT", 0, -RADIUS)
	rim.left:SetPoint("BOTTOMLEFT", 0, RADIUS)
	rim.left:SetWidth(1)
	rim.right = piece(f, "BACKGROUND", -5)
	rim.right:SetPoint("TOPRIGHT", 0, -RADIUS)
	rim.right:SetPoint("BOTTOMRIGHT", 0, RADIUS)
	rim.right:SetWidth(1)
	-- A gold hairline along the top edge, fading out at both ends, as on the main window.
	local gold
	if CreateColor then
		local left, right = piece(f, "BACKGROUND", -4), piece(f, "BACKGROUND", -4)
		left:SetPoint("TOPLEFT", RADIUS + 8, 0)
		left:SetPoint("BOTTOMRIGHT", f, "TOP", 0, -1)
		right:SetPoint("TOPLEFT", f, "TOP", 0, 0)
		right:SetPoint("BOTTOMRIGHT", f, "TOPRIGHT", -RADIUS - 8, -1)
		gold = { left, right }
	end

	local c = {}
	function c.Paint(_, h, foot)
		local L = look()
		if gold and c.gilt ~= L.gilt then
			c.gilt = L.gilt
			local g = UI.colors.gilt
			gold[1]:SetGradient("HORIZONTAL", CreateColor(g[1], g[2], g[3], 0), CreateColor(g[1], g[2], g[3], L.gilt))
			gold[2]:SetGradient("HORIZONTAL", CreateColor(g[1], g[2], g[3], L.gilt), CreateColor(g[1], g[2], g[3], 0))
		end
		local function at(y)
			return mix(L.top, L.bottom, y / h)
		end
		local edge = h - 1 - r
		foot = foot and foot <= edge and math.max(foot, 1 + r) or nil
		for _, p in ipairs({ fill.TOPLEFT, fill.TOPRIGHT, fill.top }) do
			shade(p, at(1), at(1 + r))
		end
		for _, p in ipairs({ fill.BOTTOMLEFT, fill.BOTTOMRIGHT, fill.bottom }) do
			if foot then
				shade(p, L.foot, L.foot)
			else
				shade(p, at(edge), at(h - 1))
			end
		end
		local stops = { 1 + r, foot or edge, edge }
		for k, band in ipairs(bands) do
			local y0, y1 = stops[k], stops[k + 1]
			band:ClearAllPoints()
			if y1 - y0 < 0.5 then
				band:Hide()
			else
				band:SetPoint("TOPLEFT", f, "TOPLEFT", 1, -y0)
				band:SetPoint("BOTTOMRIGHT", f, "TOPRIGHT", -1, -y1)
				if k == 1 then
					shade(band, at(y0), at(y1))
				else
					shade(band, L.foot, L.foot)
				end
				band:Show()
			end
		end
		local function lit(y)
			return mix(L.rimTop, L.rimBottom, y / h)
		end
		shade(rim.TOPLEFT, lit(0), lit(RADIUS))
		shade(rim.TOPRIGHT, lit(0), lit(RADIUS))
		shade(rim.top, lit(0), lit(1))
		shade(rim.left, lit(RADIUS), lit(h - RADIUS))
		shade(rim.right, lit(RADIUS), lit(h - RADIUS))
		shade(rim.BOTTOMLEFT, lit(h - RADIUS), lit(h))
		shade(rim.BOTTOMRIGHT, lit(h - RADIUS), lit(h))
		shade(rim.bottom, lit(h - 1), lit(h))
	end
	return c
end

--- A compass: a dark round well with a thin ring and a soft light in the arrow's colour; inside it the arrow, a check
--- once you are there, the Hearthstone for a hearth step (the spell for a teleport), or a globe when there is nowhere to
--- point from; under it the distance and the time to walk it, or a short note. Returns its parts: { dial, arrow, here,
--- dist, eta, far }. The window has one in its card, and one loose, for when you drag the arrow out of it.
local function compass(owner)
	local d = CreateFrame("Frame", nil, owner)
	d.well = piece(d, "BACKGROUND", 0, UI.MEDIA .. "Disc64.tga")
	d.well:SetAllPoints()
	d.well:SetVertexColor(0, 0, 0, look().well)
	d.glow = piece(d, "BORDER", 0, UI.MEDIA .. "Glow.tga")
	d.glow:SetAllPoints()
	d.ring = piece(d, "ARTWORK", 0, UI.MEDIA .. "Dial.tga")
	d.ring:SetAllPoints()
	d.icon = d:CreateTexture(nil, "ARTWORK", nil, 1)
	d.icon:SetPoint("CENTER")
	d.icon:SetTexCoord(0.07, 0.93, 0.07, 0.93)
	if d.CreateMaskTexture and d.icon.AddMaskTexture then
		local mask = d:CreateMaskTexture(nil, "ARTWORK")
		mask:SetTexture(UI.MEDIA .. "DiscMask.tga", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
		mask:SetAllPoints(d.icon)
		d.icon:AddMaskTexture(mask)
	end
	d.icon:SetTexture(HEARTHSTONE_ICON)
	d.icon.texture = HEARTHSTONE_ICON
	d.icon:Hide()
	d.globe = piece(d, "ARTWORK", 1, UI.MEDIA .. "Globe.tga")
	d.globe:SetPoint("CENTER")
	d.globe:SetVertexColor(ns.RGB.mist[1], ns.RGB.mist[2], ns.RGB.mist[3], 0.75)
	d.globe:Hide()
	local c = { dial = d }
	c.arrow = piece(d, "OVERLAY", 0, UI.MEDIA .. "Arrow.tga")
	c.arrow:SetPoint("CENTER")
	c.here = UI.Mark(d, "Check", 28, ns.RGB.green, "OVERLAY")
	c.here:SetPoint("CENTER")
	c.here:Hide()
	c.dist = UI.Text(owner, 15, ns.RGB.white, { weight = "bold", justify = "CENTER" })
	c.eta = UI.Text(owner, 10.5, ns.RGB.fog, { justify = "CENTER" })
	c.far = UI.Text(owner, 10.5, ns.RGB.mist, { justify = "CENTER", wrap = true, spacing = 1 })
	c.far:Hide()
	c.checkSize = 28
	return c
end

--- The compass the window draws: the one in its card, or the loose one. Its state carries over; the arrow points anew.
local function useCompass(f, c)
	f.dial, f.arrow, f.here, f.dist, f.eta, f.far = c.dial, c.arrow, c.here, c.dist, c.eta, c.far
	f.checkSize = c.checkSize
	f.mode, f.fresh = nil, true
	for k in pairs(f.drawn or {}) do
		f.drawn[k] = nil
	end
end

--- The step's kind: a word in its colour, after the game's own quest mark where it has one, and a short note after it
--- (the level its quests take you to). Set(text, color, icon, extra); Fit(room) lets the note go, then cuts the word
--- short, to fit.
local function kindLabel(parent)
	local k = CreateFrame("Frame", nil, parent)
	k:SetHeight(16)
	k.icon = k:CreateTexture(nil, "ARTWORK")
	k.icon:SetSize(14, 14)
	k.icon:SetPoint("LEFT", -3, 0)
	k.icon:Hide()
	k.text = UI.Text(k, 11, ns.RGB.gold, { weight = "bold" })
	function k:Set(text, color, icon, extra)
		self.word, self.extra = text, extra
		self.text:SetText(extra and (text .. "  " .. ns.Hex(ns.HEX.fog, "·") .. "  " .. extra) or text)
		self.text:SetTextColor(color[1], color[2], color[3], 1)
		if icon then
			self.icon:SetTexture(icon)
		end
		self.icon:SetShown(icon ~= nil)
		self.room = icon and 12 or 0
		self.text:ClearAllPoints()
		self.text:SetPoint("LEFT", self.room, 0)
		self:Fit()
	end
	function k:Fit(room)
		if self.extra then
			self.text:SetText(self.word .. "  " .. ns.Hex(ns.HEX.fog, "·") .. "  " .. self.extra)
		end
		local tw = math.ceil(UI.TextWidth(self.text))
		if room and self.extra and tw > room - self.room then
			self.text:SetText(self.word)
			tw = math.ceil(UI.TextWidth(self.text))
		end
		if room then
			tw = math.max(10, math.min(tw, room - self.room))
		end
		self.text:SetWidth(tw)
		self:SetWidth(tw + self.room)
	end
	return k
end

--- A small round button: its mark is quiet, a shade brighter while the cursor is over the window (f.glance), white on a
--- soft disc under the cursor, and gold while what it opens is open (b.active). tip: its words, or a function for them.
local function roundButton(f, mark, rotation, tip, onClick)
	local b = CreateFrame("Button", nil, f)
	b:SetSize(BUTTON, BUTTON)
	b.bg = UI.Shape(b, BUTTON / 2, { 1, 1, 1, 0.09 })
	b.bg:Hide()
	if mark == "List" then
		-- Three short bars, drawn here: no texture to add, so a reload shows it without restarting the game.
		b.mark = CreateFrame("Frame", nil, b)
		b.mark:SetSize(10, 9)
		b.mark.bars = {}
		for k = 1, 3 do
			local bar = piece(b.mark, "ARTWORK", 0)
			bar:SetSize(10, 1.6)
			bar:SetPoint("TOP", 0, -0.4 - (k - 1) * 3.6)
			b.mark.bars[k] = bar
		end
		function b.mark:SetVertexColor(r, g, bl, a)
			for _, bar in ipairs(self.bars) do
				bar:SetVertexColor(r, g, bl, a)
			end
		end
	else
		b.mark = UI.Mark(b, mark, mark == "Close" and 11 or 12, ns.RGB.fog)
	end
	b.mark:SetPoint("CENTER", 0, 0)
	if rotation then
		b.mark:SetRotation(rotation)
	end
	if b.SetMotionScriptsWhileDisabled then
		b:SetMotionScriptsWhileDisabled(true)
	end
	function b:Tint()
		local c = self.active and (self.hot and UI.colors.giltBright or UI.colors.gilt)
			or self.hot and self:IsEnabled() and ns.RGB.white
			or mix(ns.RGB.fog, ns.RGB.mist, f.glance or 0)
		self.mark:SetVertexColor(c[1], c[2], c[3], 1)
	end
	b:SetScript("OnEnter", function(self)
		self.hot = true
		self.bg:SetShown(self:IsEnabled())
		self:Tint()
		GameTooltip:SetOwner(self, "ANCHOR_TOP")
		GameTooltip:SetText(type(tip) == "function" and tip() or tip, 1, 1, 1, 1, true)
		GameTooltip:Show()
	end)
	b:SetScript("OnLeave", function(self)
		self.hot = false
		self.bg:Hide()
		self:Tint()
		GameTooltip:Hide()
	end)
	b:SetScript("OnClick", onClick)
	b:SetScript("OnEnable", function(self)
		self:SetAlpha(1)
	end)
	b:SetScript("OnDisable", function(self)
		self.bg:Hide()
		self:SetAlpha(0.3)
	end)
	return b
end

--- A line of the card's checklist: a tick once it is done (and its words dimmed), else the game's quest mark for taking
--- or handing in a quest, else an open ring; the words, and at the right a count or the experience a quest gives.
local function itemLine(f, i)
	local line = f.lines[i]
	if not line then
		line = CreateFrame("Frame", nil, f)
		line.check = UI.Mark(line, "Check", 13, ns.RGB.green)
		line.check:SetPoint("TOPLEFT", 0, -2)
		line.icon = line:CreateTexture(nil, "ARTWORK")
		line.icon:SetSize(15, 15)
		line.icon:SetPoint("TOPLEFT", -1.5, -1)
		line.dot = piece(line, "ARTWORK", 0, UI.MEDIA .. "Ring4.tga")
		line.dot:SetSize(8, 8)
		line.dot:SetPoint("TOPLEFT", 2.5, -4.5)
		line.count = UI.Text(line, 11.5, ns.RGB.white, { weight = "medium", justify = "RIGHT" })
		line.count:SetPoint("TOPRIGHT", 0, -0.5)
		line.text = UI.Text(line, 12, ns.RGB.text, { wrap = true, spacing = 2 })
		line.text:SetPoint("TOPLEFT", 18, 0)
		f.lines[i] = line
	end
	return line
end

--- Fills a checklist line from an item: { words, count or experience, done, quest mark, experience? }. A quest handed
--- in keeps no experience to show.
local function setLine(line, item)
	local done, mark = item[3] and true or false, item[4]
	line.text:SetText(item[1])
	local c = done and ns.RGB.fog or ns.RGB.text
	line.text:SetTextColor(c[1], c[2], c[3], 1)
	line.count:SetText(done and item[5] and "" or item[2] or "")
	c = done and ns.RGB.green or item[5] and ns.RGB.xp or ns.RGB.white
	line.count:SetTextColor(c[1], c[2], c[3], done and 0.8 or 1)
	line.check:SetShown(done)
	line.icon:SetShown(not done and mark ~= nil)
	if mark then
		line.icon:SetTexture(mark)
	end
	line.dot:SetShown(not done and mark == nil)
	line.dot:SetVertexColor(ns.RGB.mist[1], ns.RGB.mist[2], ns.RGB.mist[3], 0.8)
end

--- The line under the card, and your level's experience along it: how far into the level you are, and after it, lighter,
--- what the card's quests still to hand in will add (to the end of the bar when they level you up). At the level cap,
--- or while the game does not say, a plain hairline.
local function experienceBar(f)
	local b = CreateFrame("Frame", nil, f)
	b:SetHeight(XP_H)
	b.track = piece(b, "BORDER", 0)
	b.track:SetAllPoints()
	b.fill = piece(b, "BORDER", 1)
	b.fill:SetPoint("TOPLEFT")
	b.fill:SetPoint("BOTTOMLEFT")
	b.fill:SetVertexColor(ns.RGB.xp[1], ns.RGB.xp[2], ns.RGB.xp[3], 0.85)
	b.more = piece(b, "BORDER", 1)
	b.more:SetPoint("TOPLEFT", b.fill, "TOPRIGHT")
	b.more:SetPoint("BOTTOMLEFT", b.fill, "BOTTOMRIGHT")
	b.more:SetVertexColor(ns.RGB.xp[1], ns.RGB.xp[2], ns.RGB.xp[3], 0.45)
	return b
end

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

--- Your experience into this level and the level's whole, or nil (at the level cap, or while the game does not say).
local function levelXp()
	local xp, max = UnitXP and UnitXP("player"), UnitXPMax and UnitXPMax("player")
	local level, cap = ns.player and ns.player.level or 1, GetMaxPlayerLevel and GetMaxPlayerLevel() or 60
	if plain(xp) and plain(max) and type(xp) == "number" and type(max) == "number" and max > 0 and level < cap then
		return xp, max
	end
end

--- Draws your experience on the bar: whenever the window is laid out, and on PLAYER_XP_UPDATE.
local function experience(f)
	local b = f.xpbar
	local xp, max = levelXp()
	local on = xp ~= nil
	b.on = on
	b:SetHeight(on and XP_H or 1)
	local rule = look().rule
	b.track:SetVertexColor(rule[1], rule[2], rule[3], rule[4] * (on and 1.6 or 1))
	local w = b:GetWidth() or 0
	if not on or w <= 0 then
		b.fill:Hide()
		b.more:Hide()
		return
	end
	local have = clamp(xp / max, 0, 1)
	local add = clamp((f.pendingXp or 0) / max, 0, 1 - have)
	b.fill:SetShown(have > 0)
	b.fill:SetWidth(math.max(0.5, w * have))
	b.more:SetShown(add > 0)
	b.more:SetWidth(math.max(0.5, w * add))
	if have <= 0 then
		-- Nothing done yet this level: what the quests add starts at the left.
		b.more:ClearAllPoints()
		b.more:SetPoint("TOPLEFT")
		b.more:SetPoint("BOTTOMLEFT")
	else
		b.more:ClearAllPoints()
		b.more:SetPoint("TOPLEFT", b.fill, "TOPRIGHT")
		b.more:SetPoint("BOTTOMLEFT", b.fill, "BOTTOMRIGHT")
	end
end

-- Where the window sits ---------------------------------------------------------------------------------------------

--- Saves where the window sits: its top left corner from the screen's bottom left, in the window's own units (so its
--- scale is kept apart), with the size you gave it if you did; and anchors it there, so moving, sizing, scaling and
--- fitting a card all keep that corner where it is.
local function remember(f)
	local left, top = f:GetLeft(), f:GetTop()
	if not (left and top) then
		return
	end
	left, top = math.floor(left + 0.5), math.floor(top + 0.5)
	f:ClearAllPoints()
	f:SetPoint("TOPLEFT", UIParent, "BOTTOMLEFT", left, top)
	local old = ns.db.guidePos or {}
	ns.db.guidePos = { "TOPLEFT", left, top, relPoint = "BOTTOMLEFT", w = old.w, h = old.h }
end

--- Where the window opens until you move it: on the right, left of the minimap and of the quest tracker under it (read
--- from the game, wherever your layout puts them on that side), its top clear of the buffs. So it covers neither, and
--- keeps away from the left, where the game opens quest and gossip windows, and from the middle of the screen.
local function home(f)
	f:ClearAllPoints()
	local right, top = UIParent:GetRight(), UIParent:GetTop()
	if not (right and top) then
		f:SetPoint("TOPRIGHT", UIParent, "TOPRIGHT", -380, -120)
		return
	end
	local ui = UIParent:GetEffectiveScale()
	local edge = right - 250 -- about the minimap's left edge, should the game not say
	for _, name in ipairs({ "MinimapCluster", "ObjectiveTrackerFrame", "QuestWatchFrame", "WatchFrame" }) do
		local other = _G[name]
		local left = type(other) == "table" and other.GetLeft and other:GetLeft()
		if left then
			left = left * other:GetEffectiveScale() / ui
			if left > right / 2 then
				edge = math.min(edge, left)
			end
		end
	end
	local s = f:GetEffectiveScale() / ui
	f:SetPoint("TOPRIGHT", UIParent, "BOTTOMLEFT", (edge - 16) / s, (top - 120) / s)
end

--- Scales the window, its top left corner staying where it is on screen.
local function rescale(f, s)
	s = math.floor(clamp(s, MIN_SCALE, MAX_SCALE) * 20 + 0.5) / 20
	local old = f:GetScale()
	if math.abs(s - old) < 0.001 then
		return
	end
	local left, top = f:GetLeft(), f:GetTop()
	f:SetScale(s)
	ns.db.guideScale = s
	if left and top then
		f:ClearAllPoints()
		f:SetPoint("TOPLEFT", UIParent, "BOTTOMLEFT", left * old / s, top * old / s)
	end
	remember(f)
end

local function ctrl()
	return IsControlKeyDown and IsControlKeyDown() and true or false
end

--- The controls brighten while the cursor is over the window, and the sizing corner shows (unless the window is locked).
local function glance(f, elapsed)
	local want = (f.sizing or f:IsMouseOver()) and 1 or 0
	local locked = ns.db.guideLock and true or false
	local g = f.glance or 0
	if g == want and f.locked == locked then
		return
	end
	g = elapsed and g + (want - g) * (1 - math.exp(-elapsed / 0.08)) or want
	if math.abs(want - g) < 0.02 then
		g = want
	end
	f.glance, f.locked = g, locked
	f.grip:SetShown(not locked)
	f.grip.mark:SetAlpha(0.3 + 0.7 * g)
	for _, b in ipairs(f.buttons) do
		b:Tint()
	end
end

-- The compass, every frame ------------------------------------------------------------------------------------------

--- Whether the walking time shows under the distance: unless the option is off, or a short window has no room for it
--- under the card's compass.
local function timeShown(f)
	return ns.db.guideTime ~= false and not (f.cramped and not f.loose)
end

--- What the compass holds: "arrow", "here" (a check), "hearth" (the Hearthstone) or "far" (a globe), and the words under
--- it to match.
local function show(f, mode)
	if f.mode == mode then
		return
	end
	-- An arrow coming back after a check or an icon points at once: there is no turn to show.
	f.snap = mode == "arrow" or f.snap
	f.mode = mode
	f.arrow:SetShown(mode == "arrow")
	f.here:SetShown(mode == "here")
	f.dial.icon:SetShown(mode == "hearth")
	f.dial.globe:SetShown(mode == "far")
	f.dist:SetShown(mode == "arrow" or mode == "here")
	f.eta:SetShown((mode == "arrow" or mode == "here") and timeShown(f))
	f.far:SetShown(mode == "hearth" or mode == "far")
	if mode == "here" then
		f.pop = 0
	end
end

--- Eases the compass toward what it should show: the arrow's angle the short way round, and the colours with it, an
--- exponential approach that settles within about a tenth of a second. goal: the angle (nil keeps it); r, g, b: the
--- colour (nil: from the angle as it turns, so it passes through gold). Nothing is redrawn once it has settled.
local function steer(f, goal, r, g, b, elapsed)
	local k = f.fresh and 1 or elapsed and 1 - math.exp(-elapsed / EASE) or 0
	if goal then
		if f.snap or f.fresh then
			f.angle = goal
		else
			local a = wrap(f.angle + wrap(goal - f.angle) * k)
			f.angle = math.abs(wrap(goal - a)) < 0.002 and goal or a
		end
	end
	f.fresh, f.snap = false, false
	if not r then
		r, g, b = arrowColor(f.angle)
	end
	local c = f.rgb
	c[1] = c[1] + (r - c[1]) * k
	c[2] = c[2] + (g - c[2]) * k
	c[3] = c[3] + (b - c[3]) * k
	if math.abs(r - c[1]) + math.abs(g - c[2]) + math.abs(b - c[3]) < 0.004 then
		c[1], c[2], c[3] = r, g, b
	end
	local drawn = f.drawn
	if drawn[1] == f.angle and drawn[2] == c[1] and drawn[3] == c[2] and drawn[4] == c[3] and drawn[5] == f.mode then
		return
	end
	drawn[1], drawn[2], drawn[3], drawn[4], drawn[5] = f.angle, c[1], c[2], c[3], f.mode
	f.arrow:SetRotation(f.angle)
	f.arrow:SetVertexColor(c[1], c[2], c[3], 1)
	f.dial.ring:SetVertexColor(c[1], c[2], c[3], 0.42)
	f.dial.glow:SetVertexColor(c[1], c[2], c[3], f.mode == "here" and 0.16 or 0.1)
end

--- The check grows in when you arrive, a little past its size and back.
local function pop(f, elapsed)
	if f.pop >= 1 then
		return
	end
	f.pop = math.min(1, f.pop + (elapsed or 0) / POP)
	local t = f.pop - 1
	local s = 1 + 2.70158 * t * t * t + 1.70158 * t * t
	local size = f.checkSize * (0.5 + 0.5 * s)
	f.here:SetSize(size, size)
	f.here:SetAlpha(math.min(1, f.pop * 2))
end

--- Points the compass, every frame: the arrow eased toward the place, a check once you are there, the Hearthstone for a
--- hearth step, a globe when there is nowhere to point from. text: also the words under it (4 times a second). While
--- you look at another step, the compass points at it, and the map pin stays on the step to do now.
local function point(f, text, elapsed)
	local step = f.step
	if not step then
		return
	end
	if text then
		-- A "do" step's target is the nearest camp of what is left, so it moves as you do.
		local g = f.going
		f.target = g and { g.area, g.x, g.y, g.title } or { Guide.Target(step) }
		if not f.view then
			Guide.Pin(f.target[1], f.target[2], f.target[3])
		end
	end
	local t = f.target
	local blue, mist = ns.RGB.blue, ns.RGB.mist
	if step[1] == Guide.HEARTH or step[1] == Guide.TELEPORT then
		-- Nowhere to walk: the Hearthstone, or the class's teleport, does the travelling.
		local icon = HEARTHSTONE_ICON
		if step[1] == Guide.TELEPORT then
			icon = GetSpellTexture and GetSpellTexture(step[2]) or TELEPORT_ICON
		end
		if f.dial.icon.texture ~= icon then
			f.dial.icon:SetTexture(icon)
			f.dial.icon.texture = icon
		end
		show(f, "hearth")
		steer(f, nil, blue[1], blue[2], blue[3], elapsed)
		if text then
			-- In the card its kind says it already; the loose arrow says it under the stone.
			f.far:SetText(not f.loose and "" or step[1] == Guide.TELEPORT and "Teleport" or "Hearth")
			f.dist:SetText("")
			f.eta:SetText("")
		end
		return
	end
	local yards, angle = Guide.Toward(t[1], t[2], t[3])
	if not yards then
		show(f, "far")
		steer(f, nil, mist[1], mist[2], mist[3], elapsed)
		if text then
			f.far:SetText(angle == "continent" and "On another continent" or "No position here")
			f.dist:SetText("")
			f.eta:SetText("")
		end
		return
	end
	local arrival = f.going and 15 or (step[1] == Guide.DO or step[1] == Guide.GRIND) and 30 or 8
	if yards <= arrival then
		show(f, "here")
		local green = ns.RGB.green
		steer(f, nil, green[1], green[2], green[3], elapsed)
		pop(f, elapsed)
		if text then
			-- Who or what is here: the card says it beside the compass, the loose arrow under it.
			f.dist:SetText("Here")
			f.eta:SetText(f.loose and t[4] or "")
			-- There: a few seconds on the check, then back to the route.
			if f.going then
				local now = GetTime and GetTime() or 0
				f.arrived = f.arrived or now
				if now - f.arrived > 4 then
					f.arrived = nil
					Guide.GoTo(nil)
				end
			end
		end
		return
	end
	f.arrived = nil
	show(f, "arrow")
	if angle then
		steer(f, angle, nil, nil, nil, elapsed)
	else
		-- The game does not say which way you face: a grey arrow, unturned.
		steer(f, 0, mist[1], mist[2], mist[3], elapsed)
	end
	if text then
		f.dist:SetText(Guide.DistanceText(yards))
		f.eta:SetText(Guide.TimeText(yards))
	end
end

-- Laying it out ----------------------------------------------------------------------------------------------------

--- Places the title, the line under it and the checklist from y down in a column, as one of FITS allows; returns the
--- bottom, whether it all fits above limit, and how many checklist lines show. The experience a quest to hand in gives
--- sits at the right of the line under the title (of the title, when that line is away), in the checklist's column.
--- gap: the space between checklist lines (less in a short window).
local function arrange(f, x, tw, y, limit, fit, gap)
	local title, sub, value = f.title, f.sub, f.value
	local vw = (value:GetText() or "") ~= "" and math.ceil(UI.TextWidth(value)) + 10 or 0
	local under = fit[2] > 0 and (sub:GetText() or "") ~= ""
	local onTitle = vw > 0 and not under
	value:SetShown(vw > 0)
	value:ClearAllPoints()
	title:SetMaxLines(fit[1])
	title:SetWidth(tw - (onTitle and vw or 0))
	title:ClearAllPoints()
	title:SetPoint("TOPLEFT", f, "TOPLEFT", x, -y)
	if onTitle then
		value:SetPoint("TOPRIGHT", f, "TOPLEFT", x + tw, -(y + 2))
	end
	y = y + math.ceil(title:GetStringHeight())
	sub:ClearAllPoints()
	if under then
		sub:SetMaxLines(fit[2])
		sub:SetWidth(tw - (vw > 0 and vw or 0))
		sub:SetPoint("TOPLEFT", f, "TOPLEFT", x, -(y + 2))
		sub:Show()
		if vw > 0 then
			value:SetPoint("TOPRIGHT", f, "TOPLEFT", x + tw, -(y + 2))
		end
		y = y + 2 + math.ceil(sub:GetStringHeight())
	else
		sub:Hide()
	end
	-- The checklist: each line's height first; folding, what is left to do goes first, and as many as fit.
	local items, heights, order = f.items, {}, {}
	for k = 1, #items do
		local line = f.lines[k]
		local count = line.count:GetText() or ""
		local room = tw - 18 - (count ~= "" and math.ceil(UI.TextWidth(line.count)) + 10 or 0)
		line.text:SetMaxLines(fit[3])
		line.text:SetWidth(math.max(20, room))
		heights[k] = math.max(16, math.ceil(line.text:GetStringHeight()))
		order[k] = k
	end
	local shown, more = #items, 15
	if #items > 0 then
		y = y + gap + 2
		if fit[4] then
			table.sort(order, function(a, b)
				if items[a][3] ~= items[b][3] then
					return not items[a][3]
				end
				return a < b
			end)
			local used = 0
			for n, k in ipairs(order) do
				used = used + heights[k] + (n > 1 and gap or 0)
				if y + used + (n < #items and gap + more or 0) > limit then
					shown = n - 1
					break
				end
			end
		end
	end
	for k = 1, #items do
		f.lines[k]:Hide()
	end
	for n = 1, shown do
		local k = order[n]
		local line = f.lines[k]
		line:ClearAllPoints()
		line:SetPoint("TOPLEFT", f, "TOPLEFT", x, -y)
		line:SetSize(tw, heights[k])
		line:Show()
		y = y + heights[k] + (n < shown and gap or 0)
	end
	f.more:ClearAllPoints()
	if shown < #items then
		-- What is folded away: the lines still to do, or (when only done ones are) how many are done.
		local left = 0
		for n = shown + 1, #items do
			left = left + (items[order[n]][3] and 0 or 1)
		end
		f.more:SetText(left > 0 and ("+" .. left .. " more") or ("+" .. (#items - shown) .. " done"))
		f.more:SetPoint("TOPLEFT", f, "TOPLEFT", x + 18, -(y + (shown > 0 and gap or 0)))
		f.more:Show()
		y = y + (shown > 0 and gap or 0) + more
	else
		f.more:Hide()
	end
	return y, y <= limit and shown == #items, shown
end

--- The distance's size for a compass of a size, and the height of its line.
local function distSize(size)
	local s = clamp(8 + size * 0.13, 12.5, 15)
	return s, math.ceil(s * 1.3)
end

--- Lays the window out for a size. The compass sits at the top left and grows with the room; beside it the kind, level
--- with the buttons at the right, and under the kind the words, which wrap to the width and give way in turn when they
--- do not fit (see FITS). Under the card the experience bar, then the footer when there is something to say and, in a
--- window sized by hand, room for it; or the route's list. Returns the height that holds what it laid out.
local function place(f, w, h)
	local step = f.step
	local pad = w < 280 and 10 or 12
	local listing = f.listing and step ~= nil
	local least = listing and f.fixed and LIST_MIN + 10 or 0 -- the room the list keeps under the card
	local foot = f.footer and (not f.fixed or h >= 60 + FOOT + least) and FOOT or 0
	local floor = h - foot - (foot > 0 and 12 or pad) -- the bottom of the room for the card and the list
	local limit = floor - least -- the bottom of the room for the card's words
	f.card:Paint(h, foot > 0 and h - foot or nil)

	-- The buttons at the top right: the cross, the list, next and back; Current beside them while you look at another
	-- step (or go somewhere else).
	local left = w - 6 - BUTTON
	if f.toggle:IsShown() then
		left = left - BUTTON
	end
	if f.back:IsShown() then
		left = left - 2 * BUTTON
	end
	if f.now:IsShown() then
		left = left - 6 - f.now:GetWidth()
		f.now:ClearAllPoints()
		f.now:SetPoint("RIGHT", f.back:IsShown() and f.back or f.toggle, "LEFT", -6, 0)
	end

	-- The compass, with the distance and the time under it: as big as the room allows, to a point. With the arrow
	-- dragged out of the window, the words take its room.
	local x, tw, column = pad, w - 2 * pad, TOP
	local cc = f.inCard
	local dial = cc.dial
	local inside = step ~= nil and not f.loose
	dial:SetShown(inside)
	if not inside then
		cc.dist:Hide()
		cc.eta:Hide()
		cc.far:Hide()
	end
	if inside then
		-- In a short window the time gives way first, then the compass shrinks.
		local most = math.min(50, math.floor((w - 2 * pad) * 0.17))
		local room = limit - TOP - 4 - select(2, distSize(most))
		f.cramped = room < 30 + 13
		local timeH = ns.db.guideTime ~= false and not f.cramped and 13 or 0
		local size = math.floor(clamp(room - timeH, 26, most))
		local font, distH = distSize(size)
		-- The Hearthstone and a teleport have nothing under them in the card: their kind says it.
		local away = step[1] == Guide.HEARTH or step[1] == Guide.TELEPORT
		column = TOP + size + (away and 0 or 4 + distH + timeH)
		dial:ClearAllPoints()
		dial:SetPoint("TOPLEFT", f, "TOPLEFT", pad + (COL - size) / 2, -TOP)
		dial:SetSize(size, size)
		cc.arrow:SetSize(size * 0.6, size * 0.6)
		cc.checkSize = math.floor(size * 0.48)
		f.checkSize = cc.checkSize
		if f.pop >= 1 then
			cc.here:SetSize(cc.checkSize, cc.checkSize)
		end
		dial.icon:SetSize(size - 10, size - 10)
		dial.globe:SetSize(size * 0.5, size * 0.5)
		UI.SetFont(cc.dist, "bold", font)
		cc.dist:ClearAllPoints()
		cc.dist:SetPoint("TOP", f, "TOPLEFT", pad + COL / 2, -(TOP + size + 4))
		cc.dist:SetSize(COL + 10, distH)
		cc.eta:ClearAllPoints()
		cc.eta:SetPoint("TOP", cc.dist, "BOTTOM", 0, 0)
		cc.eta:SetSize(COL + 10, 13)
		cc.eta:SetShown((f.mode == "arrow" or f.mode == "here") and timeShown(f))
		cc.far:ClearAllPoints()
		cc.far:SetPoint("TOP", f, "TOPLEFT", pad + COL / 2, -(TOP + size + 5))
		cc.far:SetWidth(COL + 6)
		x = pad + COL + GAP
		tw = w - x - pad
	end

	-- The kind, level with the buttons, cut short only if a narrow window leaves it no room beside them.
	f.kind:Fit(left - 8 - x)
	f.kind:ClearAllPoints()
	f.kind:SetPoint("LEFT", f, "TOPLEFT", x, -ROW)

	-- Under it the title, the line under that and the checklist, giving way in turn until they all fit; closer together
	-- in a short window. When none fits whole, the one that fits the room and shows the most checklist lines, the
	-- earliest of those (so the title keeps its second line where cutting it shows nothing more).
	local top = ROW + BUTTON / 2
	local gap = h < 150 and 3 or 5
	local fits = step and FITS or NOTE_FITS
	local pick, best, used, bottom
	for k, fit in ipairs(fits) do
		local whole, shown
		bottom, whole, shown = arrange(f, x, tw, top, limit, fit, gap)
		used = k
		if whole then
			pick = nil
			break
		end
		local score = bottom <= limit and 1000 + shown or -bottom
		if not best or score > best then
			pick, best = k, score
		end
	end
	if pick and pick ~= used then
		bottom = arrange(f, x, tw, top, limit, fits[pick], gap)
	end
	local needed = math.max(bottom, column) + (h - limit)

	-- The route's list under the card: a set height in a window that fits what it shows, all the room left in one sized
	-- by hand. A window sized too short for a line of it shows the card alone.
	local sep = math.max(bottom, column) + 11
	local listTop = sep + XP_H + 4
	listing = listing and (not f.fixed or floor - listTop >= ROW_HEAD)
	f.list:SetShown(listing)
	if listing then
		local listH = f.fixed and floor - listTop or LIST_H
		f.list:ClearAllPoints()
		f.list:SetPoint("TOPLEFT", f, "TOPLEFT", pad - 8, -listTop)
		f.list:SetSize(w - 2 * pad + 12, listH)
		needed = listTop + listH + (h - floor)
	end

	-- Between the card and what is under it, your experience (see experience()); a plain hairline at the level cap.
	local bar = f.xpbar
	bar:ClearAllPoints()
	if listing or foot > 0 then
		local y = listing and sep or h - foot
		bar:SetPoint("TOPLEFT", f, "TOPLEFT", 1, -y)
		bar:SetPoint("TOPRIGHT", f, "TOPRIGHT", -1, -y)
		bar:Show()
	else
		bar:Hide()
	end

	-- The footer: what comes next; or, looking at another step, how far it is from yours and the button that makes it
	-- yours.
	local looking = f.view ~= nil
	f.then_:SetShown(foot > 0 and not looking)
	f.thenButton:SetShown(foot > 0 and not looking)
	f.ahead:SetShown(foot > 0 and looking)
	f.start:SetShown(foot > 0 and looking)
	if foot > 0 then
		local mid = h - foot / 2 + 1
		if looking then
			f.ahead:ClearAllPoints()
			f.ahead:SetPoint("LEFT", f, "TOPLEFT", pad, -mid)
			f.start:ClearAllPoints()
			f.start:SetPoint("LEFT", f.ahead, "RIGHT", 8, 0)
		else
			f.then_:ClearAllPoints()
			f.then_:SetPoint("LEFT", f, "TOPLEFT", pad, -mid)
			f.then_:SetWidth(w - 2 * pad - 10)
			f.thenButton:ClearAllPoints()
			f.thenButton:SetPoint("TOPLEFT", f, "TOPLEFT", 1, -(h - foot + XP_H))
			f.thenButton:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -18, 1)
		end
	end
	return needed
end

--- Lays the window out for the size it has.
local function layout(f)
	local w, h = f:GetWidth(), f:GetHeight()
	if f.items and w and h and w > 0 and h > 0 then
		place(f, w, h)
	end
end

--- For a window you have not sized: its height fits its card, the words in full (up to FIT_H), and its top edge stays
--- where it is. The card is laid out as tall as it may grow, to see where its words end.
local function fit(f)
	local w = f:GetWidth()
	local h = math.floor(clamp(place(f, w, FIT_H), MIN_H, FIT_H) + 0.5)
	if math.abs(h - f:GetHeight()) < 0.5 then
		place(f, w, h)
		return
	end
	local point, _, relative = f:GetPoint(1)
	if point ~= "TOPLEFT" or relative ~= "BOTTOMLEFT" then
		local left, top = f:GetLeft(), f:GetTop()
		if left and top then
			f:ClearAllPoints()
			f:SetPoint("TOPLEFT", UIParent, "BOTTOMLEFT", left, top)
		end
	end
	f:SetHeight(h)
end

-- Filling it ---------------------------------------------------------------------------------------------------------

--- The steps the window shows together, as { first, last, steps }: the guide's visit step i belongs to (Guide.Group
--- gives its first and last step, or the card itself), else step i alone.
local function cardFor(i, step)
	if Guide.Group then
		local g, last = Guide.Group(i)
		if type(g) == "number" and type(last) == "number" and g <= i and i <= last then
			local steps = {}
			for j = g, last do
				steps[#steps + 1] = Guide.Step(j)
			end
			g = { first = g, last = last, steps = steps }
		end
		if type(g) == "table" and type(g.steps) == "table" and #g.steps > 0 and type(g.first) == "number" and type(g.last) == "number" and g.first <= i and i <= g.last then
			return g
		end
	end
	return { first = i, last = i, steps = { step } }
end

--- A step's heading under its kind, which already says what to do: the quest to take or hand in (the line under it
--- says who has it), where to fly or sail, the trainer, the level to reach; the other kinds in their own words.
local function headingOf(step)
	local k = step[1]
	local title, sub = Guide.Describe(step)
	if k == Guide.ACCEPT or k == Guide.TURNIN then
		return Guide.QuestName(step[2]), sub
	elseif k == Guide.FLY then
		return Guide.TaxiShort(step[3]), sub
	elseif k == Guide.FLIGHTPATH then
		return Guide.TaxiShort(step[2]), sub
	elseif k == Guide.ZONE then
		return Guide.ZoneName(step[2]), sub
	elseif k == Guide.BOAT then
		local _, _, _, name = Guide.BoatEnd(step)
		return name and (name:gsub("^%l", string.upper)) or title, sub
	elseif k == Guide.TRAIN then
		local _, _, _, who = Guide.Target(step)
		return who or "Your class trainer", sub
	elseif k == Guide.GRIND then
		return "To level " .. step[2], sub
	elseif k == Guide.DO then
		return title, nil
	end
	return title, sub
end

--- A card's heading and the line under it: a step's own for a card of one; for a visit, who the quests are taken from and
--- handed to, else the quests whose objectives they are, else what the card's step is at.
local function heading(card, step)
	if #card.steps == 1 then
		return headingOf(step)
	end
	local givers, seen, quests = {}, {}, {}
	for _, s in ipairs(card.steps) do
		if s[1] == Guide.ACCEPT or s[1] == Guide.TURNIN then
			local name = Guide.EntityName(s[3])
			if name and not seen[name] then
				seen[name] = true
				givers[#givers + 1] = name
			end
		elseif s[1] == Guide.DO then
			quests[#quests + 1] = Guide.QuestName(s[2])
		end
	end
	if #givers > 0 and #quests == 0 then
		return table.concat(givers, ", "), nil
	elseif #quests == #card.steps then
		return table.concat(quests, ", "), nil
	end
	local _, _, _, who = Guide.Target(step)
	return who or (headingOf(step)), nil
end

--- The line under a card's title: who to see or what the step asks (from its heading), and the zone it is in when that
--- is not the one you are in. The Hearthstone, a teleport and a zone to go to say where they take you themselves.
local function metaOf(step, sub, area)
	local k = step[1]
	area = area or step[4]
	local zone
	if area and area ~= 0 and k ~= Guide.HEARTH and k ~= Guide.TELEPORT and k ~= Guide.ZONE and not Guide.InZone(area) then
		zone = Guide.ZoneName(area)
	end
	if sub and sub ~= "" then
		return zone and (sub .. "  " .. ns.Hex(ns.HEX.fog, "·") .. "  " .. zone) or sub
	end
	return zone or ""
end

--- What a step adds to the card's checklist, each { words, count or experience, done, quest mark, experience? }: a
--- quest's objectives with their counts; what a grind step has left (kills, and the experience); in a card of several
--- steps, any other step as a line of its own, ticked once it is done, a quest to hand in with its experience.
local function addItems(items, step, index, current, alone)
	if step[1] == Guide.DO then
		for _, o in ipairs(Guide.Objectives(step)) do
			items[#items + 1] = { o.text, o.kind ~= 4 and (o.have .. "/" .. o.need) or "", o.done }
		end
	elseif step[1] == Guide.GRIND then
		local text, count = Guide.GrindText(step)
		if text then
			items[#items + 1] = { text, count, false, nil, count ~= "" or nil }
		end
	elseif not alone then
		-- A quest to take or hand in by its name: the game's own mark before it says which.
		local done = index < current or Guide.IsDone(index, step)
		local quest = step[1] == Guide.ACCEPT or step[1] == Guide.TURNIN
		local xp = step[1] == Guide.TURNIN and Guide.QuestXpText(step[2])
		items[#items + 1] = { quest and Guide.QuestName(step[2]) or Guide.Short(step), xp or "", done, KIND_ICON[step[1]], xp and true or nil }
	end
end

--- The card before or after the one shown (dir -1 or 1), past steps you skipped: its first step, or nil at either end.
local function neighbour(f, dir)
	local live, _, route = Guide.Index()
	if not live or Guide.Waiting() then
		return nil
	end
	local first, last = Guide.Group(f.view or live)
	local j = dir > 0 and last + 1 or first - 1
	while j >= 1 and j <= #route.steps and Guide.IsSkipped(j) do
		j = j + dir
	end
	if j < 1 or j > #route.steps then
		return nil
	end
	return (Guide.Group(j))
end

--- Looks at the card before or after the one shown, leaving your place in the route as it is; back on the card you
--- are on, the window follows it again.
local function browse(f, dir)
	local j = neighbour(f, dir)
	if not j then
		return
	end
	local live = Guide.Index()
	local first, last = Guide.Group(live)
	if j >= first and j <= last then
		f.view = nil
	else
		f.view, f.viewFrom = j, live
	end
	render(f)
end

--- "Next" and a step's main words, for the footer.
local function nextLine(step)
	return ns.Hex(ns.HEX.fog, "Next") .. "   " .. Guide.Short(step)
end

--- Fills the window for the card shown: its kind, its heading and the line under it, its checklist, and what comes after
--- it; false when there is no route. The card is the one you are on, or one you look at with back and next until the
--- guide moves on or you come back with Current.
local function fill(f)
	local live, liveStep, route = Guide.Index()
	local going = Guide.Going()
	f.going = going
	f.value:SetText("")
	f.pendingXp = 0
	if going then
		-- Somewhere picked elsewhere (a dungeon quest's giver, a rare): its card until you get there or go back to the
		-- route with Current; the route's next step in the footer.
		f.items, f.view = {}, nil
		f.step, f.focus = { 0, 0, 0, going.area, going.x, going.y }, nil
		f.kind:Set(going.label or "Go to", UI.colors.gilt)
		f.title:SetText(going.title or "")
		f.sub:SetText(metaOf(f.step, going.sub))
		for _, line in ipairs(f.lines) do
			line:Hide()
		end
		f.listing = live and ns.db.guideList and true or false
		f.back:Hide()
		f.next:Hide()
		f.now:SetShown(live ~= nil)
		f.toggle:SetShown(live ~= nil)
		f.toggle.active = f.listing
		f.toggle:Tint()
		f.then_:SetText(liveStep and nextLine(liveStep) or "")
		f.footer = liveStep and not f.listing and "then" or nil
		f.target = { going.area, going.x, going.y, going.title }
		return true
	end
	if not live then
		return false
	end
	local waitTitle, waitText = Guide.Waiting()
	f.items = {}
	if waitTitle then
		-- Nothing to follow yet: a note instead of a step, with no compass, buttons or footer.
		f.step, f.mode, f.view, f.footer = nil, nil, nil, nil
		f.kind:Set("Not yet", ns.RGB.gold)
		f.title:SetText(waitTitle)
		f.sub:SetText(waitText)
		f.then_:SetText("")
		f.arrow:Hide()
		f.here:Hide()
		f.far:Hide()
		f.dist:SetText("")
		f.eta:SetText("")
		for _, line in ipairs(f.lines) do
			line:Hide()
		end
		f.back:Hide()
		f.next:Hide()
		f.now:Hide()
		f.toggle:Hide()
		f.listing = false
		Guide.Unpin()
		return true
	end
	if f.view and (f.viewFrom ~= live or not route.steps[f.view]) then
		f.view = nil
	end
	local card = cardFor(f.view or live, f.view and Guide.Step(f.view) or liveStep)
	if f.view and card.first <= live and live <= card.last then
		f.view = nil
		card = cardFor(live, liveStep)
	end
	-- The step the kind and the compass are for: the one to do now; on another card, its first not done.
	local focus = live
	if f.view then
		focus = card.first
		for j = card.first, card.last do
			if not Guide.IsDone(j, route.steps[j]) then
				focus = j
				break
			end
		end
	end
	local step = route.steps[focus]
	f.step, f.focus = step, focus
	-- The experience the card's quests still to hand in give: on your experience bar for your own card, and at the
	-- title's right for a card of that one quest (a card of several says it on each line). When it is enough for your
	-- next level, the kind says so.
	local xp = 0
	for n, s in ipairs(card.steps) do
		local j = card.first + n - 1
		if s[1] == Guide.TURNIN and j >= live and not Guide.IsDone(j, s) then
			xp = xp + (Guide.QuestXp(s[2]) or 0)
		end
	end
	f.pendingXp = f.view and 0 or xp
	local have, max = levelXp()
	local ding = not f.view and have and xp > 0 and have + xp >= max and ns.Hex(ns.HEX.xp, "Level " .. ((ns.player.level or 1) + 1)) or nil
	local color = ns.RGB[KIND_COLOR[step[1]] or "gold"] or UI.colors.gilt
	f.kind:Set(Guide.KindLabel(step) or "", color, KIND_ICON[step[1]], ding)
	local title, sub = heading(card, step)
	f.title:SetText(title)
	f.sub:SetText(metaOf(step, sub))
	if #card.steps == 1 and xp > 0 then
		f.value:SetText(Guide.Thousands(xp) .. " XP")
	end
	-- With the route's list open, the card's checklist is in it, under the card: the card keeps its heading.
	f.listing = ns.db.guideList and true or false
	if not f.listing then
		for n, s in ipairs(card.steps) do
			addItems(f.items, s, card.first + n - 1, live, #card.steps == 1)
		end
	end
	for k, item in ipairs(f.items) do
		setLine(itemLine(f, k), item)
	end
	for k = #f.items + 1, #f.lines do
		f.lines[k]:Hide()
	end
	f.back:Show()
	f.next:Show()
	f.back:SetEnabled(neighbour(f, -1) ~= nil)
	f.next:SetEnabled(neighbour(f, 1) ~= nil)
	f.now:SetShown(f.view ~= nil)
	f.toggle:Show()
	f.toggle.active = f.listing
	f.toggle:Tint()
	if f.view then
		-- How far the card is from yours, in steps still on the route.
		local n, lo, hi = 0, math.min(live, f.view), math.max(live, f.view)
		for j = lo, hi - 1 do
			n = n + (Guide.IsSkipped(j) and 0 or 1)
		end
		n = math.max(1, n)
		f.ahead:SetText(n .. (n == 1 and " step " or " steps ") .. (f.view > live and "ahead" or "back"))
		f.footer = "view"
	else
		-- Next: the first step past the card that is not skipped, its main words alone (the quest, the flight, the
		-- trainer), so they fit the line whole.
		local after
		for j = card.last + 1, #route.steps do
			if not Guide.IsSkipped(j) then
				after = route.steps[j]
				break
			end
		end
		f.then_:SetText(after and nextLine(after) or "")
		-- With the route's list open, it says what comes next itself.
		f.footer = after and not f.listing and "then" or nil
	end
	f.target = { Guide.Target(step) }
	return true
end

-- The route's list ----------------------------------------------------------------------------------------------------

--- A visit's heading in the list: the quests whose objectives it is, who the quests are taken from and handed to, else
--- the step in its own words.
local function listHeading(card)
	local givers, seen, quests = {}, {}, {}
	for _, s in ipairs(card.steps) do
		if s[1] == Guide.ACCEPT or s[1] == Guide.TURNIN then
			local name = Guide.EntityName(s[3])
			if name and not seen[name] then
				seen[name] = true
				givers[#givers + 1] = name
			end
		elseif s[1] == Guide.DO then
			quests[#quests + 1] = Guide.QuestName(s[2])
		end
	end
	if #quests > 0 then
		return table.concat(quests, ", ")
	elseif #givers > 0 then
		return table.concat(givers, ", ")
	end
	return (Guide.Describe(card.steps[1]))
end

--- The route around your step, as the list's rows: the zone's name where the route comes into one (and at the top),
--- each visit's heading, then its lines (the quests to take and hand in, a quest's objectives, what a grind has left);
--- from a few visits back to many ahead, past what you skipped. Returns the rows, the row of your visit's heading and
--- that of the one you look at.
local function listRows(f)
	local live, _, route = Guide.Index()
	local n = #route.steps
	local start = (Guide.Group(live))
	for _ = 1, LIST_BACK do
		local j = start - 1
		while j >= 1 and Guide.IsSkipped(j) do
			j = j - 1
		end
		if j < 1 then
			break
		end
		start = (Guide.Group(j))
	end
	local rows, mine, seen, zone = {}, nil, nil, nil
	local i, cards = start, 0
	while i <= n and cards < LIST_BACK + 1 + LIST_AHEAD do
		local first, last = Guide.Group(i)
		local steps, index = {}, {}
		for j = first, last do
			if not Guide.IsSkipped(j) then
				steps[#steps + 1] = route.steps[j]
				index[#index + 1] = j
			end
		end
		if #steps > 0 then
			cards = cards + 1
			local s1 = steps[1]
			local past = last < live
			if s1[4] ~= zone then
				zone = s1[4]
				rows[#rows + 1] = { zone = true, text = Guide.ZoneName(zone), card = first, past = past }
			end
			local row = {
				head = true,
				text = listHeading({ steps = steps }),
				kind = s1[1],
				card = first,
				here = first <= live and live <= last,
				viewed = f.view ~= nil and first <= f.view and f.view <= last,
				past = past,
			}
			rows[#rows + 1] = row
			if row.here then
				mine = #rows
			end
			if row.viewed then
				seen = #rows
			end
			-- Its lines: a quest step of a visit with others, a quest's objectives, a grind's countdown; a flight, a
			-- trainer and the like are said whole by the heading.
			local items = {}
			for k, s in ipairs(steps) do
				if s[1] == Guide.ACCEPT or s[1] == Guide.TURNIN or s[1] == Guide.DO or s[1] == Guide.GRIND then
					addItems(items, s, index[k], live, false)
				end
			end
			for _, item in ipairs(items) do
				rows[#rows + 1] = {
					text = item[1],
					count = item[2],
					done = item[3] or row.past,
					mark = item[4],
					xp = item[5],
					card = first,
					here = row.here,
					viewed = row.viewed,
					past = row.past,
				}
			end
		end
		i = last + 1
	end
	return rows, mine, seen
end

--- A row of the list: a zone's name in small quiet capitals over a hairline; a visit's heading in bold; or a line under
--- it with a tick, the game's quest mark or an open ring, and a count or the experience at the right. Your visit has a
--- gold edge and a warm tint, the one you look at a light one; a click shows that visit in the card (yours again, if it
--- is yours). Words cut short show whole under the cursor.
local function listRow(f, list)
	local row = CreateFrame("Button", nil, list)
	row:RegisterForClicks("LeftButtonUp")
	row.tint = piece(row, "BACKGROUND", 0)
	row.tint:SetAllPoints()
	row.accent = piece(row, "ARTWORK", 0)
	row.accent:SetPoint("TOPLEFT", 0, 0)
	row.accent:SetPoint("BOTTOMLEFT", 0, 0)
	row.accent:SetWidth(2)
	row.accent:SetVertexColor(UI.colors.gilt[1], UI.colors.gilt[2], UI.colors.gilt[3], 0.9)
	row.zone = UI.Text(row, 10, ns.RGB.fog, { weight = "bold" })
	row.zone:SetPoint("BOTTOMLEFT", 8, 4)
	row.zoneRule = piece(row, "ARTWORK", 0)
	row.zoneRule:SetHeight(1)
	row.zoneRule:SetPoint("LEFT", row.zone, "RIGHT", 8, 0)
	row.zoneRule:SetPoint("RIGHT", -6, 0)
	row.head = UI.Text(row, 11.5, ns.RGB.white, { weight = "bold" })
	row.head:SetPoint("BOTTOMLEFT", 8, 3)
	row.head:SetPoint("BOTTOMRIGHT", -6, 3)
	row.check = UI.Mark(row, "Check", 12, ns.RGB.green)
	row.check:SetPoint("LEFT", 8, 0)
	row.icon = row:CreateTexture(nil, "ARTWORK")
	row.icon:SetSize(14, 14)
	row.icon:SetPoint("LEFT", 6.5, 0)
	row.dot = piece(row, "ARTWORK", 0, UI.MEDIA .. "Ring4.tga")
	row.dot:SetSize(7, 7)
	row.dot:SetPoint("LEFT", 10.5, 0)
	row.count = UI.Text(row, 11, ns.RGB.white, { weight = "medium", justify = "RIGHT" })
	row.count:SetPoint("RIGHT", -6, 0)
	row.text = UI.Text(row, 11.5, ns.RGB.text)
	row.text:SetPoint("LEFT", 26, 0)
	row.text:SetPoint("RIGHT", row.count, "LEFT", -8, 0)
	function row:Tint()
		local item = self.item
		local a = item and not item.zone and ((item.here and 0.075 or item.viewed and 0.06 or 0) + (self.hot and 0.045 or 0)) or 0
		local c = item and item.here and UI.colors.gilt or { 1, 1, 1 }
		self.tint:SetVertexColor(c[1], c[2], c[3], a)
	end
	row:SetScript("OnEnter", function(self)
		self.hot = true
		self:Tint()
		local label = self.item and (self.item.zone and self.zone or self.item.head and self.head or self.text)
		if label and label.IsTruncated and label:IsTruncated() then
			GameTooltip:SetOwner(self, "ANCHOR_LEFT")
			GameTooltip:SetText(self.item.text, 1, 1, 1, 1, true)
			GameTooltip:Show()
		end
	end)
	row:SetScript("OnLeave", function(self)
		self.hot = false
		self:Tint()
		GameTooltip:Hide()
	end)
	row:SetScript("OnClick", function(self)
		local item = self.item
		if not item or item.zone then
			return
		end
		local live = Guide.Index()
		local first, last = Guide.Group(item.card)
		if first <= live and live <= last then
			f.view = nil
		else
			f.view, f.viewFrom = item.card, live
		end
		-- The list stays where it is: the row clicked is in sight.
		f.listView = f.view
		render(f)
	end)
	return row
end

--- Fills a row of the list from its item.
local function setListRow(row, item)
	row.item = item
	local zone, head = item.zone and true or false, item.head and true or false
	row.zone:SetShown(zone)
	row.zoneRule:SetShown(zone)
	row.head:SetShown(head)
	row.text:SetShown(not zone and not head)
	row.count:SetShown(not zone and not head)
	row.accent:SetShown(not zone and item.here and true or false)
	if zone or head then
		row.check:Hide()
		row.icon:Hide()
		row.dot:Hide()
	end
	if zone then
		row.zone:SetText(string.upper(item.text or ""))
		local rule = UI.colors.rule
		row.zoneRule:SetVertexColor(rule[1], rule[2], rule[3], rule[4])
	elseif head then
		row.head:SetText(item.text)
		-- A step said whole by its heading (a flight, a trainer, a level to reach) in its kind's colour.
		local quest = item.kind == Guide.ACCEPT or item.kind == Guide.TURNIN or item.kind == Guide.DO
		local c = item.past and ns.RGB.fog or not quest and ns.RGB[KIND_COLOR[item.kind] or "white"] or ns.RGB.white
		row.head:SetTextColor(c[1], c[2], c[3], 1)
	else
		setLine(row, { item.text, item.count, item.done, item.mark, item.xp })
		if item.xp and not item.done then
			-- Quieter than on the card: the list is for looking ahead.
			row.count:SetAlpha(0.8)
		else
			row.count:SetAlpha(1)
		end
	end
	row:Tint()
end

--- Fills the list and keeps it where it helps: your visit at the top (under its zone's name, when it starts one) when it
--- opens or your step moves on, the scroll bar saying there is more before it; on the visit you look at when back or
--- next takes you out of sight of it; else where you scrolled it.
local function refreshList(f)
	local rows, mine, seen = listRows(f)
	local list = f.list
	list:SetData(rows, true)
	local live = Guide.Index()
	if f.listAt ~= live then
		f.listAt, f.listView = live, f.view
		if mine then
			list:ScrollTo(rows[mine - 1] and rows[mine - 1].zone and mine - 1 or mine)
		end
	elseif f.listView ~= f.view then
		f.listView = f.view
		if seen then
			list:Reveal(seen)
		elseif mine then
			list:Reveal(mine)
		end
	end
end

--- Lays the window out for the card shown: to the size you gave it, or fitting the card.
render = function(f)
	if not fill(f) then
		f:Hide()
		return
	end
	if f.fixed then
		layout(f)
	else
		fit(f)
	end
	if f.listing and f.step then
		refreshList(f)
	end
	if f.loose then
		f.loose:SetShown(f:IsShown() and f.step ~= nil)
	end
	-- The look (Options) and the walking time, as they are set now.
	local L = look()
	if f.shadowAlpha ~= L.shadow then
		f.shadowAlpha = L.shadow
		for _, t in ipairs(f.shadowParts) do
			t:SetVertexColor(0, 0, 0, L.shadow)
		end
	end
	f.inCard.dial.well:SetVertexColor(0, 0, 0, L.well)
	if f.looseFrame then
		f.looseFrame.c.dial.well:SetVertexColor(0, 0, 0, L.looseWell)
	end
	f.eta:SetShown((f.mode == "arrow" or f.mode == "here") and timeShown(f))
	experience(f)
	f:Point(true)
end

-- The arrow out of the window -------------------------------------------------------------------------------------------

local LOOSE = 64 -- the loose arrow's compass

--- Saves where the loose arrow is (its centre from the screen's bottom left, in its own units) and anchors it there.
local function rememberLoose(a)
	local x, y = a:GetCenter()
	if not (x and y) then
		return
	end
	x, y = math.floor(x + 0.5), math.floor(y + 0.5)
	a:ClearAllPoints()
	a:SetPoint("CENTER", UIParent, "BOTTOMLEFT", x, y)
	ns.db.guideArrow = { x = x, y = y }
end

local dock

--- The loose arrow: the compass alone, anywhere on the screen, with the distance and the time under it. Drag it to move
--- it; drop it on the window, or double-click it, to put it back; Ctrl and the mouse wheel scale it.
local function looseFrame(f)
	if f.looseFrame then
		return f.looseFrame
	end
	local a = CreateFrame("Button", "GrimoireForeverGuideArrow", UIParent)
	a:SetFrameStrata("MEDIUM")
	a:SetClampedToScreen(true)
	a:SetMovable(true)
	a:EnableMouse(true)
	a:RegisterForDrag("LeftButton")
	if a.SetDontSavePosition then
		a:SetDontSavePosition(true)
	end
	a:SetSize(LOOSE + 40, LOOSE + 44)
	a:SetScale(clamp(tonumber(ns.db.guideArrowScale) or 1, MIN_SCALE, MAX_SCALE))
	local c = compass(a)
	-- On its own over the world, its well a shade darker so the arrow reads on snow and sand.
	c.dial.well:SetVertexColor(0, 0, 0, look().looseWell)
	c.dial:SetPoint("TOP", a, "TOP", 0, 0)
	c.dial:SetSize(LOOSE, LOOSE)
	c.arrow:SetSize(LOOSE * 0.6, LOOSE * 0.6)
	c.checkSize = math.floor(LOOSE * 0.48)
	c.here:SetSize(c.checkSize, c.checkSize)
	c.dial.icon:SetSize(LOOSE - 12, LOOSE - 12)
	c.dial.globe:SetSize(LOOSE * 0.5, LOOSE * 0.5)
	local font, distH = distSize(LOOSE)
	UI.SetFont(c.dist, "bold", font)
	c.dist:SetPoint("TOP", c.dial, "BOTTOM", 0, -3)
	c.dist:SetSize(LOOSE + 40, distH)
	c.eta:SetPoint("TOP", c.dist, "BOTTOM", 0, 0)
	c.eta:SetSize(LOOSE + 40, 14)
	c.far:SetPoint("TOP", c.dial, "BOTTOM", 0, -5)
	c.far:SetWidth(LOOSE + 36)
	a.c = c
	a:SetScript("OnDragStart", function(self)
		if not ns.db.guideLock then
			self:StartMoving()
		end
	end)
	a:SetScript("OnDragStop", function(self)
		self:StopMovingOrSizing()
		if f:IsShown() and f:IsMouseOver() then
			dock(f) -- dropped on the window: back in it
		else
			rememberLoose(self)
		end
	end)
	a:SetScript("OnDoubleClick", function()
		if not ns.db.guideLock then
			dock(f)
		end
	end)
	a:SetScript("OnEnter", function(self)
		if ns.db.guideLock then
			return
		end
		GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
		GameTooltip:SetText("Double-click to put it back", 1, 1, 1, 1, true)
		GameTooltip:Show()
	end)
	a:SetScript("OnLeave", function()
		GameTooltip:Hide()
	end)
	a:RegisterEvent("MODIFIER_STATE_CHANGED")
	a:SetScript("OnEvent", function(self)
		self:EnableMouseWheel(ctrl() and not ns.db.guideLock)
	end)
	a:SetScript("OnMouseWheel", function(self, delta)
		if not ctrl() or ns.db.guideLock then
			return
		end
		local old = self:GetScale()
		local new = math.floor(clamp(old + delta * 0.05, MIN_SCALE, MAX_SCALE) * 20 + 0.5) / 20
		local x, y = self:GetCenter()
		self:SetScale(new)
		ns.db.guideArrowScale = new
		if x and y then
			self:ClearAllPoints()
			self:SetPoint("CENTER", UIParent, "BOTTOMLEFT", x * old / new, y * old / new)
		end
		rememberLoose(self)
	end)
	a:Hide()
	f.looseFrame = a
	return a
end

--- Takes the arrow out of the window, to (x, y) on the screen (its centre, in its own units): the card's words take its
--- room.
local function release(f, x, y)
	local a = looseFrame(f)
	a:ClearAllPoints()
	a:SetPoint("CENTER", UIParent, "BOTTOMLEFT", x, y)
	f.loose = a
	useCompass(f, a.c)
	a:SetShown(f:IsShown())
	if f.items then
		render(f)
	end
end

--- Puts the arrow back in the window.
dock = function(f)
	if not f.loose then
		return
	end
	f.loose:Hide()
	f.loose = nil
	ns.db.guideArrow = nil
	useCompass(f, f.inCard)
	render(f)
end

--- The card's compass can be dragged out: the arrow follows the cursor and stays where you let go (unless that is on the
--- window). A click on it, as anywhere on the window, opens the whole route.
local function dragOut(f)
	local d = f.inCard.dial
	d:EnableMouse(true)
	d:RegisterForDrag("LeftButton")
	d:SetScript("OnEnter", function(self)
		if ns.db.guideLock then
			return
		end
		GameTooltip:SetOwner(self, "ANCHOR_LEFT")
		GameTooltip:SetText("Drag the arrow anywhere", 1, 1, 1, 1, true)
		GameTooltip:Show()
	end)
	d:SetScript("OnLeave", function()
		GameTooltip:Hide()
	end)
	d:SetScript("OnDragStart", function(self)
		if ns.db.guideLock then
			return
		end
		local a = looseFrame(f)
		local cx, cy = GetCursorPosition()
		local s = a:GetEffectiveScale()
		a:ClearAllPoints()
		a:SetPoint("CENTER", UIParent, "BOTTOMLEFT", cx / s, cy / s)
		a:Show()
		a:StartMoving()
		f.pulling = a
		self:SetAlpha(0.3)
	end)
	d:SetScript("OnDragStop", function(self)
		local a = f.pulling
		f.pulling = nil
		self:SetAlpha(1)
		if not a then
			return
		end
		a:StopMovingOrSizing()
		if f:IsMouseOver() then
			-- Let go over the window: it stays in.
			a:Hide()
			return
		end
		local x, y = a:GetCenter()
		release(f, x, y)
		rememberLoose(a)
	end)
	d:SetScript("OnMouseUp", function(_, button)
		if not f.pulling and button == "LeftButton" and ns.Open then
			ns.Open("leveling")
		end
	end)
end

-- The window -------------------------------------------------------------------------------------------------------

--- A small pill with a word: gold for the way back to your step.
local function pill(f, label, tip, onClick)
	local b = UI.Button(f, label, 60, 18, onClick)
	UI.SetFont(b.label, "bold", 10.5)
	b.label:ClearAllPoints()
	b.label:SetPoint("CENTER", 0, 0.5)
	b:SetWidth(math.ceil(UI.TextWidth(b.label)) + 18)
	b:SetSelected(true)
	b.tip = tip
	return b
end

--- A word to click, in gold, a shade brighter under the cursor.
local function link(f, label, tip, onClick)
	local b = CreateFrame("Button", nil, f)
	b.text = UI.Text(b, 11, UI.colors.gilt, { weight = "bold" })
	b.text:SetPoint("LEFT")
	b.text:SetText(label)
	b:SetSize(math.ceil(UI.TextWidth(b.text)) + 2, 18)
	b:SetScript("OnEnter", function(self)
		local c = UI.colors.giltBright
		self.text:SetTextColor(c[1], c[2], c[3], 1)
		GameTooltip:SetOwner(self, "ANCHOR_TOP")
		GameTooltip:SetText(tip, 1, 1, 1, 1, true)
		GameTooltip:Show()
	end)
	b:SetScript("OnLeave", function(self)
		local c = UI.colors.gilt
		self.text:SetTextColor(c[1], c[2], c[3], 1)
		GameTooltip:Hide()
	end)
	b:SetScript("OnClick", onClick)
	return b
end

--- A right-click on the window: its look, its units and the lock.
local function settingsMenu(f)
	if not (MenuUtil and MenuUtil.CreateContextMenu) then
		if ns.Open then
			ns.Open("about")
		end
		return
	end
	local function redraw()
		ns.Send("GUIDE")
	end
	MenuUtil.CreateContextMenu(f, function(_, root)
		root:CreateTitle("Leveling guide")
		for _, t in ipairs({ { "dark", "Dark" }, { "clear", "Clear" }, { "classic", "Classic" } }) do
			root:CreateRadio(t[2], function(value)
				return (ns.db.guideTheme or "dark") == value
			end, function(value)
				ns.db.guideTheme = value
				redraw()
			end, t[1])
		end
		root:CreateDivider()
		root:CreateCheckbox("Walking time", function()
			return ns.db.guideTime ~= false
		end, function()
			ns.db.guideTime = ns.db.guideTime == false
			redraw()
		end)
		root:CreateCheckbox("Meters", function()
			return ns.db.guideMeters and true or false
		end, function()
			ns.db.guideMeters = not ns.db.guideMeters
			redraw()
		end)
		root:CreateCheckbox("Lock", function()
			return ns.db.guideLock and true or false
		end, function()
			ns.db.guideLock = not ns.db.guideLock
		end)
	end)
end

local function create()
	-- A place or size saved for the window's earlier layout is let go: it opens where it now belongs.
	if ns.db.guideLayout ~= LAYOUT then
		ns.db.guidePos, ns.db.guideLayout = nil, LAYOUT
	end
	local f = CreateFrame("Frame", "GrimoireForeverGuide", UIParent)
	f:SetFrameStrata("MEDIUM")
	f:SetClampedToScreen(true)
	f:SetMovable(true)
	f:SetResizable(true)
	if f.SetResizeBounds then
		f:SetResizeBounds(MIN_W, MIN_H, MAX_W, MAX_H)
	end
	if f.SetDontSavePosition then
		-- Where it sits and its size are saved with Grimoire's settings, not in the game's layout cache too.
		f:SetDontSavePosition(true)
	end
	f:EnableMouse(true)
	f:RegisterForDrag("LeftButton")
	f:SetScale(clamp(tonumber(ns.db.guideScale) or 1, MIN_SCALE, MAX_SCALE))
	-- Sized by hand once, it keeps that size; else its height follows its card.
	local pos = ns.db.guidePos
	f.fixed = tonumber(pos and pos.h) ~= nil
	f:SetSize(clamp(tonumber(pos and pos.w) or WIDTH, MIN_W, MAX_W), clamp(tonumber(pos and pos.h) or 160, MIN_H, MAX_H))
	if pos and pos[1] then
		f:SetPoint(pos[1], UIParent, pos.relPoint or pos[1], pos[2], pos[3])
	else
		home(f)
	end
	f:SetScript("OnDragStart", function(self)
		if not ns.db.guideLock then
			self.dragging = true
			self:StartMoving()
		end
	end)
	f:SetScript("OnDragStop", function(self)
		self:StopMovingOrSizing()
		remember(self)
	end)
	-- A click (not the end of a drag) opens the whole route; a right-click, the window's settings.
	f:SetScript("OnMouseUp", function(self, button)
		if self.dragging then
			self.dragging = false
			return
		end
		if button == "RightButton" then
			settingsMenu(self)
		elseif button == "LeftButton" and ns.Open then
			ns.Open("leveling")
		end
	end)

	f.card = card(f)
	shadow(f)
	-- The line under the card, with your experience along it.
	f.xpbar = experienceBar(f)

	-- The compass, with the distance and the time to walk it (or a short note) under it. Drag it out of the window to
	-- put the arrow anywhere on the screen.
	f.drawn = {}
	f.inCard = compass(f)
	useCompass(f, f.inCard)
	dragOut(f)

	-- The top row: the step's kind beside the compass; at the right the cross, the list, next and back, and Current
	-- while you look at another step.
	f.kind = kindLabel(f)
	f.close = roundButton(f, "Close", nil, "Hide the guide", function()
		ns.db.guideShown = false
		ns.UpdateGuideFrame()
	end)
	f.close:SetPoint("RIGHT", f, "TOPRIGHT", -6, -ROW)
	f.toggle = roundButton(f, "List", nil, function()
		return f.listing and "Hide the route" or "Show the route"
	end, function()
		ns.db.guideList = not f.listing or nil
		f.listAt = nil
		render(f)
	end)
	f.toggle:SetPoint("RIGHT", f.close, "LEFT", 0, 0)
	f.next = roundButton(f, "Chevron", math.pi / 2, "Next step", function()
		browse(f, 1)
	end)
	f.next:SetPoint("RIGHT", f.toggle, "LEFT", 0, 0)
	f.back = roundButton(f, "Chevron", -math.pi / 2, "Previous step", function()
		browse(f, -1)
	end)
	f.back:SetPoint("RIGHT", f.next, "LEFT", 0, 0)
	f.buttons = { f.close, f.toggle, f.back, f.next }
	f.now = pill(f, "Current", "Back to your step", function()
		f.view = nil
		if Guide.Going() then
			Guide.GoTo(nil)
		end
		render(f)
	end)
	f.now:SetPoint("RIGHT", f.back, "LEFT", -6, 0)
	f.now:Hide()

	-- The step: the title (with the experience a quest to hand in gives at its right), the line under it, the checklist.
	f.title = UI.Text(f, 14, ns.RGB.white, { weight = "bold", wrap = true, spacing = 2 })
	f.value = UI.Text(f, 11.5, ns.RGB.xp, { weight = "medium", justify = "RIGHT" })
	f.sub = UI.Text(f, 11.5, ns.RGB.mist, { wrap = true, spacing = 2 })
	f.lines = {}
	f.more = UI.Text(f, 11, ns.RGB.fog)

	-- The route's list, under the card while it is open. The wheel scrolls it (with Ctrl, it scales the window).
	f.list = UI.List(f, ROW_ITEM, function(list)
		return listRow(f, list)
	end, setListRow, function(item)
		return item.zone and ROW_ZONE or item.head and ROW_HEAD or ROW_ITEM
	end)
	-- Its last row shows in part where the room ends, so the list reads as one that scrolls on.
	f.list:SetPartial(true)
	f.list:SetScript("OnMouseWheel", function(self, delta)
		if ctrl() then
			if not ns.db.guideLock then
				rescale(f, f:GetScale() + delta * 0.05)
			end
			return
		end
		self.bar:SetValue(math.max(0, math.min(self.maxOffset or 0, self.offset - delta * 2)))
	end)
	f.list:Hide()

	-- The footer: the next step, which opens the route's list; looking at another, how far it is and the button that
	-- makes it yours.
	f.then_ = UI.Text(f, 11.5, ns.RGB.mist)
	f.thenButton = CreateFrame("Button", nil, f)
	f.thenButton:SetScript("OnClick", function()
		ns.db.guideList = true
		f.listAt = nil
		render(f)
	end)
	f.thenButton:SetScript("OnEnter", function()
		f.then_:SetTextColor(ns.RGB.white[1], ns.RGB.white[2], ns.RGB.white[3], 1)
	end)
	f.thenButton:SetScript("OnLeave", function()
		f.then_:SetTextColor(ns.RGB.mist[1], ns.RGB.mist[2], ns.RGB.mist[3], 1)
	end)
	f.ahead = UI.Text(f, 11.5, ns.RGB.mist)
	f.start = link(f, "Start here", "Make it your step", function()
		local j = f.view and f.focus
		f.view = nil
		if j then
			Guide.Set(j)
		end
		render(f)
	end)

	-- The corner to size the window from: an arc along the card's curve, faint at rest and lit while the cursor is over
	-- the window.
	local grip = CreateFrame("Button", nil, f)
	grip:SetSize(16, 16)
	grip:SetPoint("BOTTOMRIGHT", 0, 0)
	grip.mark = piece(grip, "OVERLAY", 0, UI.MEDIA .. "Grip.tga")
	grip.mark:SetSize(12, 12)
	grip.mark:SetPoint("BOTTOMRIGHT", -1, 1)
	grip.mark:SetVertexColor(ns.RGB.mist[1], ns.RGB.mist[2], ns.RGB.mist[3], 1)
	grip.mark:SetAlpha(0.3)
	grip:SetScript("OnEnter", function(self)
		self.mark:SetVertexColor(unpack(UI.colors.gilt))
		GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
		GameTooltip:SetText("Drag to size; double-click to fit", 1, 1, 1, 1, true)
		GameTooltip:Show()
	end)
	grip:SetScript("OnLeave", function(self)
		self.mark:SetVertexColor(ns.RGB.mist[1], ns.RGB.mist[2], ns.RGB.mist[3], 1)
		GameTooltip:Hide()
	end)
	grip:SetScript("OnMouseDown", function(_, button)
		if button == "LeftButton" and not ns.db.guideLock then
			-- Sized by hand, the window keeps its size: laid out for it as you drag, saved with where it sits.
			f.sizing, f.fixed = true, true
			f:StartSizing("BOTTOMRIGHT")
		end
	end)
	grip:SetScript("OnMouseUp", function()
		if f.sizing then
			f.sizing = false
			f:StopMovingOrSizing()
			remember(f)
			ns.db.guidePos.w, ns.db.guidePos.h = math.floor(f:GetWidth() + 0.5), math.floor(f:GetHeight() + 0.5)
			layout(f)
		end
	end)
	grip:SetScript("OnDoubleClick", function()
		-- Back to fitting its card, at the width you gave it.
		f.fixed = false
		if ns.db.guidePos then
			ns.db.guidePos.h = nil
		end
		render(f)
	end)
	f.grip = grip
	f:SetScript("OnSizeChanged", layout)

	-- Ctrl and the mouse wheel scale the window. It takes the wheel only while Ctrl is down, so otherwise the wheel
	-- still zooms the camera with the cursor over it. Until you move it, it finds its place again once the game has
	-- laid out its own frames.
	f:RegisterEvent("MODIFIER_STATE_CHANGED")
	f:RegisterEvent("PLAYER_ENTERING_WORLD")
	f:SetScript("OnEvent", function(self, event)
		if event == "PLAYER_ENTERING_WORLD" then
			if C_Timer and C_Timer.After then
				C_Timer.After(1, function()
					if not ns.db.guidePos and not self.dragging then
						home(self)
						if self.items and not self.fixed then
							fit(self)
						end
					end
				end)
			end
			return
		end
		self:EnableMouseWheel(ctrl() and not ns.db.guideLock)
	end)
	f:SetScript("OnMouseWheel", function(self, delta)
		if ctrl() and not ns.db.guideLock then
			rescale(self, self:GetScale() + delta * 0.05)
		end
	end)

	-- The compass's state: the angle and colours shown, what was last drawn, and the check's growth.
	f.angle, f.rgb, f.pop = 0, { ns.RGB.mist[1], ns.RGB.mist[2], ns.RGB.mist[3] }, 1
	f.fresh = true
	f:SetScript("OnHide", function(self)
		-- Shown again, the arrow points at once, at your step. The loose arrow goes and comes with the window.
		self.fresh, self.mode, self.view = true, nil, nil
		if self.loose then
			self.loose:Hide()
		end
	end)
	f:SetScript("OnShow", function(self)
		if self.loose then
			self.loose:Show()
		end
	end)
	-- Out of the window last time: it is where you left it.
	local saved = ns.db.guideArrow
	if saved and saved.x and saved.y then
		release(f, saved.x, saved.y)
	end
	f.Point = point
	f.textElapsed, f.tickElapsed = 1, 1
	f:SetScript("OnUpdate", function(self, elapsed)
		self.textElapsed = self.textElapsed + elapsed
		self.tickElapsed = self.tickElapsed + elapsed
		if self.tickElapsed >= 0.5 then
			self.tickElapsed = 0
			Guide.Tick()
		end
		local text = self.textElapsed >= 0.25
		if text then
			self.textElapsed = 0
		end
		self:Point(text, elapsed)
		glance(self, elapsed)
	end)
	f:Hide()
	glance(f)
	return f
end

--- Shows or hides the window as the settings say, and fills it.
function ns.UpdateGuideFrame()
	if not ns.guide or not ns.db then
		return
	end
	-- At level 60 the route is behind you: the window stays away unless you open it there.
	local done = (ns.player.level or 1) >= 60 and not (ns.char.guide and ns.char.guide.keep)
	if (not ns.db.guideShown or done) and not Guide.Going() then
		if frame then
			frame:Hide()
		end
		Guide.Unpin()
		return
	end
	frame = frame or create()
	ns.GuideFrame = frame
	frame:Show()
	render(frame)
end

--- Shows a step of the route in the window, as back and next do, leaving your place as it is (the world map's pins).
function ns.ShowGuideStep(j)
	if not (frame and frame:IsShown()) then
		return
	end
	local live = Guide.Index()
	if not live or not Guide.Step(j) then
		return
	end
	if Guide.Going() then
		Guide.GoTo(nil)
	end
	local first, last = Guide.Group(live)
	if j >= first and j <= last then
		frame.view = nil
	else
		frame.view, frame.viewFrom = (Guide.Group(j)), live
	end
	render(frame)
end

ns.Listen("GUIDE", function()
	if frame and frame:IsShown() then
		render(frame)
	end
end)

-- Your experience moves the bar under the card; a new zone changes which steps say theirs.
ns.On("PLAYER_XP_UPDATE", function(unit)
	if unit == "player" and frame and frame:IsShown() then
		experience(frame)
	end
end)
ns.On("ZONE_CHANGED_NEW_AREA", function()
	if frame and frame:IsShown() then
		render(frame)
	end
end)

ns.Listen("LOGIN", function()
	ns.UpdateGuideFrame()
end)
