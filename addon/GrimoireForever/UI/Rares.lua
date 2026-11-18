-- Rare alerts: a rare creature near you (its nameplate, your target or mouseover, or the minimap's mark for it) gets a
-- quiet card at the top of the screen with its level, its best drops (an upgrade for you marked) and the way to it.
local _, ns = ...
local UI = ns.UI

local SHOW_FOR = 14 -- seconds the card stays, unless the cursor is on it
local AGAIN = 600 -- seconds before the same creature is announced again

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

local seen = {} -- spawn guid or npc id -> time announced
local card

local function npcOf(guid)
	if not (plain(guid) and type(guid) == "string") then
		return nil
	end
	local kind, _, _, _, _, id = strsplit("-", guid)
	if kind ~= "Creature" then
		return nil
	end
	return tonumber(id or "")
end

-- Where to send the arrow: the spot the game marks, else the creature's spawn nearest to you (Data/Guide.lua).
local function spotOf(npc)
	local G, Guide = ns.guide, ns.Guide
	local list = G and G.rares and G.rares[npc]
	if not list then
		return nil
	end
	local pmap, pn, pw = Guide.PlayerWorld()
	local best, bestD
	for i = 1, #list, 3 do
		local m, n, w = Guide.World(list[i], list[i + 1], list[i + 2])
		local d = m and pmap and m == pmap and ((n - pn) ^ 2 + (w - pw) ^ 2) or math.huge
		if not best or d < bestD then
			best, bestD = i, d
		end
	end
	return best and { area = list[best], x = list[best + 1], y = list[best + 2] } or nil
end

--- The best of a creature's drops in words: up to two, by chance, an upgrade for you marked.
local function lootLine(npc)
	local parts = {}
	for _, row in ipairs(ns.ParseLoot(ns.npcDrops and ns.npcDrops[npc])) do
		if not row.quest then
			local name, quality = ns.ItemInfo(row.id)
			if name then
				local up = ns.Gear and ns.items[row.id] and select(1, ns.Gear.Upgrade(row.id))
				parts[#parts + 1] = ns.QualityText(quality, name) .. " " .. ns.Hex(ns.HEX.fog, ns.Chance(row.chance)) .. (up and (" " .. ns.Gear.UP) or "")
				if #parts == 2 then
					break
				end
			end
		end
	end
	return table.concat(parts, ns.Hex(ns.HEX.fog, ",  "))
end

local function build()
	local f = CreateFrame("Frame", "GrimoireForeverRare", UIParent)
	f:SetSize(340, 58)
	f:SetPoint("TOP", UIParent, "TOP", 0, -72)
	f:SetFrameStrata("HIGH")
	f:EnableMouse(true)
	UI.Surface(f, 12, { 0.08, 0.085, 0.1, 0.94 }, { 1, 1, 1, 0.1 })
	f.face = f:CreateTexture(nil, "ARTWORK")
	f.face:SetSize(38, 38)
	f.face:SetPoint("LEFT", 10, 0)
	if f.CreateMaskTexture and f.face.AddMaskTexture then
		local mask = f:CreateMaskTexture(nil, "ARTWORK")
		mask:SetTexture(UI.MEDIA .. "DiscMask.tga", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
		mask:SetAllPoints(f.face)
		f.face:AddMaskTexture(mask)
	end
	f.ring = f:CreateTexture(nil, "OVERLAY")
	f.ring:SetTexture(UI.MEDIA .. "Ring16.tga")
	f.ring:SetPoint("CENTER", f.face)
	f.ring:SetSize(40, 40)
	f.ring:SetVertexColor(0.85, 0.87, 0.9, 0.7)
	f.name = UI.Text(f, 13, ns.RGB.white, { weight = "bold" })
	f.name:SetPoint("TOPLEFT", 58, -11)
	f.name:SetPoint("RIGHT", -96, 0)
	f.loot = UI.Text(f, 11, ns.RGB.mist)
	f.loot:SetPoint("TOPLEFT", 58, -31)
	f.loot:SetPoint("RIGHT", -96, 0)
	f.go = UI.Button(f, "Go", 52, 24, function()
		if f.spot and ns.Guide then
			ns.Guide.GoTo({ area = f.spot.area, x = f.spot.x, y = f.spot.y, title = f.who, sub = f.rank, label = "Rare" })
		end
		f:Hide()
	end, "primary")
	f.go:SetPoint("RIGHT", -34, 0)
	f.close = CreateFrame("Button", nil, f)
	f.close:SetSize(22, 22)
	f.close:SetPoint("RIGHT", -8, 0)
	f.close.x = UI.Mark(f.close, "Close", 11, ns.RGB.fog)
	f.close.x:SetPoint("CENTER")
	f.close:SetScript("OnEnter", function(self)
		self.x:SetVertexColor(unpack(ns.RGB.white))
	end)
	f.close:SetScript("OnLeave", function(self)
		self.x:SetVertexColor(unpack(ns.RGB.fog))
	end)
	f.close:SetScript("OnClick", function()
		f:Hide()
	end)
	f:SetScript("OnUpdate", function(self, elapsed)
		if self:IsMouseOver() then
			self.left = SHOW_FOR
			self:SetAlpha(1)
			return
		end
		self.left = (self.left or SHOW_FOR) - elapsed
		if self.left <= 0 then
			self:Hide()
		elseif self.left < 1 then
			self:SetAlpha(self.left)
		else
			self:SetAlpha(math.min(1, self:GetAlpha() + elapsed * 4))
		end
	end)
	f:Hide()
	return f
end

--- Shows the card for a rare: its npc id, name, level, whether elite, and a unit to draw its face from (or nil).
local function announce(npc, name, level, elite, unit, spot)
	if not (ns.db and ns.db.rareAlerts ~= false) then
		return
	end
	card = card or build()
	card.who = name
	card.rank = elite and "Rare elite" or "Rare"
	card.spot = spot or spotOf(npc)
	local lvl = level and level > 0 and tostring(level) or "??"
	card.name:SetText(name .. ns.Hex(ns.HEX.mist, "  " .. lvl))
	-- What it is, then its best drops.
	local loot = lootLine(npc)
	card.loot:SetText(ns.Hex(elite and ns.HEX.gold or "c9ced6", card.rank) .. (loot ~= "" and (ns.Hex(ns.HEX.fog, "  ·  ") .. loot) or ""))
	if unit and SetPortraitTexture then
		SetPortraitTexture(card.face, unit)
	else
		card.face:SetTexture("Interface\\Icons\\INV_Misc_Head_Dragon_Black")
	end
	card.go:SetShown(card.spot ~= nil)
	card.left = SHOW_FOR
	card:SetAlpha(0)
	card:Show()
	if PlaySound and SOUNDKIT and SOUNDKIT.MAP_PING then
		PlaySound(SOUNDKIT.MAP_PING)
	end
end

local function fresh(key)
	local now = GetTime()
	if seen[key] and now - seen[key] < AGAIN then
		return false
	end
	seen[key] = now
	return true
end

local function check(unit)
	if not (ns.db and ns.db.rareAlerts ~= false) or not UnitExists(unit) then
		return
	end
	local class = UnitClassification(unit)
	if not plain(class) or (class ~= "rare" and class ~= "rareelite") then
		return
	end
	if UnitIsDead(unit) or (UnitIsPlayer and UnitIsPlayer(unit)) then
		return
	end
	local guid = UnitGUID(unit)
	local npc = npcOf(guid)
	if not npc then
		return
	end
	-- A rare far below you (grey to you) is no news.
	local level = UnitLevel(unit)
	level = plain(level) and level or nil
	if level and level > 0 and level < (ns.player.level or 1) - 8 then
		return
	end
	if not fresh(guid) or not fresh(npc) then
		return
	end
	local name = UnitName(unit)
	announce(npc, plain(name) and name or "A rare", level, class == "rareelite", unit)
end

ns.On("NAME_PLATE_UNIT_ADDED", check)
ns.On("PLAYER_TARGET_CHANGED", function()
	check("target")
end)
ns.On("UPDATE_MOUSEOVER_UNIT", function()
	check("mouseover")
end)

-- The minimap's marks (where the game has them): a rare's mark says where it is before you see it.
local function vignette(id)
	if not (C_VignetteInfo and C_VignetteInfo.GetVignetteInfo) then
		return
	end
	local info = C_VignetteInfo.GetVignetteInfo(id)
	local npc = info and npcOf(info.objectGUID)
	if not npc or not (ns.guide and ns.guide.rares and ns.guide.rares[npc]) or not fresh(info.objectGUID) or not fresh(npc) then
		return
	end
	local spot
	local map = C_Map and C_Map.GetBestMapForUnit and C_Map.GetBestMapForUnit("player")
	local pos = map and C_VignetteInfo.GetVignettePosition and C_VignetteInfo.GetVignettePosition(id, map)
	if pos and plain(pos.x) then
		for area, z in pairs(ns.guide.zones) do
			if z[2] == map then
				spot = { area = area, x = pos.x * 100, y = pos.y * 100 }
				break
			end
		end
	end
	announce(npc, plain(info.name) and info.name or "A rare", nil, false, nil, spot)
end
ns.On("VIGNETTE_MINIMAP_UPDATED", function(id, onMinimap)
	if onMinimap and plain(id) then
		pcall(vignette, id)
	end
end)
