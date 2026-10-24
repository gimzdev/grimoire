-- The route on the world map: your next places as numbered pins joined by a line, 1 the one you are on, and the quests
-- you can take in the zone shown, a quest mark at each giver. A pin's tooltip says what to do there and a click shows it
-- in the guide window; a quest mark's lists its quests and a click points the guide at the giver. They keep their size as
-- the map zooms.
local _, ns = ...
local UI = ns.UI
local Guide = ns.Guide

local AHEAD = 8 -- places shown, yours first
local SIZE = 18
local SAME = 0.6 -- map percent: steps this close are one place

local QUEST_MARK = "Interface\\GossipFrame\\AvailableQuestIcon"
local MARK = 15
local overlay, pins, lines, marks = nil, {}, {}, {}
local shownScale

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

local function canvas()
	local m = WorldMapFrame
	if not m then
		return nil
	end
	return (m.GetCanvas and m:GetCanvas()) or (m.ScrollContainer and m.ScrollContainer.Child)
end

local function canvasScale()
	local sc = WorldMapFrame and WorldMapFrame.ScrollContainer
	local s = sc and sc.GetCanvasScale and sc:GetCanvasScale()
	return (plain(s) and s and s > 0) and s or 1
end

--- A point of a zone map (area, x, y in percent) on the map shown: 0-1 each way, or nil off it.
local function onMap(map, area, x, y)
	local z = ns.guide and ns.guide.zones[area]
	if not z then
		return nil
	end
	if z[2] == map then
		return x / 100, y / 100
	end
	if not (C_Map and C_Map.GetWorldPosFromMapPos and C_Map.GetMapPosFromWorldPos and CreateVector2D) then
		return nil
	end
	local ok, cont, world = pcall(C_Map.GetWorldPosFromMapPos, z[2], CreateVector2D(x / 100, y / 100))
	if not ok or not cont or not world then
		return nil
	end
	local ok2, _, pos = pcall(C_Map.GetMapPosFromWorldPos, cont, world, map)
	if not ok2 or not pos or not plain(pos.x) then
		return nil
	end
	if pos.x < 0 or pos.x > 1 or pos.y < 0 or pos.y > 1 then
		return nil
	end
	return pos.x, pos.y
end

--- Your next places: { first step, steps, area, x, y } a visit each, past what you skipped and what is done.
local function places()
	local live, _, route = Guide.Index()
	local out = {}
	if not live or Guide.Waiting() then
		return out
	end
	local i = (Guide.Group(live))
	while i <= #route.steps and #out < AHEAD do
		local first, last = Guide.Group(i)
		local j = math.max(first, live)
		while j <= last and (Guide.IsSkipped(j) or (j >= live and Guide.IsDone(j, route.steps[j]) and j ~= live)) do
			j = j + 1
		end
		if j <= last then
			local step = route.steps[j]
			if step[1] ~= Guide.HEARTH and step[1] ~= Guide.TELEPORT then
				local area, x, y = Guide.Target(step)
				local prev = out[#out]
				if prev and prev.area == area and math.abs(prev.x - x) < SAME and math.abs(prev.y - y) < SAME then
					prev.last = last
				elseif area and x then
					out[#out + 1] = { first = j, last = last, area = area, x = x, y = y }
				end
			end
		end
		i = last + 1
	end
	return out
end

local function pinFrame(n)
	local p = pins[n]
	if p then
		return p
	end
	p = CreateFrame("Button", nil, overlay)
	p:SetSize(SIZE, SIZE)
	p.disc = p:CreateTexture(nil, "ARTWORK")
	p.disc:SetTexture(UI.MEDIA .. "Disc32.tga")
	p.disc:SetAllPoints()
	p.ring = p:CreateTexture(nil, "OVERLAY")
	p.ring:SetTexture(UI.MEDIA .. "Ring9.tga")
	p.ring:SetAllPoints()
	p.num = UI.Text(p, 10, ns.RGB.white, { weight = "bold", justify = "CENTER" })
	p.num:SetPoint("CENTER", 0, 0.5)
	p:SetScript("OnEnter", function(self)
		local step = self.place and Guide.Step(self.place.first)
		if not step then
			return
		end
		GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
		GameTooltip:SetText(self.label .. "  " .. (Guide.KindLabel(step) or ""), 0.95, 0.71, 0.25)
		for j = self.place.first, math.min(self.place.last, self.place.first + 5) do
			local s = Guide.Step(j)
			if s and not Guide.IsSkipped(j) then
				GameTooltip:AddLine(Guide.Summary(s), 1, 1, 1, true)
			end
		end
		GameTooltip:Show()
	end)
	p:SetScript("OnLeave", function()
		GameTooltip:Hide()
	end)
	p:SetScript("OnClick", function(self)
		if self.place and ns.ShowGuideStep then
			ns.ShowGuideStep(self.place.first)
		end
	end)
	pins[n] = p
	return p
end

local function lineFrom(n)
	local l = lines[n]
	if not l and overlay.CreateLine then
		l = overlay:CreateLine(nil, "ARTWORK")
		l:SetThickness(2)
		lines[n] = l
	end
	return l
end

-- Quests you can take ---------------------------------------------------------------------------------------------------

--- The level a quest goes grey at for you (it gives little then), as the game colours it.
local function greyLevel(p)
	return p <= 5 and 0 or p <= 39 and p - math.floor(p / 10) - 5 or p - math.floor(p / 5) - 1
end

local function classBit()
	for i, slug in ipairs(ns.classOrder or {}) do
		if slug == ns.player.class then
			return 2 ^ (i - 1)
		end
	end
end

--- The quests you can take from givers on a zone's map (its ui map id): { [giver] = { area, x, y, quests } }.
local function takeable(map)
	local G = ns.guide
	local level = ns.player.level or 1
	local side = ns.player.faction == "horde" and 2 or 1
	local bit = classBit()
	local grey = greyLevel(level)
	local out = {}
	for id, q in pairs(G.starts or {}) do
		local z = q[6] ~= 0 and G.zones[q[6]]
		if z and z[2] == map and q[5] ~= 0 and q[3] <= level and (q[2] <= 0 or q[2] > grey) and (q[4] == 3 or q[4] == side)
			and (q[11] == 0 or (bit and math.floor(q[11] / bit) % 2 == 1))
			and not Guide.Completed(id) and not Guide.OnQuest(id) and (q[10] == 0 or Guide.Completed(q[10])) then
			local key = q[5] .. ":" .. q[7] .. ":" .. q[8]
			local g = out[key]
			if not g then
				g = { giver = q[5], area = q[6], x = q[7], y = q[8], quests = {} }
				out[key] = g
			end
			g.quests[#g.quests + 1] = id
		end
	end
	return out
end

local function markFrame(n)
	local m = marks[n]
	if m then
		return m
	end
	m = CreateFrame("Button", nil, overlay)
	m:SetSize(MARK, MARK)
	m.icon = m:CreateTexture(nil, "ARTWORK")
	m.icon:SetTexture(QUEST_MARK)
	m.icon:SetAllPoints()
	m:SetAlpha(0.85)
	m:SetScript("OnEnter", function(self)
		local G = ns.guide
		local who = self.giver > 0 and G.npcs[self.giver] or G.objects[-self.giver]
		GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
		GameTooltip:SetText(who or "Quests", 1, 0.82, 0)
		for _, id in ipairs(self.quests) do
			local q = G.starts[id]
			GameTooltip:AddDoubleLine(q[1], tostring(q[2]), 1, 1, 1, 0.64, 0.62, 0.58)
		end
		GameTooltip:AddLine("Click for the way there", 0.64, 0.62, 0.58)
		GameTooltip:Show()
		self:SetAlpha(1)
	end)
	m:SetScript("OnLeave", function(self)
		GameTooltip:Hide()
		self:SetAlpha(0.85)
	end)
	m:SetScript("OnClick", function(self)
		local G = ns.guide
		local who = self.giver > 0 and G.npcs[self.giver] or G.objects[-self.giver]
		local q = G.starts[self.quests[1]]
		Guide.GoTo({ area = self.area, x = self.x, y = self.y, title = who or q[1], sub = #self.quests > 1 and (#self.quests .. " quests") or q[1] })
	end)
	marks[n] = m
	return m
end

local function hideAll()
	for _, p in ipairs(pins) do
		p:Hide()
	end
	for _, m in ipairs(marks) do
		m:Hide()
	end
	for _, l in ipairs(lines) do
		l:Hide()
	end
end

local function refresh()
	if not overlay then
		return
	end
	hideAll()
	if not (ns.db and ns.db.guidePin ~= false and ns.guide and WorldMapFrame and WorldMapFrame:IsShown()) then
		return
	end
	local map = WorldMapFrame.GetMapID and WorldMapFrame:GetMapID()
	if not plain(map) or not map then
		return
	end
	local s = canvasScale()
	shownScale = s
	overlay:SetScale(1 / s)
	local w, h = overlay:GetWidth(), overlay:GetHeight()
	if not (w and h) or w <= 0 then
		return
	end
	local gilt = UI.colors.gilt
	local prevX, prevY, n = nil, nil, 0
	local placed = {}
	for k, place in ipairs(places()) do
		local x, y = onMap(map, place.area, place.x, place.y)
		if x then
			placed[#placed + 1] = { x, y }
			n = n + 1
			local p = pinFrame(n)
			p.place, p.label = place, tostring(k)
			p:ClearAllPoints()
			p:SetPoint("CENTER", overlay, "TOPLEFT", x * w, -y * h)
			p.num:SetText(k)
			if k == 1 then
				p.disc:SetVertexColor(gilt[1], gilt[2], gilt[3], 1)
				p.ring:SetVertexColor(1, 1, 1, 0.5)
				p.num:SetTextColor(0.1, 0.07, 0.02, 1)
			else
				p.disc:SetVertexColor(0.07, 0.075, 0.09, 0.92)
				p.ring:SetVertexColor(gilt[1], gilt[2], gilt[3], 0.95)
				p.num:SetTextColor(1, 1, 1, 1)
			end
			p:SetFrameLevel(overlay:GetFrameLevel() + 10 + (AHEAD - k))
			p:Show()
			local l = prevX and lineFrom(n - 1)
			if l then
				l:SetStartPoint("TOPLEFT", overlay, prevX * w, -prevY * h)
				l:SetEndPoint("TOPLEFT", overlay, x * w, -y * h)
				l:SetColorTexture(gilt[1], gilt[2], gilt[3], 0.55)
				l:Show()
			end
			prevX, prevY = x, y
		else
			prevX, prevY = nil, nil
		end
	end
	-- The quests you can take here, a mark at each giver; none where a route pin stands already.
	local k = 0
	for _, g in pairs(takeable(map)) do
		local x, y = g.x / 100, g.y / 100
		local near = false
		for _, p in ipairs(placed) do
			if math.abs(p[1] - x) < 0.012 and math.abs(p[2] - y) < 0.012 then
				near = true
			end
		end
		if not near then
			k = k + 1
			local m = markFrame(k)
			m.giver, m.area, m.x, m.y, m.quests = g.giver, g.area, g.x, g.y, g.quests
			m:ClearAllPoints()
			m:SetPoint("BOTTOM", overlay, "TOPLEFT", x * w, -y * h)
			m:SetFrameLevel(overlay:GetFrameLevel() + 5)
			m:Show()
		end
	end
end
ns.RefreshRouteMap = refresh

local function setup()
	local c = canvas()
	if overlay or not c then
		return
	end
	overlay = CreateFrame("Frame", nil, c)
	overlay:SetAllPoints(c)
	overlay:SetFrameLevel(c:GetFrameLevel() + 500)
	-- Zooming changes the canvas's scale: the pins keep their size and places.
	overlay:SetScript("OnUpdate", function()
		if canvasScale() ~= shownScale then
			refresh()
		end
	end)
	if WorldMapFrame.OnMapChanged then
		hooksecurefunc(WorldMapFrame, "OnMapChanged", refresh)
	end
	WorldMapFrame:HookScript("OnShow", refresh)
	ns.Listen("GUIDE", function()
		if WorldMapFrame:IsShown() then
			refresh()
		end
	end)
	ns.On("QUEST_TURNED_IN", function()
		if WorldMapFrame:IsShown() then
			refresh()
		end
	end)
end

ns.Listen("LOGIN", function()
	local ok = pcall(setup)
	if not ok and ns.debug then
		ns.Print("could not add the route to the world map.")
	end
end)
