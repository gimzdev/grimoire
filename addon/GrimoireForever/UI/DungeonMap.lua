-- The map of a dungeon or raid, for the Dungeons page: Grimoire's drawing of each floor (Media/Maps, drawn by
-- scripts/addon/maps.mjs from Data/Maps.lua's views), the bosses as round portraits where they stand and the entrance.
-- Pills over it pick a wing when the dungeon has several, and pills in its corner a floor when a wing has floors over
-- one another; the other floors stay faintly under the one picked. What a boss's tooltip says and what a click does are
-- the page's (UI/Dungeons.lua): the map draws, and tells it what is under the cursor.
local _, ns = ...
local UI = ns.UI

local Layout = {}
ns.MapLayout = Layout

-- The biggest a map is drawn, in UI units: scripts/addon/maps.mjs draws its textures for this size (MAX_W, MAX_H).
local MAX_W, MAX_H = 386, 250
local PAD = 10 -- the well's room around the drawing
local EDGE = 4 -- how far a mark may reach past the drawing into that room (short of the floor pills over it)
local CHIP_H, CHIP_GAP = 24, 8 -- the wing pills over the well, and the space under them
local FLOOR_H, FLOOR_GAP = 20, 6 -- the floor pills in the well's corner, and the space under them
local BOSS_MIN, BOSS_MAX = 18, 28 -- a boss's portrait, smaller on a crowded map
local POOLED = 0.7 -- one of the places a pooled boss may appear: smaller, and dimmer
local DOOR = 18 -- the entrance's mark
local FAINT = 0.3 -- another floor's drawing under the one picked
local GHOST = 0.4 -- a boss or the entrance on another floor
Layout.MAX_W, Layout.MAX_H, Layout.PAD = MAX_W, MAX_H, PAD

-- Layout: plain arithmetic, also run outside the game ---------------------------------------------------------------

--- A view's drawing in a box of w by h: as big as fits with its shape kept (aspect is width over height). Returns its
--- width and height.
function Layout.Fit(aspect, w, h)
	if not aspect or aspect <= 0 or w <= 0 or h <= 0 then
		return 0, 0
	end
	local cw, ch = w, w / aspect
	if ch > h then
		cw, ch = h * aspect, h
	end
	return cw, ch
end

--- The size of a boss's portrait on a drawing of w by h with n bosses: smaller as the map gets crowded.
function Layout.BossSize(w, h, n)
	if n <= 0 then
		return BOSS_MAX
	end
	local room = math.sqrt(w * h / n) * 0.36
	return math.floor(math.max(BOSS_MIN, math.min(BOSS_MAX, room)) + 0.5)
end

--- Moves marks apart where they would cover one another, a little at a time, so each can be seen and pointed at, and
--- keeps them within margin of a drawing of w by h. points: { { x, y, r } } in units from the drawing's top left,
--- changed in place. Marks in the same place open out in a fan.
function Layout.Spread(points, w, h, margin)
	margin = margin or 0
	local n = #points
	for _ = 1, 32 do
		local moved = false
		for i = 1, n do
			local a = points[i]
			for j = i + 1, n do
				local b = points[j]
				local dx, dy = b.x - a.x, b.y - a.y
				-- a hair of overlap is fine: the rings still part them
				local need = (a.r + b.r) * 0.94
				local d2 = dx * dx + dy * dy
				if d2 < need * need then
					local d = math.sqrt(d2)
					if d < 0.01 then
						-- the same place: apart at a turn of the golden angle each
						local t = j * 2.39996
						dx, dy, d = math.cos(t), math.sin(t), 1
					end
					local push = (need - d) / 2
					local ux, uy = dx / d, dy / d
					a.x, a.y = a.x - ux * push, a.y - uy * push
					b.x, b.y = b.x + ux * push, b.y + uy * push
					moved = true
				end
			end
		end
		for i = 1, n do
			local p = points[i]
			p.x = math.min(math.max(p.x, p.r - margin), w + margin - p.r)
			p.y = math.min(math.max(p.y, p.r - margin), h + margin - p.r)
		end
		if not moved then
			break
		end
	end
	return points
end

--- The floor a view opens on: the one with most bosses (the entrance is often on a floor with few: Upper Blackrock Spire's
--- has none); of floors with as many, the entrance's, else the lowest.
function Layout.FirstFloor(v)
	local door = v.doors and v.doors[1] and v.doors[1][3]
	local count, best = {}, nil
	for _, b in ipairs(v.bosses or {}) do
		count[b.floor] = (count[b.floor] or 0) + 1
	end
	for f = 1, math.max(1, #(v.floors or {})) do
		local n, most = count[f] or 0, best and (count[best] or 0) or -1
		if n > most or (n == most and f == door) then
			best = f
		end
	end
	return best
end

--- Every mark of a view: a boss at each of its places, then the entrance. Each { x, y (shares of the view, from its top
--- left), pin (the boss's entry, nil for the entrance), place, places, floor }.
function Layout.Marks(v)
	local out = {}
	for _, b in ipairs(v.bosses or {}) do
		local places = math.floor(#(b.at or {}) / 2)
		for k = 1, places do
			out[#out + 1] = { x = b.at[2 * k - 1], y = b.at[2 * k], pin = b, place = k, places = places, floor = b.floor or 1 }
		end
	end
	for _, d in ipairs(v.doors or {}) do
		out[#out + 1] = { x = d[1], y = d[2], floor = d[3] or 1, door = true }
	end
	return out
end

-- Drawing -----------------------------------------------------------------------------------------------------------

local function ringFor(size, thick)
	-- Media/RingN.tga is a circle one unit thick at N units across a half; half that for two units
	local r = thick and size / 4 or size / 2
	return UI.MEDIA .. "Ring" .. math.max(4, math.min(16, math.floor(r + 0.5))) .. ".tga"
end

local function smooth(t)
	if t.SetSnapToPixelGrid then
		t:SetSnapToPixelGrid(false)
		t:SetTexelSnappingBias(0)
	end
	return t
end

--- A boss's mark: its portrait in a circle with a fine ring, on a dark collar that parts it from the walls under it.
--- Under the portrait, a plain disc with the boss's initial shows when the game has no portrait for its display id.
local function bossMark(map)
	local m = CreateFrame("Button", nil, map.canvas)
	m:RegisterForClicks("LeftButtonUp")
	m.glow = smooth(m:CreateTexture(nil, "BACKGROUND", nil, -2))
	m.glow:SetTexture(UI.MEDIA .. "Glow.tga")
	m.glow:SetPoint("CENTER")
	m.glow:Hide()
	m.collar = smooth(m:CreateTexture(nil, "BACKGROUND", nil, 0))
	m.collar:SetTexture(UI.MEDIA .. "Disc64.tga")
	m.collar:SetPoint("TOPLEFT", -2, 2)
	m.collar:SetPoint("BOTTOMRIGHT", 2, -2)
	m.collar:SetVertexColor(0.035, 0.04, 0.05, 0.92)
	m.disc = smooth(m:CreateTexture(nil, "BACKGROUND", nil, 1))
	m.disc:SetTexture(UI.MEDIA .. "Disc64.tga")
	m.disc:SetAllPoints()
	m.disc:SetVertexColor(0.17, 0.19, 0.22, 1)
	m.initial = UI.Text(m, 12, ns.RGB.mist, { weight = "bold", justify = "CENTER", layer = "BORDER" })
	m.initial:SetPoint("CENTER", 0.5, 0.5)
	m.portrait = smooth(m:CreateTexture(nil, "ARTWORK"))
	m.portrait:SetAllPoints()
	if m.CreateMaskTexture and m.portrait.AddMaskTexture then
		local mask = m:CreateMaskTexture(nil, "ARTWORK")
		mask:SetTexture(UI.MEDIA .. "DiscMask.tga", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
		mask:SetAllPoints(m.portrait)
		m.portrait:AddMaskTexture(mask)
	end
	m.ring = smooth(m:CreateTexture(nil, "OVERLAY"))
	m.ring:SetAllPoints()
	m:SetScript("OnEnter", function(self)
		map:Hover(self, true)
	end)
	m:SetScript("OnLeave", function(self)
		map:Hover(self, false)
	end)
	m:SetScript("OnClick", function(self)
		if self.mark and self.mark.pin and map.opts.onClick then
			map.opts.onClick(self.mark.pin.boss, self.mark.pin)
		end
	end)
	return m
end

--- The entrance's mark: an arched doorway in gold on a dark disc.
local function doorMark(map)
	local m = CreateFrame("Frame", nil, map.canvas)
	m:SetSize(DOOR, DOOR)
	m:EnableMouse(true)
	m.collar = smooth(m:CreateTexture(nil, "BACKGROUND", nil, 0))
	m.collar:SetTexture(UI.MEDIA .. "Disc32.tga")
	m.collar:SetPoint("TOPLEFT", -2, 2)
	m.collar:SetPoint("BOTTOMRIGHT", 2, -2)
	m.collar:SetVertexColor(0.035, 0.04, 0.05, 0.92)
	m.disc = smooth(m:CreateTexture(nil, "BACKGROUND", nil, 1))
	m.disc:SetTexture(UI.MEDIA .. "Disc32.tga")
	m.disc:SetAllPoints()
	m.disc:SetVertexColor(0.15, 0.13, 0.09, 1)
	m.ring = smooth(m:CreateTexture(nil, "ARTWORK"))
	m.ring:SetTexture(ringFor(DOOR))
	m.ring:SetAllPoints()
	m.ring:SetVertexColor(UI.colors.gilt[1], UI.colors.gilt[2], UI.colors.gilt[3], 0.75)
	m.icon = smooth(m:CreateTexture(nil, "OVERLAY"))
	m.icon:SetTexture(UI.MEDIA .. "Maps\\Door.tga")
	m.icon:SetSize(12, 12)
	m.icon:SetPoint("CENTER", 0, 0.5)
	m.icon:SetVertexColor(unpack(UI.colors.giltBright))
	m:SetScript("OnEnter", function(self)
		local lines = { { "Where you come in.", 0.84, 0.82, 0.78 } }
		if self.mark and self.mark.floorName then
			lines[#lines + 1] = { self.mark.floorName, 0.64, 0.62, 0.58 }
		end
		UI.TextTooltip(self, "Entrance", lines)
	end)
	m:SetScript("OnLeave", function()
		GameTooltip:Hide()
	end)
	return m
end

local function pill(parent, label, height, onClick)
	local b = UI.Button(parent, label, nil, height, onClick)
	UI.SetFont(b.label, "medium", height >= 24 and 11.5 or 11)
	b:FitWidth(30)
	b:SetSelected(false)
	return b
end

--- The map. opts: bossOf(boss index) -> the boss's entry in Data/Dungeons.lua (for its initial); onEnter(owner, boss
--- index, pin, { places = how many a pooled boss has, floorName = its floor's, when not the floor picked }); onLeave();
--- onClick(boss index, pin). Its frame is built once and moved to wherever the page shows it; each part is made the first
--- time a map needs it, and kept.
function UI.DungeonMap(parent, opts)
	local map = CreateFrame("Frame", nil, parent)
	map.opts = opts or {}
	map.state = {} -- per dungeon, for this session: the wing and floor picked, and the boss last opened
	map.wingPills, map.floorPills, map.floorTex, map.marks, map.doors = {}, {}, {}, {}, {}
	map.well = CreateFrame("Frame", nil, map)
	UI.Surface(map.well, 10, { 0, 0, 0, 0.24 }, UI.colors.cardLine)
	map.canvas = CreateFrame("Frame", nil, map.well)

	local function state(slug)
		local s = map.state[slug]
		if not s then
			s = { view = 1 }
			map.state[slug] = s
		end
		return s
	end

	--- The wing pills of the dungeon shown, made as needed; returns the height they take at width w.
	local function wingPills(w)
		local views = map.views or {}
		for i, b in ipairs(map.wingPills) do
			b:SetShown(#views > 1 and i <= #views)
		end
		if #views <= 1 then
			return 0
		end
		for i, v in ipairs(views) do
			local b = map.wingPills[i]
			if not b then
				b = pill(map, "", CHIP_H, function(self)
					map:PickView(self.index)
				end)
				map.wingPills[i] = b
			end
			b.index = i
			b:SetLabel(v.name or ("Part " .. i))
			b:FitWidth(30)
			b:Show()
		end
		local shown = {}
		for i = 1, #views do
			shown[i] = map.wingPills[i]
		end
		return UI.Flow(shown, map, 0, 0, w, 6) + CHIP_GAP
	end

	--- The height the map needs at width w: the wing pills, and a well that fits the dungeon's biggest view (the same for
	--- all its wings, so picking one does not move the page).
	function map:HeightFor(w)
		local top = wingPills(w)
		local inner = math.min(w - 2 * PAD, MAX_W)
		local most = 0
		for _, v in ipairs(self.views or {}) do
			local band = #(v.floors or {}) > 1 and (FLOOR_H + FLOOR_GAP) or 0
			local _, ch = Layout.Fit(v.aspect, inner, MAX_H)
			most = math.max(most, band + ch)
		end
		return math.ceil(top + most + 2 * PAD)
	end

	--- Shows a dungeon's map (its Data/Maps.lua views).
	function map:SetDungeon(slug, views)
		if self.slug ~= slug then
			self.slug, self.views = slug, views
			self.hot = nil
		end
		local s = state(slug)
		if not (views[s.view]) then
			s.view = 1
		end
		self:Layout()
	end

	--- Remembers the boss opened last: the map opens on its wing and floor, and rings it in gold.
	function map:Focus(slug, views, boss)
		local s = state(slug)
		s.boss = boss
		for vi, v in ipairs(views or {}) do
			for _, b in ipairs(v.bosses) do
				if b.boss == boss then
					s.view, s.floor = vi, b.floor
					return
				end
			end
		end
	end

	function map:PickView(i)
		local s = state(self.slug)
		if s.view ~= i then
			s.view, s.floor, self.hot = i, nil, nil
			self:Layout()
		end
	end

	function map:PickFloor(f)
		local s = state(self.slug)
		if s.floor ~= f then
			s.floor = f
			self:Paint()
		end
	end

	--- Puts the pills, the well, the drawing and the marks in place for the map's size.
	function map:Layout()
		local w, h = self:GetWidth() or 0, self:GetHeight() or 0
		local v = self.slug and self.views and self.views[state(self.slug).view]
		if not v or w <= 0 or h <= 0 then
			return
		end
		local s = state(self.slug)
		s.floor = s.floor and v.floors[s.floor] and s.floor or Layout.FirstFloor(v)
		local top = wingPills(w)
		for i, b in ipairs(self.wingPills) do
			b:SetSelected(i == s.view)
		end
		self.well:ClearAllPoints()
		self.well:SetPoint("TOPLEFT", 0, -top)
		self.well:SetPoint("BOTTOMRIGHT")
		-- floor pills in the well's corner, the lowest floor first as the data counts them
		local floors = #v.floors > 1
		local x = PAD
		for i = 1, math.max(#v.floors, #self.floorPills) do
			local b = self.floorPills[i]
			local f = v.floors[i]
			if floors and f then
				if not b then
					b = pill(self.well, "", FLOOR_H, function(btn)
						map:PickFloor(btn.index)
					end)
					self.floorPills[i] = b
				end
				b.index = i
				b:SetLabel(f.name or ("Floor " .. i))
				b:FitWidth(30)
				b:ClearAllPoints()
				b:SetPoint("TOPLEFT", self.well, "TOPLEFT", x, -PAD)
				x = x + b:GetWidth() + 6
				b:Show()
			elseif b then
				b:Hide()
			end
		end
		-- the drawing: as big as fits under the pills, centred
		local band = floors and (FLOOR_H + FLOOR_GAP) or 0
		local aw, ah = w - 2 * PAD, (h - top) - 2 * PAD - band
		local cw, ch = Layout.Fit(v.aspect, math.min(aw, MAX_W), math.min(ah, MAX_H))
		cw, ch = math.floor(cw + 0.5), math.floor(ch + 0.5)
		self.canvas:ClearAllPoints()
		self.canvas:SetSize(math.max(1, cw), math.max(1, ch))
		self.canvas:SetPoint("TOPLEFT", self.well, "TOPLEFT", PAD + math.floor((aw - cw) / 2), -(PAD + band + math.floor((ah - ch) / 2)))
		-- floor textures, one per floor, made as needed
		for i = 1, math.max(#v.floors, #self.floorTex) do
			local t = self.floorTex[i]
			local f = v.floors[i]
			if f then
				if not t then
					t = smooth(self.canvas:CreateTexture(nil, "ARTWORK"))
					t:SetAllPoints(self.canvas)
					self.floorTex[i] = t
				end
				t:SetTexture(UI.MEDIA .. "Maps\\" .. f.tex .. ".tga", "CLAMP", "CLAMP")
				t:Show()
			elseif t then
				t:Hide()
			end
		end
		-- marks: portraits at full size wherever they are, spread so none hides another, the same on every floor
		local marks = Layout.Marks(v)
		local size = Layout.BossSize(cw, ch, #v.bosses)
		for _, mk in ipairs(marks) do
			mk.size = mk.door and DOOR or (mk.places > 1 and math.floor(size * POOLED + 0.5) or size)
			mk.r = mk.size / 2 + 2
			mk.x, mk.y = mk.x * cw, mk.y * ch
			mk.floorName = floors and v.floors[mk.floor] and v.floors[mk.floor].name or nil
		end
		Layout.Spread(marks, cw, ch, EDGE)
		local nb, nd = 0, 0
		for _, mk in ipairs(marks) do
			local m
			if mk.door then
				nd = nd + 1
				m = self.doors[nd] or doorMark(self)
				self.doors[nd] = m
			else
				nb = nb + 1
				m = self.marks[nb] or bossMark(self)
				self.marks[nb] = m
				m.size = mk.size
				m:SetSize(mk.size, mk.size)
				local boss = self.opts.bossOf and self.opts.bossOf(mk.pin.boss)
				m.initial:SetText(boss and boss.n and boss.n:match("[%a\128-\255][\128-\191]*") or "?")
				if m.display ~= mk.pin.display then
					-- The game draws the portrait when it knows the display id; the initial under it shows otherwise.
					m.display = mk.pin.display
					m.portrait:SetTexture(nil)
					if mk.pin.display and SetPortraitTextureFromCreatureDisplayID then
						pcall(SetPortraitTextureFromCreatureDisplayID, m.portrait, mk.pin.display)
					end
				end
			end
			m.mark = mk
			-- on whole units, so a portrait's edge falls on the pixel grid (a size and its hover size are both even or odd)
			local half = mk.size / 2
			m:ClearAllPoints()
			m:SetPoint("CENTER", self.canvas, "TOPLEFT", math.floor(mk.x - half + 0.5) + half, -(math.floor(mk.y - half + 0.5) + half))
			m:Show()
		end
		for i = nb + 1, #self.marks do
			self.marks[i]:Hide()
			self.marks[i].mark = nil
		end
		for i = nd + 1, #self.doors do
			self.doors[i]:Hide()
		end
		self:Paint()
	end

	--- How each mark and floor looks for the floor picked, the boss under the cursor and the boss opened last.
	function map:Paint()
		local v = self.slug and self.views and self.views[state(self.slug).view]
		if not v then
			return
		end
		local s = state(self.slug)
		for i, b in ipairs(self.floorPills) do
			b:SetSelected(i == s.floor)
		end
		for i, t in ipairs(self.floorTex) do
			if t:IsShown() then
				local on = i == s.floor
				t:SetAlpha(on and 1 or FAINT)
				-- the floor picked over the others
				t:SetDrawLayer("ARTWORK", on and 2 or 0)
			end
		end
		local base = self.canvas:GetFrameLevel()
		local hot = self.hot and self.hot.mark and self.hot.mark.pin
		for _, m in ipairs(self.marks) do
			local mk = m.mark
			if mk and m:IsShown() then
				local here = mk.floor == s.floor
				local lit = hot ~= nil and mk.pin == hot
				local picked = mk.pin.boss == s.boss
				local alpha = here and (mk.places > 1 and 0.8 or 1) or GHOST
				m:SetAlpha(lit and 1 or alpha)
				m.portrait:SetDesaturated(not here and not lit)
				local size = m.size + (lit and 4 or 0)
				m:SetSize(size, size)
				m.ring:SetTexture(ringFor(size, lit or picked))
				local c = (lit or picked) and UI.colors.gilt or nil
				if c then
					m.ring:SetVertexColor(c[1], c[2], c[3], 1)
				else
					m.ring:SetVertexColor(0.85, 0.87, 0.9, here and 0.6 or 0.4)
				end
				m.glow:SetShown(lit)
				if lit then
					m.glow:SetSize(size * 2.2, size * 2.2)
					m.glow:SetVertexColor(UI.colors.gilt[1], UI.colors.gilt[2], UI.colors.gilt[3], 0.35)
				end
				-- the boss on the floor picked above those on others, the one under the cursor above all
				m:SetFrameLevel(base + (lit and 20 or here and 10 or 2))
			end
		end
		for _, m in ipairs(self.doors) do
			if m.mark and m:IsShown() then
				m:SetAlpha(m.mark.floor == s.floor and 1 or GHOST)
				m:SetFrameLevel(base + 8)
			end
		end
	end

	--- The cursor over a boss's mark: it and its other places light up, and the page says what it is.
	function map:Hover(m, on)
		self.hot = on and m or nil
		self:Paint()
		if on and m.mark and self.opts.onEnter then
			local s = state(self.slug)
			self.opts.onEnter(m, m.mark.pin.boss, m.mark.pin, { places = m.mark.places, floorName = m.mark.floor ~= s.floor and m.mark.floorName or nil })
		elseif not on and self.opts.onLeave then
			self.opts.onLeave(m)
		end
	end

	--- Moves the map into a frame of the page (a list row) and fits it there, side units in from its left and right, top
	--- and bottom from its top and bottom.
	function map:Attach(holder, side, top, bottom)
		if self.holder and self.holder ~= holder then
			self.holder.holdsMap = nil
		end
		self.holder = holder
		holder.holdsMap = true
		self:SetParent(holder)
		self:SetFrameLevel(holder:GetFrameLevel() + 2)
		self:ClearAllPoints()
		self:SetPoint("TOPLEFT", holder, "TOPLEFT", side or 0, -(top or 0))
		self:SetPoint("BOTTOMRIGHT", holder, "BOTTOMRIGHT", -(side or 0), bottom or 0)
		self:Show()
		self:Layout()
	end

	function map:Detach(holder)
		if self.holder == holder then
			holder.holdsMap = nil
			self.holder = nil
			self:Hide()
		end
	end

	map:SetScript("OnSizeChanged", function(self)
		self:Layout()
	end)
	map:Hide()
	return map
end
