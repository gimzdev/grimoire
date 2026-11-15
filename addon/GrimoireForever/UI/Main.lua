-- The Grimoire window, laid out like the site: the name and the page list on the left, the open page on the right under
-- its title and a line about it.
local _, ns = ...
local UI = ns.UI

local WIDTH, HEIGHT, SIDE, HEAD = 980, 680, 204, 80
local tabs, tabByKey = {}, {}
local window, current

--- Registers a page: { key, label, icon, order, title, lede, build(frame), show(frame) }. title and lede, for the
--- header over the page, are text or functions of the page's frame; title defaults to the label.
function ns.AddTab(def)
	tabs[#tabs + 1] = def
	tabByKey[def.key] = def
end

function ns.HasTab(key)
	return tabByKey[key] ~= nil
end

local function savePosition(f)
	local point, _, relPoint, x, y = f:GetPoint()
	ns.db.window = { point = point, relPoint = relPoint, x = math.floor(x + 0.5), y = math.floor(y + 0.5) }
end

local function resolve(value, frame)
	if type(value) == "function" then
		return value(frame)
	end
	return value
end

local function navButton(parent, def)
	local b = CreateFrame("Button", nil, parent)
	b:SetSize(SIDE - 24, 32)
	b.hover = UI.Shape(b, 9, UI.colors.hover)
	b.hover:Hide()
	b.sel = UI.Shape(b, 9, UI.colors.select, "BACKGROUND", 1)
	b.sel:Hide()
	b.icon = UI.Icon(b, 20)
	b.icon:SetPoint("LEFT", 8, 0)
	b.icon:SetIcon(ns.Icon(def.icon))
	b.text = UI.Text(b, 13, ns.RGB.text, { weight = "medium" })
	b.text:SetPoint("LEFT", b.icon, "RIGHT", 10, 0.5)
	b.text:SetText(def.label)
	b:SetScript("OnEnter", function(self)
		if not self.on then
			self.hover:Show()
			self.text:SetTextColor(unpack(ns.RGB.white))
		end
	end)
	b:SetScript("OnLeave", function(self)
		self.hover:Hide()
		if not self.on then
			self.text:SetTextColor(unpack(ns.RGB.text))
		end
	end)
	b:SetScript("OnClick", function()
		ns.Open(def.key)
	end)
	function b:SetSelected(on)
		self.on = on
		self.sel:SetShown(on)
		if on then
			self.hover:Hide()
		end
		UI.SetFont(self.text, on and "bold" or "medium", 13)
		self.text:SetTextColor(unpack(on and ns.RGB.white or ns.RGB.text))
	end
	b.def = def
	return b
end

--- The soft shadow under the window: the edges of Media/Shadow.tga, 16 units out and a little low.
local function shadow(f)
	local OUT, CORNER, DROP = 16, 24, 5
	local a, b = CORNER / 64, 1 - CORNER / 64
	local function part(l, r, t, bt)
		local tex = f:CreateTexture(nil, "BACKGROUND", nil, -8)
		tex:SetTexture(UI.MEDIA .. "Shadow.tga")
		tex:SetTexCoord(l, r, t, bt)
		tex:SetVertexColor(0, 0, 0, 0.75)
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

--- A gold hairline along the window's top edge, fading out at both ends: the site's mark for the panel that matters.
local function gilt(f)
	if not CreateColor then
		return
	end
	local g = UI.colors.gilt
	local half = (WIDTH - 140) / 2
	local left = f:CreateTexture(nil, "BORDER", nil, 2)
	left:SetTexture(UI.WHITE)
	left:SetPoint("TOPLEFT", f, "TOPLEFT", 70, 0)
	left:SetSize(half, 1)
	left:SetGradient("HORIZONTAL", CreateColor(g[1], g[2], g[3], 0), CreateColor(g[1], g[2], g[3], 0.6))
	local right = f:CreateTexture(nil, "BORDER", nil, 2)
	right:SetTexture(UI.WHITE)
	right:SetPoint("TOPLEFT", left, "TOPRIGHT")
	right:SetSize(half, 1)
	right:SetGradient("HORIZONTAL", CreateColor(g[1], g[2], g[3], 0.6), CreateColor(g[1], g[2], g[3], 0))
end

--- On a screen too small for the window (a big UI scale), the window shrinks to fit, a little margin kept.
local function fit(f)
	local w, h = UIParent:GetWidth(), UIParent:GetHeight()
	if not (w and h) or w <= 0 or h <= 0 then
		return
	end
	f:SetScale(math.min(1, (w - 24) / WIDTH, (h - 24) / HEIGHT))
end

local function create()
	local f = CreateFrame("Frame", "GrimoireForeverFrame", UIParent)
	f:SetSize(WIDTH, HEIGHT)
	fit(f)
	f:RegisterEvent("UI_SCALE_CHANGED")
	f:RegisterEvent("DISPLAY_SIZE_CHANGED")
	f:SetScript("OnEvent", fit)
	f:SetFrameStrata("HIGH")
	f:SetToplevel(true)
	f:EnableMouse(true)
	f:SetMovable(true)
	f:SetClampedToScreen(true)
	local pos = ns.db.window
	if pos and pos.point then
		f:SetPoint(pos.point, UIParent, pos.relPoint or pos.point, pos.x or 0, pos.y or 0)
	else
		f:SetPoint("CENTER", UIParent, "CENTER", 0, 20)
	end
	f:Hide()
	table.insert(UISpecialFrames, "GrimoireForeverFrame")
	-- Drag it by any empty part.
	f:RegisterForDrag("LeftButton")
	f:SetScript("OnDragStart", function(self)
		self:StartMoving()
	end)
	f:SetScript("OnDragStop", function(self)
		self:StopMovingOrSizing()
		savePosition(self)
	end)

	-- The two halves, each its own fill so nothing overlaps; the window's edge around both.
	local side = CreateFrame("Frame", nil, f)
	side:SetPoint("TOPLEFT")
	side:SetPoint("BOTTOMLEFT")
	side:SetWidth(SIDE)
	local page = CreateFrame("Frame", nil, f)
	page:SetPoint("TOPLEFT", SIDE, 0)
	page:SetPoint("BOTTOMRIGHT")
	shadow(f)
	UI.Shape(f, 13, UI.colors.side, "BACKGROUND", -6, { 1, 1, 0, 1 }, { TOPRIGHT = true, BOTTOMRIGHT = true }, side)
	UI.Shape(f, 13, UI.colors.window, "BACKGROUND", -6, { 0, 1, 1, 1 }, { TOPLEFT = true, BOTTOMLEFT = true }, page)
	local divider = UI.Rule(f, true, UI.colors.cardLine)
	divider:SetPoint("TOPLEFT", page, "TOPLEFT", 0, -1)
	divider:SetPoint("BOTTOMLEFT", page, "BOTTOMLEFT", 0, 1)
	UI.Ring(f, 14, UI.colors.line, "BORDER", 0)
	gilt(f)

	-- The name
	local mark = f:CreateTexture(nil, "ARTWORK")
	mark:SetTexture(UI.MEDIA .. "Emblem.tga")
	mark:SetSize(30, 30)
	mark:SetPoint("TOPLEFT", side, "TOPLEFT", 18, -19)
	local name = UI.Text(f, 23, ns.RGB.white, { weight = "mark" })
	name:SetPoint("LEFT", mark, "RIGHT", 9, 0)
	name:SetText("Grimoire")

	-- The page list
	table.sort(tabs, function(a, b)
		return (a.order or 50) < (b.order or 50)
	end)
	f.nav = {}
	local y = 70
	for _, def in ipairs(tabs) do
		local b = navButton(f, def)
		if def.bottom then
			b:SetPoint("BOTTOMLEFT", side, "BOTTOMLEFT", 12, 42)
		else
			b:SetPoint("TOPLEFT", side, "TOPLEFT", 12, -y)
			y = y + 34
		end
		f.nav[def.key] = b
	end
	local m = ns.meta or {}
	local data = UI.Text(f, 10, ns.RGB.fog)
	data:SetPoint("BOTTOMLEFT", side, "BOTTOMLEFT", 20, 18)
	data:SetText("Grimoire " .. ns.version .. "  ·  data " .. (m.build or "?"))

	-- The page's header
	f.title = UI.Text(f, 19, ns.RGB.white, { weight = "bold" })
	f.title:SetPoint("TOPLEFT", page, "TOPLEFT", 26, -23)
	f.title:SetPoint("TOPRIGHT", page, "TOPRIGHT", -64, -23)
	f.lede = UI.Text(f, 12, ns.RGB.mist)
	f.lede:SetPoint("TOPLEFT", page, "TOPLEFT", 26, -50)
	f.lede:SetPoint("TOPRIGHT", page, "TOPRIGHT", -64, -50)
	local close = CreateFrame("Button", nil, f)
	close:SetSize(28, 28)
	close:SetPoint("TOPRIGHT", f, "TOPRIGHT", -16, -16)
	local cs = UI.Surface(close, 14, UI.colors.button, UI.colors.buttonLine)
	close.x = UI.Mark(close, "Close", 12, ns.RGB.mist)
	close.x:SetPoint("CENTER")
	close:SetScript("OnEnter", function(self)
		cs:SetFill(unpack(UI.colors.buttonHover))
		self.x:SetVertexColor(unpack(ns.RGB.white))
	end)
	close:SetScript("OnLeave", function(self)
		cs:SetFill(unpack(UI.colors.button))
		self.x:SetVertexColor(unpack(ns.RGB.mist))
	end)
	close:SetScript("OnClick", function()
		f:Hide()
	end)

	-- Pages
	local body = CreateFrame("Frame", nil, f)
	body:SetPoint("TOPLEFT", page, "TOPLEFT", 26, -HEAD)
	body:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -22, 20)
	f.body = body
	for _, def in ipairs(tabs) do
		local frame = CreateFrame("Frame", nil, body)
		frame:SetAllPoints()
		frame:Hide()
		def.frame = frame
	end
	f:SetScript("OnShow", function(self)
		fit(self)
		if PlaySound and SOUNDKIT and SOUNDKIT.IG_CHARACTER_INFO_OPEN then
			PlaySound(SOUNDKIT.IG_CHARACTER_INFO_OPEN)
		end
	end)
	f:SetScript("OnHide", function()
		UI.CloseMenu()
		if PlaySound and SOUNDKIT and SOUNDKIT.IG_CHARACTER_INFO_CLOSE then
			PlaySound(SOUNDKIT.IG_CHARACTER_INFO_CLOSE)
		end
	end)
	return f
end

--- Writes the open page's title and line again (a page whose line depends on what changed calls it).
function ns.RefreshHeader()
	if not (window and current) then
		return
	end
	local title = resolve(current.title, current.frame) or current.label
	UI.FitFont(window.title, title, "bold", 19)
	window.title:SetText(title)
	window.lede:SetText(resolve(current.lede, current.frame) or "")
end

function ns.Open(key)
	if not ns.db then
		return
	end
	window = window or create()
	key = (key and tabByKey[key]) and key or ns.char.tab or "home"
	if not tabByKey[key] then
		key = "home"
	end
	ns.UpdatePlayer()
	for k, b in pairs(window.nav) do
		b:SetSelected(k == key)
	end
	for _, def in ipairs(tabs) do
		if def.key ~= key then
			def.frame:Hide()
		end
	end
	local def = tabByKey[key]
	if not def.built then
		def.built = true
		def.build(def.frame)
	end
	current = def
	ns.char.tab = key
	window:Show()
	def.frame:Show()
	if def.show then
		def.show(def.frame)
	end
	ns.RefreshHeader()
end

function ns.Toggle()
	if window and window:IsShown() then
		window:Hide()
	else
		ns.Open()
	end
end

function ns.IsOpen(key)
	return window and window:IsShown() and current and current.key == key
end

--- Opens the talent page on a build.
function ns.OpenBuild(id)
	ns.pendingBuild = id
	ns.Open("talents")
end

-- Refresh the open page when the game changes under it.
local function refresh()
	if window and window:IsShown() and current and current.show then
		ns.UpdatePlayer()
		current.show(current.frame)
		ns.RefreshHeader()
	end
end
ns.Listen("LEVEL", refresh)
ns.Listen("GUIDE", function()
	if current and current.key == "home" then
		refresh()
	end
end)
ns.Listen("TALENTS", refresh)
ns.Listen("BUILD", refresh)
ns.On("SPELLS_CHANGED", function()
	if current and (current.key == "abilities" or current.key == "home") then
		refresh()
	end
end)
ns.On("GROUP_ROSTER_UPDATE", function()
	if current and current.key == "raid" then
		refresh()
	end
end)
