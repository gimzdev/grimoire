-- The building blocks of Grimoire's window, in the site's style: dark rounded surfaces with hairline edges, the site's
-- fonts, pill buttons, and gold kept for what is active.
local ADDON, ns = ...

local UI = {}
ns.UI = UI

local MEDIA = "Interface\\AddOns\\" .. ADDON .. "\\Media\\"
local WHITE = "Interface\\Buttons\\WHITE8X8"
local GAME_FONT = STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF"
UI.MEDIA, UI.WHITE = MEDIA, WHITE

local unpack = unpack or table.unpack

-- Fonts ---------------------------------------------------------------------------------------------------------

-- The site's Mona Sans, and IM FELL English SC for the name. Mona Sans has no Cyrillic, Chinese or Korean letters, so
-- clients in those alphabets keep the game's own font.
local LATIN = { enUS = true, enGB = true, deDE = true, frFR = true, esES = true, esMX = true, itIT = true, ptBR = true, ptPT = true }
local latin = LATIN[GetLocale and GetLocale() or "enUS"] or false
UI.latin = latin
UI.FONTS = {
	regular = latin and MEDIA .. "MonaSans-Regular.ttf" or GAME_FONT,
	medium = latin and MEDIA .. "MonaSans-Medium.ttf" or GAME_FONT,
	bold = latin and MEDIA .. "MonaSans-SemiBold.ttf" or GAME_FONT,
	mark = MEDIA .. "IMFeENsc28P.ttf",
}
UI.FONT, UI.DISPLAY = UI.FONTS.regular, UI.FONTS.bold

-- Asking for every font once now has the game load them before the window first opens: one hidden string per font,
-- so each stays in use.
local probe = CreateFrame("Frame")
probe:Hide()
for _, path in pairs(UI.FONTS) do
	probe:CreateFontString(nil, "OVERLAY"):SetFont(path, 12, "")
end
local probeText = probe:CreateFontString(nil, "OVERLAY")

-- The layout counts a font's size as its em, the way the site does. If the game turns out to draw Mona Sans at another
-- size for the same height, the difference is measured once on ten H's at 40 (749 thousandths of an em each, so 299.6
-- wide) and every size is corrected by it.
local fontScale, tries = nil, 0
local function scale()
	if fontScale then
		return fontScale
	end
	tries = tries + 1
	if latin and probeText:SetFont(UI.FONTS.regular, 40, "") then
		probeText:SetText("HHHHHHHHHH")
		local w = probeText.GetUnboundedStringWidth and probeText:GetUnboundedStringWidth() or probeText:GetStringWidth()
		if not w or w <= 0 then
			-- Not measurable yet: try again with the next few texts, then leave sizes as they are.
			if tries >= 3 then
				fontScale = 1
			end
			return 1
		end
		-- Only the one known difference is corrected: a client that fits the whole line height (1.41 em for Mona
		-- Sans) into the size would measure about 212. Anything near 300, or a reading that makes no sense, is left.
		local s = 299.6 / w
		fontScale = (s > 1.2 and s < 1.65) and s or 1
	else
		fontScale = 1
	end
	return fontScale
end

--- Sets a font string's (or edit box's) font: weight is regular, medium, bold or mark. Falls back to the game's font
--- if a file cannot be read.
function UI.SetFont(fs, weight, size, flags)
	local path = UI.FONTS[weight] or UI.FONTS.regular
	if not fs:SetFont(path, size * scale(), flags or "") then
		fs:SetFont(GAME_FONT, size, flags or "")
	end
end

--- Text that may hold letters Mona Sans lacks (a Cyrillic character name, say) gets the game's font instead.
function UI.FitFont(fs, text, weight, size)
	if text and text:find("[\208-\244]") then
		fs:SetFont(GAME_FONT, size, "")
	else
		UI.SetFont(fs, weight, size)
	end
end

--- A font string. opts: weight (regular, medium, bold, mark), display (bold), wrap, spacing, justify, outline, alpha,
--- layer.
function UI.Text(parent, size, color, opts)
	opts = opts or {}
	size = size or 12
	local fs = parent:CreateFontString(nil, opts.layer or "OVERLAY")
	UI.SetFont(fs, opts.weight or (opts.display and "bold") or (opts.mark and "mark") or "regular", size, opts.outline)
	local c = color or ns.RGB.text
	fs:SetTextColor(c[1], c[2], c[3], opts.alpha or 1)
	fs:SetJustifyH(opts.justify or "LEFT")
	if opts.wrap then
		fs:SetWordWrap(true)
		fs:SetJustifyV("TOP")
		fs:SetSpacing(opts.spacing or (size >= 12 and 3 or 2))
	else
		fs:SetWordWrap(false)
	end
	return fs
end

--- The full width of a font string's text, even when its frame is narrower and the game cuts it short.
function UI.TextWidth(fs)
	if fs.GetUnboundedStringWidth then
		return fs:GetUnboundedStringWidth()
	end
	return fs:GetStringWidth()
end

-- Colours -------------------------------------------------------------------------------------------------------

local function hex(h, a)
	return { tonumber(h:sub(1, 2), 16) / 255, tonumber(h:sub(3, 4), 16) / 255, tonumber(h:sub(5, 6), 16) / 255, a or 1 }
end
UI.hex = hex

UI.colors = {
	window = hex("13161b", 0.97), -- the page side of the window
	side = hex("0b0c0f", 0.97), -- the page list
	card = { 1, 1, 1, 0.035 },
	cardLine = { 1, 1, 1, 0.075 },
	line = { 1, 1, 1, 0.09 },
	rule = { 1, 1, 1, 0.065 },
	field = { 0, 0, 0, 0.28 },
	fieldLine = { 1, 1, 1, 0.11 },
	fieldHover = { 1, 1, 1, 0.2 },
	focus = hex("f2b640", 0.75),
	button = { 1, 1, 1, 0.065 },
	buttonHover = { 1, 1, 1, 0.12 },
	buttonLine = { 1, 1, 1, 0.11 },
	hover = { 1, 1, 1, 0.045 },
	select = { 1, 1, 1, 0.08 },
	gilt = hex("f2b640"),
	giltBright = hex("ffd47a"),
	giltDeep = hex("a2681a"),
	giltSoft = hex("f2b640", 0.15),
	giltLine = hex("f2b640", 0.55),
	ink = hex("1a1204"),
	menu = hex("1a1e24", 0.99),
	none = { 0, 0, 0, 0 },
}
-- Older names, still used here and there.
UI.colors.panel, UI.colors.raised, UI.colors.border = UI.colors.card, UI.colors.button, UI.colors.cardLine

-- Shapes --------------------------------------------------------------------------------------------------------

local CORNERS = { "TOPLEFT", "TOPRIGHT", "BOTTOMLEFT", "BOTTOMRIGHT" }
local QUARTER = {
	TOPLEFT = { 0, 0.5, 0, 0.5 },
	TOPRIGHT = { 0.5, 1, 0, 0.5 },
	BOTTOMLEFT = { 0, 0.5, 0.5, 1 },
	BOTTOMRIGHT = { 0.5, 1, 0.5, 1 },
}

local function disc(r)
	return MEDIA .. (r <= 5 and "Disc16" or r <= 10 and "Disc32" or "Disc64") .. ".tga"
end

local function ring(r)
	return MEDIA .. "Ring" .. math.max(4, math.min(16, math.floor(r + 0.5))) .. ".tga"
end

local function piece(owner, layer, sublevel)
	local t = owner:CreateTexture(nil, layer or "BACKGROUND", nil, sublevel or 0)
	if t.SetSnapToPixelGrid then
		t:SetSnapToPixelGrid(false)
		t:SetTexelSnappingBias(0)
	end
	return t
end

--- inset: a number, or { left, top, right, bottom }.
local function insets(inset)
	if type(inset) == "table" then
		return inset[1] or 0, inset[2] or 0, inset[3] or 0, inset[4] or 0
	end
	inset = inset or 0
	return inset, inset, inset, inset
end

local Shape = {}
Shape.__index = Shape

--- A rounded rectangle: four quarter discs for the corners and three bands between them. Nothing overlaps, so a
--- see-through colour stays even. The textures belong to owner and cover target (owner itself by default), less
--- inset. square: corners to keep square, as { TOPRIGHT = true }.
function UI.Shape(owner, radius, color, layer, sublevel, inset, square, target)
	local s = setmetatable({ owner = owner, target = target or owner, inset = inset, square = square or {}, corners = {}, bands = {} }, Shape)
	for _, point in ipairs(CORNERS) do
		s.corners[point] = piece(owner, layer, sublevel)
	end
	for i = 1, 3 do
		s.bands[i] = piece(owner, layer, sublevel)
		s.bands[i]:SetTexture(WHITE)
	end
	s:SetRadius(radius)
	s:SetColor(unpack(color or UI.colors.none))
	return s
end

function Shape:SetRadius(r)
	self.r = r
	local f = self.target
	local l, t, rt, b = insets(self.inset)
	for _, point in ipairs(CORNERS) do
		local tex = self.corners[point]
		if self.square[point] or r <= 0 then
			tex:SetTexture(WHITE)
			tex:SetTexCoord(0, 1, 0, 1)
		else
			tex:SetTexture(disc(r))
			local q = QUARTER[point]
			tex:SetTexCoord(q[1], q[2], q[3], q[4])
		end
		tex:ClearAllPoints()
		local x = point:find("LEFT") and l or -rt
		local y = point:find("TOP") and -t or b
		tex:SetPoint(point, f, point, x, y)
		tex:SetSize(math.max(r, 0.01), math.max(r, 0.01))
	end
	local top, mid, bottom = self.bands[1], self.bands[2], self.bands[3]
	top:ClearAllPoints()
	top:SetPoint("TOPLEFT", f, "TOPLEFT", l + r, -t)
	top:SetPoint("BOTTOMRIGHT", f, "TOPRIGHT", -rt - r, -t - r)
	mid:ClearAllPoints()
	mid:SetPoint("TOPLEFT", f, "TOPLEFT", l, -t - r)
	mid:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -rt, b + r)
	bottom:ClearAllPoints()
	bottom:SetPoint("TOPLEFT", f, "BOTTOMLEFT", l + r, b + r)
	bottom:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -rt - r, b)
end

function Shape:SetColor(r, g, b, a)
	for _, tex in pairs(self.corners) do
		tex:SetVertexColor(r, g, b, a or 1)
	end
	for _, tex in ipairs(self.bands) do
		tex:SetVertexColor(r, g, b, a or 1)
	end
end

function Shape:SetShown(on)
	for _, tex in pairs(self.corners) do
		tex:SetShown(on)
	end
	for _, tex in ipairs(self.bands) do
		tex:SetShown(on)
	end
end

function Shape:Show()
	self:SetShown(true)
end

function Shape:Hide()
	self:SetShown(false)
end

local Ring = {}
Ring.__index = Ring

--- A rounded outline one unit thick: four quarter rings and four strips.
function UI.Ring(owner, radius, color, layer, sublevel, target)
	local s = setmetatable({ owner = owner, target = target or owner, corners = {}, edges = {} }, Ring)
	for _, point in ipairs(CORNERS) do
		s.corners[point] = piece(owner, layer, sublevel)
	end
	for i = 1, 4 do
		s.edges[i] = piece(owner, layer, sublevel)
		s.edges[i]:SetTexture(WHITE)
	end
	s:SetRadius(radius)
	s:SetColor(unpack(color or UI.colors.none))
	return s
end

function Ring:SetRadius(r)
	self.r = r
	local f = self.target
	for _, point in ipairs(CORNERS) do
		local tex = self.corners[point]
		tex:SetTexture(ring(r))
		local q = QUARTER[point]
		tex:SetTexCoord(q[1], q[2], q[3], q[4])
		tex:ClearAllPoints()
		tex:SetPoint(point, f, point, 0, 0)
		tex:SetSize(r, r)
	end
	local top, bottom, left, right = self.edges[1], self.edges[2], self.edges[3], self.edges[4]
	top:ClearAllPoints()
	top:SetPoint("TOPLEFT", f, "TOPLEFT", r, 0)
	top:SetPoint("TOPRIGHT", f, "TOPRIGHT", -r, 0)
	top:SetHeight(1)
	bottom:ClearAllPoints()
	bottom:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", r, 0)
	bottom:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -r, 0)
	bottom:SetHeight(1)
	left:ClearAllPoints()
	left:SetPoint("TOPLEFT", f, "TOPLEFT", 0, -r)
	left:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", 0, r)
	left:SetWidth(1)
	right:ClearAllPoints()
	right:SetPoint("TOPRIGHT", f, "TOPRIGHT", 0, -r)
	right:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", 0, r)
	right:SetWidth(1)
end

Ring.SetColor = function(self, r, g, b, a)
	for _, tex in pairs(self.corners) do
		tex:SetVertexColor(r, g, b, a or 1)
	end
	for _, tex in ipairs(self.edges) do
		tex:SetVertexColor(r, g, b, a or 1)
	end
end

Ring.SetShown = function(self, on)
	for _, tex in pairs(self.corners) do
		tex:SetShown(on)
	end
	for _, tex in ipairs(self.edges) do
		tex:SetShown(on)
	end
end

local Surface = {}
Surface.__index = Surface

--- A filled rounded rectangle with a hairline edge: the fill sits inside the edge, so neither darkens the other.
function UI.Surface(f, radius, fill, border, layer, target)
	local s = setmetatable({}, Surface)
	s.fill = UI.Shape(f, math.max(0, radius - 1), fill, layer or "BACKGROUND", 0, 1, nil, target)
	s.ring = UI.Ring(f, radius, border, layer or "BACKGROUND", 1, target)
	f.surface = s
	return s
end

function Surface:SetFill(r, g, b, a)
	self.fill:SetColor(r, g, b, a)
end

function Surface:SetBorder(r, g, b, a)
	self.ring:SetColor(r, g, b, a)
end

function Surface:SetShown(on)
	self.fill:SetShown(on)
	self.ring:SetShown(on)
end

--- A rounded surface on any frame, with SetBackdropColor and SetBackdropBorderColor to recolour it.
function UI.Backdrop(f, bg, border, radius)
	local s = UI.Surface(f, radius or 8, bg or UI.colors.card, border or UI.colors.cardLine)
	f.SetBackdropColor = function(_, r, g, b, a)
		s:SetFill(r, g, b, a)
	end
	f.SetBackdropBorderColor = function(_, r, g, b, a)
		s:SetBorder(r, g, b, a)
	end
	return s
end

--- A panel: the site's card, a faint raised surface with a hairline edge.
function UI.Card(parent, radius)
	local c = CreateFrame("Frame", nil, parent)
	UI.Surface(c, radius or 12, UI.colors.card, UI.colors.cardLine)
	return c
end

function UI.Fill(f, color, layer)
	local t = f:CreateTexture(nil, layer or "BACKGROUND")
	t:SetColorTexture(unpack(color))
	t:SetAllPoints()
	return t
end

--- A hairline, horizontal unless vertical is set.
function UI.Rule(parent, vertical, color)
	local t = parent:CreateTexture(nil, "ARTWORK")
	t:SetTexture(WHITE)
	t:SetVertexColor(unpack(color or UI.colors.rule))
	if vertical then
		t:SetWidth(1)
	else
		t:SetHeight(1)
	end
	return t
end

--- One of the site's small marks (Check, Chevron, Close, Search), tinted.
function UI.Mark(parent, name, size, color, layer)
	local t = parent:CreateTexture(nil, layer or "ARTWORK")
	t:SetTexture(MEDIA .. name .. ".tga")
	t:SetSize(size, size)
	local c = color or ns.RGB.text
	t:SetVertexColor(c[1], c[2], c[3], c[4] or 1)
	return t
end

--- A game icon with rounded corners and a dark edge, or its quality's colour.
function UI.Icon(parent, size)
	local frame = CreateFrame("Frame", nil, parent)
	frame:SetSize(size, size)
	local edge = frame:CreateTexture(nil, "BACKGROUND")
	edge:SetTexture(MEDIA .. "IconShape.tga")
	edge:SetAllPoints()
	edge:SetVertexColor(0, 0, 0, 0.9)
	local t = frame:CreateTexture(nil, "ARTWORK")
	t:SetPoint("TOPLEFT", 1, -1)
	t:SetPoint("BOTTOMRIGHT", -1, 1)
	t:SetTexCoord(0.07, 0.93, 0.07, 0.93)
	if frame.CreateMaskTexture and t.AddMaskTexture then
		local mask = frame:CreateMaskTexture(nil, "ARTWORK")
		mask:SetTexture(MEDIA .. "IconMask.tga", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
		mask:SetAllPoints(t)
		t:AddMaskTexture(mask)
		frame.mask = mask
	end
	frame.texture, frame.edge = t, edge
	function frame:SetIcon(path, quality)
		self.texture:SetTexture(path)
		local h = quality and quality >= 2 and ns.QUALITY[quality]
		if h then
			local c = hex(h)
			self.edge:SetVertexColor(c[1], c[2], c[3], 0.95)
		else
			self.edge:SetVertexColor(0, 0, 0, 0.9)
		end
	end
	return frame
end

-- Buttons -------------------------------------------------------------------------------------------------------

local function paint(b)
	local C = UI.colors
	local s = b.surface
	local on = b:IsEnabled()
	local hot = b.hovered and on
	local t
	if b.kind == "primary" then
		local c = hot and C.giltBright or C.gilt
		s:SetFill(c[1], c[2], c[3], 1)
		s:SetBorder(1, 1, 1, 0.18)
		t = C.ink
	elseif b.selected then
		local c = b.color or C.gilt
		s:SetFill(c[1], c[2], c[3], hot and 0.22 or 0.15)
		s:SetBorder(c[1], c[2], c[3], 0.6)
		t = b.color or C.giltBright
	else
		s:SetFill(unpack(hot and C.buttonHover or C.button))
		s:SetBorder(unpack(C.buttonLine))
		t = b.color or (hot and ns.RGB.white or ns.RGB.text)
	end
	b.label:SetTextColor(t[1], t[2], t[3], 1)
	if b.chevron then
		b.chevron:SetVertexColor(t[1], t[2], t[3], 1)
	end
	b:SetAlpha(on and 1 or 0.45)
end

--- A pill button. onClick(self, mouseButton). kind: "primary" for the page's main action (gold), or nil.
--- Its tooltip: b.tip, a line, or b.tipTitle with b.tipLines (as UI.TextTooltip takes them).
function UI.Button(parent, label, width, height, onClick, kind)
	height = height or 26
	local b = CreateFrame("Button", nil, parent)
	b:SetSize(width or 120, height)
	UI.Surface(b, height / 2, nil, nil, "BACKGROUND")
	b.label = UI.Text(b, height >= 26 and 12 or 11.5, ns.RGB.text, { weight = "bold", justify = "CENTER" })
	b.label:SetPoint("LEFT", 12, 0.5)
	b.label:SetPoint("RIGHT", -12, 0.5)
	b.label:SetText(label or "")
	b.kind = kind
	b:RegisterForClicks("LeftButtonUp", "RightButtonUp")
	-- A button disabled under the cursor (Undo, once nothing is left to undo) still hears the cursor leave, so its
	-- hover colours and tooltip go away.
	if b.SetMotionScriptsWhileDisabled then
		b:SetMotionScriptsWhileDisabled(true)
	end
	b:SetScript("OnEnter", function(self)
		self.hovered = true
		paint(self)
		if self.tipTitle then
			UI.TextTooltip(self, self.tipTitle, self.tipLines)
		elseif self.tip then
			GameTooltip:SetOwner(self, "ANCHOR_TOP")
			GameTooltip:SetText(self.tip, 1, 1, 1, 1, true)
			GameTooltip:Show()
		end
	end)
	b:SetScript("OnLeave", function(self)
		self.hovered = false
		paint(self)
		if self.tip or self.tipTitle then
			GameTooltip:Hide()
		end
	end)
	b:SetScript("OnEnable", paint)
	b:SetScript("OnDisable", paint)
	b:SetScript("OnClick", function(self, button)
		if onClick then
			onClick(self, button)
		end
	end)
	function b:SetLabel(text)
		self.label:SetText(text or "")
	end
	--- Wide enough for the label, and min at least.
	function b:FitWidth(min)
		local extra = self.chevron and 14 or 0
		self:SetWidth(math.max(min or 0, math.ceil(UI.TextWidth(self.label) + 26 + extra)))
	end
	function b:SetKind(k)
		self.kind = k
		paint(self)
	end
	function b:SetSelected(on)
		self.selected = on and true or false
		paint(self)
	end
	--- A small chevron after the label, for a button that opens a menu.
	function b:AddChevron()
		self.chevron = UI.Mark(self, "Chevron", 10, ns.RGB.text, "OVERLAY")
		self.chevron:SetPoint("RIGHT", -11, 0)
		self.label:SetPoint("RIGHT", -24, 0.5)
		paint(self)
	end
	paint(b)
	return b
end

--- A toggle chip: SetSelected(on) fills it with gold (or with color, a class or quality colour, which also tints the
--- label).
function UI.Chip(parent, label, onClick, color)
	local b = UI.Button(parent, label, nil, 24, onClick)
	UI.SetFont(b.label, "medium", 11.5)
	b.color = color
	b:FitWidth(30)
	b:SetSelected(false)
	return b
end

--- Lays chips out left to right, wrapping at width. Returns the height used.
function UI.Flow(items, parent, x, y, width, gap)
	gap = gap or 6
	local cx, cy, rowH = 0, 0, 0
	for _, item in ipairs(items) do
		if item:IsShown() then
			local w, h = item:GetWidth(), item:GetHeight()
			if cx > 0 and cx + w > width then
				cx = 0
				cy = cy + rowH + gap
				rowH = 0
			end
			item:ClearAllPoints()
			item:SetPoint("TOPLEFT", parent, "TOPLEFT", x + cx, -(y + cy))
			cx = cx + w + gap
			rowH = math.max(rowH, h)
		end
	end
	return cy + rowH
end

--- Tabs in a track, the site's segmented control. entries: { { key, label }, ... }; onPick(key).
function UI.Tabs(parent, entries, onPick)
	local track = CreateFrame("Frame", nil, parent)
	track:SetHeight(32)
	UI.Surface(track, 16, { 0, 0, 0, 0.3 }, UI.colors.cardLine)
	track.tabs = {}
	local x = 3
	for _, e in ipairs(entries) do
		local b = CreateFrame("Button", nil, track)
		b:SetHeight(26)
		b.bg = UI.Shape(b, 13, { 1, 1, 1, 0.11 })
		b.label = UI.Text(b, 12, ns.RGB.text, { weight = "bold", justify = "CENTER" })
		b.label:SetPoint("CENTER", 0, 0.5)
		b.label:SetText(e[2])
		b:SetWidth(math.ceil(UI.TextWidth(b.label)) + 30)
		b:SetPoint("LEFT", track, "LEFT", x, 0)
		x = x + b:GetWidth() + 2
		b.key = e[1]
		b:SetScript("OnClick", function(self)
			onPick(self.key)
		end)
		b:SetScript("OnEnter", function(self)
			if not self.on then
				self.label:SetTextColor(unpack(ns.RGB.white))
			end
		end)
		b:SetScript("OnLeave", function(self)
			if not self.on then
				self.label:SetTextColor(unpack(ns.RGB.mist))
			end
		end)
		track.tabs[#track.tabs + 1] = b
	end
	track:SetWidth(x + 1)
	function track:Select(key)
		for _, b in ipairs(self.tabs) do
			b.on = b.key == key
			b.bg:SetShown(b.on)
			b.label:SetTextColor(unpack(b.on and ns.RGB.white or ns.RGB.mist))
		end
	end
	return track
end

-- Fields --------------------------------------------------------------------------------------------------------

--- Gives an edit box the site's field look: a dark rounded well with a hairline that turns gold while typing.
function UI.Field(e, radius)
	local s = UI.Surface(e, radius or 8, UI.colors.field, UI.colors.fieldLine)
	UI.SetFont(e, "regular", 12)
	e:SetTextColor(unpack(ns.RGB.white))
	e:SetAutoFocus(false)
	local function edge(self)
		local c = self:HasFocus() and UI.colors.focus or self.hovered and UI.colors.fieldHover or UI.colors.fieldLine
		s:SetBorder(unpack(c))
	end
	e:HookScript("OnEditFocusGained", edge)
	e:HookScript("OnEditFocusLost", edge)
	e:HookScript("OnEnter", function(self)
		self.hovered = true
		edge(self)
	end)
	e:HookScript("OnLeave", function(self)
		self.hovered = false
		edge(self)
	end)
	return s
end

--- A search box. onChange(text) on every keystroke.
function UI.Search(parent, width, placeholder, onChange)
	local e = CreateFrame("EditBox", nil, parent)
	e:SetSize(width, 28)
	UI.Field(e)
	e:SetTextInsets(30, 10, 0, 0)
	e:SetMaxLetters(60)
	e.icon = UI.Mark(e, "Search", 14, ns.RGB.fog)
	e.icon:SetPoint("LEFT", 10, 0)
	local hint = UI.Text(e, 12, ns.RGB.fog)
	hint:SetPoint("LEFT", 30, 0.5)
	hint:SetPoint("RIGHT", -10, 0.5)
	hint:SetText(placeholder or "Search")
	e.hint = hint
	e:SetScript("OnTextChanged", function(self)
		local text = self:GetText() or ""
		hint:SetShown(text == "")
		if onChange then
			onChange(text)
		end
	end)
	e:SetScript("OnEscapePressed", function(self)
		self:ClearFocus()
	end)
	e:SetScript("OnEnterPressed", function(self)
		self:ClearFocus()
	end)
	return e
end

-- Scrolling ---------------------------------------------------------------------------------------------------

local function ScrollBar(parent)
	local bar = CreateFrame("Slider", nil, parent)
	bar:SetWidth(10)
	bar:SetOrientation("VERTICAL")
	bar:SetMinMaxValues(0, 0)
	bar:SetValueStep(1)
	bar:SetObeyStepOnDrag(true)
	-- The game moves the thumb texture (set by path, the form every client takes); the pill drawn over it follows.
	bar:SetThumbTexture(WHITE)
	local thumb = bar:GetThumbTexture()
	thumb:SetVertexColor(1, 1, 1, 0)
	thumb:SetSize(10, 40)
	local pill = CreateFrame("Frame", nil, bar)
	pill:SetPoint("TOP", thumb, "TOP", 0, -1)
	pill:SetPoint("BOTTOM", thumb, "BOTTOM", 0, 1)
	pill:SetWidth(5)
	local shape = UI.Shape(pill, 2.5, { 1, 1, 1, 0.2 }, "ARTWORK")
	bar:SetScript("OnEnter", function()
		shape:SetColor(1, 1, 1, 0.34)
	end)
	bar:SetScript("OnLeave", function()
		shape:SetColor(1, 1, 1, 0.2)
	end)
	--- Sizes the thumb to the part of the content in view.
	function bar:SetProportion(visible, total)
		local h = self:GetHeight() or 0
		if h <= 0 or not total or total <= 0 then
			return
		end
		thumb:SetHeight(math.max(28, math.min(h, math.floor(h * math.min(1, visible / total)))))
	end
	bar:SetValue(0)
	return bar
end

--- A list that only builds the rows it shows. createRow(list) -> row; updateRow(row, item, index).
--- heightOf(item, list), optional, gives rows their own heights (section headers, two-line titles).
function UI.List(parent, rowHeight, createRow, updateRow, heightOf)
	local list = CreateFrame("Frame", nil, parent)
	list.rows, list.data, list.offset, list.visible = {}, {}, 0, 0
	list.rowHeight = rowHeight
	local bar = ScrollBar(list)
	bar:SetPoint("TOPRIGHT", 0, 0)
	bar:SetPoint("BOTTOMRIGHT", 0, 0)
	list.bar = bar
	bar:SetScript("OnValueChanged", function(_, value)
		value = math.floor(value + 0.5)
		if value ~= list.offset then
			list.offset = value
			list:Refresh()
		end
	end)
	list:EnableMouseWheel(true)
	list:SetScript("OnMouseWheel", function(_, delta)
		local target = math.max(0, math.min(list.maxOffset or 0, list.offset - delta * 3))
		bar:SetValue(target)
	end)
	local function height(i)
		if heightOf then
			return heightOf(list.data[i], list) or rowHeight
		end
		return rowHeight
	end
	function list:Refresh(reset)
		local total = #self.data
		local room = math.floor(self:GetHeight() or 0)
		-- The furthest it scrolls: the last rows just fill the list.
		local used, maxOffset = 0, 0
		for i = total, 1, -1 do
			used = used + height(i)
			if used > room then
				maxOffset = i
				break
			end
		end
		self.maxOffset = maxOffset
		if self.offset > maxOffset then
			self.offset = maxOffset
		end
		-- The thumb's size before the range: the slider places its thumb when the range or the value changes.
		if maxOffset > 0 then
			bar:SetProportion(total - maxOffset, total)
		end
		bar:SetMinMaxValues(0, maxOffset)
		if reset then
			bar:SetValue(0)
		end
		bar:SetShown(maxOffset > 0)
		local y, n, whole = 0, 0, 0
		local right = maxOffset > 0 and -16 or 0
		if room > 0 then
			for i = self.offset + 1, total do
				local h = height(i)
				-- A list that clips shows the row the room ends in, in part.
				if y >= room or y + h > room and not self.partial then
					break
				end
				n = n + 1
				whole = whole + (y + h <= room and 1 or 0)
				local row = self.rows[n]
				if not row then
					row = createRow(self)
					self.rows[n] = row
				end
				row:ClearAllPoints()
				-- Rows stop short of the scroll bar when there is one.
				row:SetPoint("TOPLEFT", self, "TOPLEFT", 0, -y)
				row:SetPoint("TOPRIGHT", self, "TOPRIGHT", right, -y)
				row:SetHeight(h)
				row:Show()
				updateRow(row, self.data[i], i)
				y = y + h
			end
		end
		for i = n + 1, #self.rows do
			self.rows[i]:Hide()
		end
		self.visible = whole
	end
	list.Layout = list.Refresh
	--- Shows the row the room ends in, cut at the list's edge, where the game can clip a frame's children.
	function list:SetPartial(on)
		self.partial = on and self.SetClipsChildren ~= nil or nil
		if self.SetClipsChildren then
			self:SetClipsChildren(on and true or false)
		end
	end
	function list:SetData(data, keepOffset)
		self.data = data or {}
		if not keepOffset then
			self.offset = 0
		end
		self:Refresh(not keepOffset)
	end
	function list:ScrollTo(index)
		local target = math.max(0, math.min(self.maxOffset or 0, index - 1))
		bar:SetValue(target)
		self.offset = target
		self:Refresh()
	end
	--- Scrolls just enough to show a row that is out of sight.
	function list:Reveal(index)
		if index and (index <= self.offset or index > self.offset + (self.visible or 0)) then
			self:ScrollTo(math.max(1, index - 2))
		end
	end
	list:SetScript("OnSizeChanged", function(self)
		self:Refresh()
	end)
	list:SetScript("OnShow", function(self)
		self:Refresh()
	end)
	return list
end

--- A list inside a card: the card fills frame-relative anchors set on it, the list sits inside with a little room.
--- Returns card, list.
function UI.CardList(parent, rowHeight, createRow, updateRow, heightOf)
	local card = UI.Card(parent)
	local list = UI.List(card, rowHeight, createRow, updateRow, heightOf)
	list:SetPoint("TOPLEFT", 6, -6)
	list:SetPoint("BOTTOMRIGHT", -6, 6)
	card.list = list
	return card, list
end

--- A section title row for lists: the name in bold over a hairline, with room for a count on the right.
function UI.HeaderRow(row)
	if not row.header then
		row.header = UI.Text(row, 12, ns.RGB.white, { weight = "bold" })
		row.header:SetPoint("BOTTOMLEFT", 10, 9)
		row.header:SetPoint("BOTTOMRIGHT", -10, 9)
		row.rule = UI.Rule(row)
		row.rule:SetPoint("BOTTOMLEFT", 10, 3)
		row.rule:SetPoint("BOTTOMRIGHT", -10, 3)
	end
	return row.header
end

--- A clickable list row with a rounded hover tint, and a selected tint with a gold mark at its left.
function UI.Row(parent)
	local row = CreateFrame("Button", nil, parent)
	row:RegisterForClicks("LeftButtonUp", "RightButtonUp")
	row.hover = UI.Shape(row, 8, UI.colors.hover, "BACKGROUND", 0)
	row.hover:Hide()
	row.sel = UI.Shape(row, 8, UI.colors.select, "BACKGROUND", 1)
	row.sel:Hide()
	local accent = CreateFrame("Frame", nil, row)
	accent:SetPoint("TOPLEFT", 3, -9)
	accent:SetPoint("BOTTOMLEFT", 3, 9)
	accent:SetWidth(3)
	accent.shape = UI.Shape(accent, 1.5, UI.colors.gilt, "ARTWORK")
	accent:Hide()
	row.accent = accent
	row:HookScript("OnEnter", function(self)
		self.hover:Show()
	end)
	row:HookScript("OnLeave", function(self)
		self.hover:Hide()
	end)
	function row:SetSelected(on)
		self.sel:SetShown(on and true or false)
		self.accent:SetShown(on and true or false)
	end
	return row
end

-- Check boxes ---------------------------------------------------------------------------------------------------

--- A rounded check box button. SetOn(on); hover lights the edge.
function UI.Check(parent, size)
	size = size or 18
	local b = CreateFrame("Button", nil, parent)
	b:SetSize(size, size)
	local s = UI.Surface(b, math.floor(size * 0.3 + 0.5), { 0, 0, 0, 0.3 }, { 1, 1, 1, 0.18 })
	b.mark = UI.Mark(b, "Check", math.floor(size * 0.78 + 0.5), UI.colors.giltBright, "ARTWORK")
	b.mark:SetPoint("CENTER", 0, 0)
	b.mark:Hide()
	function b:Paint()
		local C = UI.colors
		if self.on then
			s:SetFill(C.gilt[1], C.gilt[2], C.gilt[3], 0.2)
			s:SetBorder(unpack(self.hovered and C.giltBright or C.gilt))
		else
			s:SetFill(0, 0, 0, 0.3)
			s:SetBorder(1, 1, 1, self.hovered and 0.36 or 0.18)
		end
		self.mark:SetShown(self.on and true or false)
	end
	function b:SetOn(on)
		self.on = on and true or false
		self:Paint()
	end
	b:HookScript("OnEnter", function(self)
		self.hovered = true
		self:Paint()
	end)
	b:HookScript("OnLeave", function(self)
		self.hovered = false
		self:Paint()
	end)
	b:Paint()
	return b
end

--- A labelled check box bound to a setting: Bind(label, key, onChange).
function UI.Toggle(parent)
	local t = CreateFrame("Button", nil, parent)
	t:SetHeight(26)
	local box = UI.Check(t, 18)
	box:SetPoint("LEFT", 0, 0)
	box:EnableMouse(false)
	t.box = box
	t.label = UI.Text(t, 12, ns.RGB.text)
	t.label:SetPoint("LEFT", box, "RIGHT", 10, 0.5)
	t.label:SetPoint("RIGHT", t, "RIGHT", 0, 0.5)
	t:SetScript("OnEnter", function()
		box.hovered = true
		box:Paint()
		t.label:SetTextColor(unpack(ns.RGB.white))
	end)
	t:SetScript("OnLeave", function()
		box.hovered = false
		box:Paint()
		t.label:SetTextColor(unpack(ns.RGB.text))
	end)
	function t:Bind(label, key, onChange)
		self.key, self.onChange = key, onChange
		self.label:SetText(label)
		self:Update()
	end
	function t:Update()
		local on = ns.db and self.key and ns.db[self.key]
		if type(on) == "table" then
			on = not on.hide
		end
		box:SetOn(on)
	end
	t:SetScript("OnClick", function(self)
		if not (ns.db and self.key) then
			return
		end
		if type(ns.db[self.key]) == "table" then
			ns.db[self.key].hide = not ns.db[self.key].hide
		else
			ns.db[self.key] = not ns.db[self.key]
		end
		self:Update()
		if self.onChange then
			self.onChange()
		end
	end)
	return t
end

-- Documents: cards of headings, paragraphs, lists, buttons and toggles in one scrolling column --------------------

local BLOCK = {
	title = { size = 20, weight = "bold", color = "white", gap = 0, after = 6 },
	h = { size = 15, weight = "bold", color = "white", gap = 20, after = 8 },
	h3 = { size = 13, weight = "bold", color = "gold", gap = 14, after = 5 },
	p = { size = 12, color = "text", gap = 0, after = 10, spacing = 4 },
	note = { size = 11, color = "mist", gap = 0, after = 10, spacing = 3 },
	li = { size = 12, color = "text", gap = 0, after = 6, indent = 18, spacing = 3 },
	ol = { size = 12, color = "text", gap = 0, after = 6, indent = 22, spacing = 3 },
}
local CARD_PAD, CARD_TOP, CARD_BOTTOM, CARD_GAP = 18, 16, 16, 14

function UI.Document(parent)
	local doc = CreateFrame("Frame", nil, parent)
	local scroll = CreateFrame("ScrollFrame", nil, doc)
	scroll:SetPoint("TOPLEFT")
	scroll:SetPoint("BOTTOMRIGHT", -16, 0)
	local content = CreateFrame("Frame", nil, scroll)
	content:SetSize(10, 10)
	scroll:SetScrollChild(content)
	local bar = ScrollBar(doc)
	bar:SetPoint("TOPRIGHT")
	bar:SetPoint("BOTTOMRIGHT")
	bar:SetScript("OnValueChanged", function(_, value)
		scroll:SetVerticalScroll(value)
	end)
	doc:EnableMouseWheel(true)
	doc:SetScript("OnMouseWheel", function(_, delta)
		local _, max = bar:GetMinMaxValues()
		bar:SetValue(math.max(0, math.min(max, bar:GetValue() - delta * 48)))
	end)
	doc.scroll, doc.content, doc.bar = scroll, content, bar
	doc.pools = {}

	local function take(kind, make)
		local pool = doc.pools[kind]
		if not pool then
			pool = { items = {}, used = 0 }
			doc.pools[kind] = pool
		end
		pool.used = pool.used + 1
		local item = pool.items[pool.used]
		if not item then
			item = make()
			pool.items[pool.used] = item
		end
		item:Show()
		return item
	end

	local function text()
		return take("text", function()
			return UI.Text(content, 12, ns.RGB.text, { wrap = true })
		end)
	end

	function doc:Layout()
		local width = math.floor((scroll:GetWidth() or 0) - 2)
		if width < 40 or not self.blocks then
			return
		end
		for _, pool in pairs(self.pools) do
			for _, item in ipairs(pool.items) do
				item:Hide()
				if item.ClearAllPoints then
					item:ClearAllPoints()
				end
			end
			pool.used = 0
		end
		content:SetWidth(width)
		-- X and W: the column blocks go in, narrower inside a card.
		local X, W = 0, width
		local y, first, lastAfter, afterCard = 0, true, 0, false
		local open = {}
		for _, block in ipairs(self.blocks) do
			local kind = block[1]
			local style = BLOCK[kind]
			if kind == "card" then
				if not first then
					y = y + CARD_GAP
				end
				local card = take("card", function()
					return UI.Card(content)
				end)
				card:SetPoint("TOPLEFT", content, "TOPLEFT", X, -y)
				card:SetWidth(W)
				open[#open + 1] = { card = card, y = y, X = X, W = W }
				X, W = X + CARD_PAD, W - 2 * CARD_PAD
				y = y + CARD_TOP
				first, lastAfter, afterCard = true, 0, false
			elseif kind == "end" then
				local top = table.remove(open)
				if top then
					y = y - lastAfter + CARD_BOTTOM
					top.card:SetHeight(y - top.y)
					X, W = top.X, top.W
					first, lastAfter, afterCard = false, 0, true
				end
			else
				if style then
					if afterCard then
						y = y + CARD_GAP
					elseif not first then
						y = y + style.gap
					end
					local fs = text()
					if style.weight == "bold" and block.plain then
						UI.FitFont(fs, block[2], "bold", style.size)
					else
						UI.SetFont(fs, style.weight or "regular", style.size)
					end
					fs:SetSpacing(style.spacing or 2)
					local c = ns.RGB[style.color] or ns.RGB.text
					fs:SetTextColor(c[1], c[2], c[3], 1)
					local indent = style.indent or 0
					fs:SetWidth(W - indent)
					fs:SetText(block[2] or "")
					fs:SetPoint("TOPLEFT", content, "TOPLEFT", X + indent, -y)
					if kind == "li" then
						local dot = take("dot", function()
							local t = content:CreateTexture(nil, "ARTWORK")
							t:SetTexture(MEDIA .. "Disc16.tga")
							t:SetSize(5, 5)
							t:SetVertexColor(unpack(UI.colors.gilt))
							return t
						end)
						dot:SetPoint("TOPLEFT", content, "TOPLEFT", X + 5, -(y + style.size * 0.5 - 2.5))
					elseif kind == "ol" then
						local n = take("num", function()
							return UI.Text(content, 12, ns.RGB.gilt, { weight = "bold", justify = "RIGHT" })
						end)
						n:SetWidth(indent - 6)
						n:SetText((block[3] or 1) .. ".")
						n:SetPoint("TOPLEFT", content, "TOPLEFT", X, -y)
					end
					y = y + math.ceil(fs:GetStringHeight()) + style.after
					lastAfter = style.after
				elseif kind == "row" then
					-- A table row: the label in a narrow column, the value beside it, a hairline under both.
					if afterCard then
						y = y + CARD_GAP
					end
					local labelWidth = math.min(150, math.floor(W * 0.3))
					local label = text()
					UI.SetFont(label, "medium", 12)
					label:SetSpacing(3)
					label:SetTextColor(unpack(ns.RGB.white))
					label:SetWidth(labelWidth - 14)
					label:SetText(block[2] or "")
					label:SetPoint("TOPLEFT", content, "TOPLEFT", X, -(y + 8))
					local value = text()
					UI.SetFont(value, "regular", 12)
					value:SetSpacing(3)
					value:SetTextColor(unpack(ns.RGB.text))
					value:SetWidth(W - labelWidth)
					value:SetText(block[3] or "")
					value:SetPoint("TOPLEFT", content, "TOPLEFT", X + labelWidth, -(y + 8))
					y = y + 8 + math.ceil(math.max(label:GetStringHeight(), value:GetStringHeight())) + 9
					local rule = take("rule", function()
						return UI.Rule(content)
					end)
					rule:SetPoint("TOPLEFT", content, "TOPLEFT", X, -y)
					rule:SetWidth(W)
					y = y + 1
					lastAfter = 0
				elseif kind == "build" then
					local b, cls = ns.FindBuild(block[2])
					if b then
						y = y + (afterCard and CARD_GAP or 6)
						local card = take("build", function()
							local f = UI.Card(content, 10)
							f:SetHeight(54)
							f.title = UI.Text(f, 13, ns.RGB.white, { weight = "bold" })
							f.title:SetPoint("TOPLEFT", 14, -11)
							f.sub = UI.Text(f, 11, ns.RGB.mist)
							f.sub:SetPoint("TOPLEFT", 14, -31)
							f.button = UI.Button(f, "Open in Talents", 130, 26, nil, "primary")
							f.button:FitWidth(110)
							f.button:SetPoint("RIGHT", -12, 0)
							return f
						end)
						card:SetPoint("TOPLEFT", content, "TOPLEFT", X, -y)
						card:SetWidth(W)
						card.title:SetText(b.name)
						local pts = b.points or {}
						card.sub:SetText(ns.ClassText(cls) .. ns.Hex(ns.HEX.mist, "  ·  " .. table.concat(pts, " / ") .. " points"))
						card.button:SetScript("OnClick", function()
							ns.OpenBuild(b.id)
						end)
						y = y + 54 + 10
						lastAfter = 10
					end
				elseif kind == "plan" then
					-- A Legacy perk plan from a guide: what it is, and a button that makes it this character's plan.
					y = y + (afterCard and CARD_GAP or 6)
					local card = take("plan", function()
						local f = UI.Card(content, 10)
						f.title = UI.Text(f, 13, ns.RGB.white, { weight = "bold" })
						f.title:SetPoint("TOPLEFT", 14, -11)
						f.sub = UI.Text(f, 11, ns.RGB.mist, { wrap = true })
						f.sub:SetPoint("TOPLEFT", 14, -31)
						f.button = UI.Button(f, "Use this plan", 120, 26, nil, "primary")
						f.button:FitWidth(100)
						f.button:SetPoint("TOPRIGHT", -12, -12)
						return f
					end)
					card:SetPoint("TOPLEFT", content, "TOPLEFT", X, -y)
					card:SetWidth(W)
					card.title:SetText(block[3] or "")
					card.sub:SetWidth(W - 28 - card.button:GetWidth() - 16)
					card.sub:SetText(block[4] or "")
					local h = math.max(54, 31 + math.ceil(card.sub:GetStringHeight()) + 12)
					card:SetHeight(h)
					local code = block[2]
					card.button:SetScript("OnClick", function()
						if ns.Legacy then
							ns.Legacy.SetPlan(ns.Legacy.Decode(code))
							ns.char.legacyView = "perks"
							ns.Open("legacy")
						end
					end)
					y = y + h + 10
					lastAfter = 10
				elseif kind == "buttons" then
					y = y + (afterCard and CARD_GAP or 4)
					local x = 0
					for _, spec in ipairs(block[2]) do
						local btn = take("button", function()
							return UI.Button(content, "", 120, 28)
						end)
						btn:SetHeight(28)
						btn:SetLabel(spec[1])
						btn:SetKind(spec[3] and "primary" or nil)
						btn:FitWidth(90)
						btn:SetPoint("TOPLEFT", content, "TOPLEFT", X + x, -y)
						btn:SetScript("OnClick", spec[2])
						x = x + btn:GetWidth() + 8
					end
					y = y + 28 + 12
					lastAfter = 12
				elseif kind == "toggle" then
					if afterCard then
						y = y + CARD_GAP
					end
					local t = take("toggle", function()
						return UI.Toggle(content)
					end)
					t:SetPoint("TOPLEFT", content, "TOPLEFT", X, -y)
					t:SetWidth(W)
					t:Bind(block[2], block[3], block[4])
					y = y + t:GetHeight() + 6
					lastAfter = 6
				elseif kind == "choice" then
					-- { "choice", label, setting key, { { value, label }, ... }, onChange }: one of a few, in a row of pills.
					if afterCard then
						y = y + CARD_GAP
					end
					local key = block[3]
					local c = take("choice:" .. key, function()
						local f = CreateFrame("Frame", nil, content)
						f:SetHeight(32)
						f.label = UI.Text(f, 12, ns.RGB.text)
						f.label:SetPoint("LEFT", 0, 0.5)
						f.tabs = UI.Tabs(f, block[4], function(value)
							ns.db[key] = value
							f.tabs:Select(value)
							if f.onChange then
								f.onChange(value)
							end
						end)
						return f
					end)
					c:SetPoint("TOPLEFT", content, "TOPLEFT", X, -y)
					c:SetWidth(W)
					c.label:SetText(block[2])
					c.onChange = block[5]
					c.tabs:ClearAllPoints()
					c.tabs:SetPoint("LEFT", c, "LEFT", math.ceil(UI.TextWidth(c.label)) + 14, 0)
					c.tabs:Select(ns.db and ns.db[key])
					y = y + 32 + 8
					lastAfter = 8
				elseif kind == "copy" then
					if afterCard then
						y = y + CARD_GAP
					end
					local e = take("copy", function()
						local box = CreateFrame("EditBox", nil, content)
						box:SetHeight(28)
						UI.Field(box)
						box:SetTextInsets(10, 10, 0, 0)
						box:SetMaxLetters(255)
						box:SetScript("OnTextChanged", function(self, user)
							if user then
								self:SetText(self.value or "")
								self:HighlightText()
							end
						end)
						box:HookScript("OnEditFocusGained", function(self)
							self:HighlightText()
						end)
						box:SetScript("OnEscapePressed", function(self)
							self:ClearFocus()
						end)
						box:SetScript("OnEnterPressed", function(self)
							self:ClearFocus()
						end)
						return box
					end)
					e:SetPoint("TOPLEFT", content, "TOPLEFT", X, -y)
					e:SetWidth(math.min(W, 420))
					e.value = block[2]
					e:SetText(block[2])
					e:SetCursorPosition(0)
					y = y + 28 + 10
					lastAfter = 10
				elseif kind == "icon" then
					if afterCard then
						y = y + CARD_GAP
					end
					local r = take("icon", function()
						local f = CreateFrame("Frame", nil, content)
						f.icon = UI.Icon(f, 32)
						f.icon:SetPoint("TOPLEFT")
						f.text = UI.Text(f, 12, ns.RGB.text, { wrap = true, spacing = 3 })
						f.text:SetPoint("TOPLEFT", 44, -1)
						return f
					end)
					r:SetPoint("TOPLEFT", content, "TOPLEFT", X, -y)
					r:SetWidth(W)
					r.icon:SetIcon(block[2])
					r.text:SetWidth(W - 44)
					r.text:SetText(block[3] or "")
					local h = math.max(32, math.ceil(r.text:GetStringHeight()) + 1)
					r:SetHeight(h)
					y = y + h + 12
					lastAfter = 12
				elseif kind == "space" then
					y = y + (block[2] or 10)
				end
				first, afterCard = false, false
			end
		end
		-- A card left open closes at the end.
		while #open > 0 do
			local top = table.remove(open)
			y = y - lastAfter + CARD_BOTTOM
			top.card:SetHeight(y - top.y)
			lastAfter = 0
		end
		content:SetHeight(math.max(1, y))
		local view = scroll:GetHeight() or 0
		local max = math.max(0, y - view)
		-- The thumb's size before the range, as in UI.List.
		if max > 0 then
			bar:SetProportion(view, y)
		end
		bar:SetMinMaxValues(0, max)
		bar:SetShown(max > 0)
		if bar:GetValue() > max then
			bar:SetValue(max)
		end
		scroll:SetVerticalScroll(math.min(bar:GetValue(), max))
	end

	function doc:SetBlocks(blocks, keepScroll)
		self.blocks = blocks
		if not keepScroll then
			bar:SetValue(0)
			scroll:SetVerticalScroll(0)
		end
		self:Layout()
	end

	doc:SetScript("OnSizeChanged", function(self)
		self:Layout()
	end)
	doc:SetScript("OnShow", function(self)
		self:Layout()
	end)
	return doc
end

-- Pop-up menus --------------------------------------------------------------------------------------------------

local menu
--- A small pop-up under owner listing entries { label, value }; onPick(value). An entry with header = true is a
--- section title, not a choice; current marks the entry whose value is picked now. Long lists wrap into columns,
--- filled top to bottom.
function UI.Menu(owner, entries, onPick, columns, current)
	if not menu then
		menu = CreateFrame("Frame", "GrimoireForeverMenu", UIParent)
		UI.Surface(menu, 12, UI.colors.menu, UI.colors.line)
		menu:SetFrameStrata("FULLSCREEN_DIALOG")
		menu:SetClampedToScreen(true)
		menu:EnableMouse(true)
		menu.buttons = {}
		menu:Hide()
		table.insert(UISpecialFrames, "GrimoireForeverMenu")
	end
	if menu:IsShown() and menu.owner == owner then
		menu:Hide()
		return
	end
	columns = columns or 1
	local h = 26
	local perColumn = math.ceil(#entries / columns)
	local w = 130
	for i, entry in ipairs(entries) do
		local b = menu.buttons[i]
		if not b then
			b = CreateFrame("Button", nil, menu)
			b.hover = UI.Shape(b, 7, UI.colors.select)
			b.hover:Hide()
			b:SetScript("OnEnter", function(self)
				if not self.isHeader then
					self.hover:Show()
				end
			end)
			b:SetScript("OnLeave", function(self)
				self.hover:Hide()
			end)
			b.text = UI.Text(b, 12, ns.RGB.text)
			b.text:SetPoint("LEFT", 10, 0.5)
			b.check = UI.Mark(b, "Check", 13, UI.colors.giltBright)
			b.check:SetPoint("RIGHT", -8, 0)
			menu.buttons[i] = b
		end
		local picked = not entry.header and current ~= nil and entry[2] == current
		b.isHeader = entry.header
		UI.SetFont(b.text, entry.header and "bold" or (picked and "medium" or "regular"), entry.header and 11 or 12)
		b.text:SetTextColor(unpack(entry.header and ns.RGB.fog or picked and ns.RGB.gold or ns.RGB.text))
		b.text:SetText(entry[1])
		b.check:SetShown(picked)
		w = math.max(w, math.ceil(UI.TextWidth(b.text)) + 42)
	end
	for i, entry in ipairs(entries) do
		local b = menu.buttons[i]
		local col = math.floor((i - 1) / perColumn)
		local line = (i - 1) % perColumn
		b:ClearAllPoints()
		b:SetSize(w, h)
		b:SetPoint("TOPLEFT", menu, "TOPLEFT", 6 + col * w, -6 - line * h)
		b.hover:Hide()
		b:EnableMouse(not entry.header)
		b:SetScript("OnClick", function()
			menu:Hide()
			onPick(entry[2])
		end)
		b:Show()
	end
	for i = #entries + 1, #menu.buttons do
		menu.buttons[i]:Hide()
	end
	menu:SetSize(12 + columns * w, 12 + perColumn * h)
	menu.owner = owner
	menu:ClearAllPoints()
	menu:SetPoint("TOPLEFT", owner, "BOTTOMLEFT", 0, -4)
	menu:Show()
end

function UI.CloseMenu()
	if menu then
		menu:Hide()
	end
end

-- Tooltips and item clicks --------------------------------------------------------------------------------------

--- Grimoire's own tooltip for an item, from its data: shown while the game loads the item, and kept for one the game
--- does not know.
local function ownItemTooltip(owner, id)
	local name, quality, _, gear = ns.ItemInfo(id)
	local hex = ns.QUALITY[quality or 1] or "ffffff"
	local r, g, b = tonumber(hex:sub(1, 2), 16) / 255, tonumber(hex:sub(3, 4), 16) / 255, tonumber(hex:sub(5, 6), 16) / 255
	GameTooltip:SetOwner(owner, "ANCHOR_RIGHT")
	GameTooltip:SetText(name or ("Item " .. id), r, g, b, 1, true)
	if gear then
		-- { name, quality, item level, required level, slot, type, icon, availability, usable by, source, ... }
		if gear[6] and gear[6] ~= "" then
			GameTooltip:AddLine(gear[6], 1, 1, 1)
		end
		if gear[3] and gear[3] > 0 then
			GameTooltip:AddLine("Item Level " .. gear[3], 1, 0.82, 0)
		end
		if gear[4] and gear[4] > 0 then
			GameTooltip:AddLine("Requires Level " .. gear[4], 1, 1, 1)
		end
		local source = ns.Gear and ns.Gear.Source(gear) or gear[10]
		if source and source ~= "" then
			GameTooltip:AddLine(source, 0.62, 0.62, 0.62, true)
		end
	else
		local m = ns.minor and ns.minor[id]
		if m and m[4] and m[4] ~= "" then
			GameTooltip:AddLine(m[4], 0.62, 0.62, 0.62, true)
		end
	end
	GameTooltip:Show()
end

-- The item whose game tooltip is still loading, and over what: the game's replaces Grimoire's once it arrives.
local waiting
function UI.ItemTooltip(owner, id)
	local cached = C_Item and C_Item.IsItemDataCachedByID and C_Item.IsItemDataCachedByID(id)
	if cached == false then
		-- The game would show "Retrieving item information" until it has the item, and may not redraw it after: show
		-- Grimoire's at once and ask for the item.
		ownItemTooltip(owner, id)
		waiting = { owner = owner, id = id }
		if C_Item.RequestLoadItemDataByID then
			C_Item.RequestLoadItemDataByID(id)
		end
		return
	end
	waiting = nil
	GameTooltip:SetOwner(owner, "ANCHOR_RIGHT")
	GameTooltip:SetHyperlink("item:" .. id)
	GameTooltip:Show()
end

local function itemArrived(itemID, success)
	local w = waiting
	if not w or itemID ~= w.id then
		return
	end
	waiting = nil
	-- Still over the same row: the game's own tooltip now. An item the game does not have keeps Grimoire's.
	if success and GameTooltip:IsOwned(w.owner) and w.owner:IsMouseOver() then
		GameTooltip:SetOwner(w.owner, "ANCHOR_RIGHT")
		GameTooltip:SetHyperlink("item:" .. w.id)
		GameTooltip:Show()
	end
end
ns.On("ITEM_DATA_LOAD_RESULT", itemArrived)
ns.On("GET_ITEM_INFO_RECEIVED", itemArrived)

function UI.SpellTooltip(owner, id, title, lines)
	GameTooltip:SetOwner(owner, "ANCHOR_RIGHT")
	local ok = id and pcall(GameTooltip.SetSpellByID, GameTooltip, id)
	if not ok or GameTooltip:NumLines() == 0 then
		GameTooltip:SetText(title or "", 1, 1, 1)
		for _, line in ipairs(lines or {}) do
			GameTooltip:AddLine(line, 1, 0.82, 0, true)
		end
	end
	GameTooltip:Show()
end

function UI.TextTooltip(owner, title, lines, anchor)
	GameTooltip:SetOwner(owner, anchor or "ANCHOR_RIGHT")
	GameTooltip:SetText(title or "", 1, 1, 1, 1, true)
	for _, line in ipairs(lines or {}) do
		if type(line) == "table" then
			GameTooltip:AddLine(line[1], line[2] or 1, line[3] or 0.82, line[4] or 0, true)
		else
			GameTooltip:AddLine(line, 1, 0.82, 0, true)
		end
	end
	GameTooltip:Show()
end

--- An item's chat link, from the game itself (a link Grimoire wrote could be refused by chat). Nil until the game
--- has the item; asking starts loading it.
function ns.ItemLink(id)
	if C_Item and C_Item.GetItemInfo then
		local _, link = C_Item.GetItemInfo(id)
		if link then
			return link
		end
		if C_Item.RequestLoadItemDataByID then
			C_Item.RequestLoadItemDataByID(id)
		end
	end
	return nil
end

local function modifiedClick(link)
	if HandleModifiedItemClick and IsModifiedClick and (IsModifiedClick("CHATLINK") or IsModifiedClick("DRESSUP")) then
		return HandleModifiedItemClick(link) and true or false
	end
	if IsShiftKeyDown and IsShiftKeyDown() and ChatEdit_InsertLink then
		ChatEdit_InsertLink(link)
		return true
	end
	return false
end

--- Shift-click links an item in chat, ctrl-click tries it on. Returns true when a modifier was used. An item the game
--- has not loaded yet is asked for and the click is done a moment later.
function UI.ItemClick(id)
	local link = ns.ItemLink(id)
	if link then
		return modifiedClick(link)
	end
	local wanted = IsModifiedClick and (IsModifiedClick("CHATLINK") or IsModifiedClick("DRESSUP"))
	if not wanted or not C_Timer then
		return false
	end
	local chat = IsModifiedClick("CHATLINK")
	C_Timer.After(0.4, function()
		local later = ns.ItemLink(id)
		if not later then
			return
		end
		if chat and ChatEdit_InsertLink then
			ChatEdit_InsertLink(later)
		elseif DressUpItemLink then
			DressUpItemLink(later)
		end
	end)
	return true
end
