-- The minimap button: click to open Grimoire, drag to move it around the minimap.
local _, ns = ...

local button

local function place()
	local angle = math.rad(ns.db.minimap.angle or 215)
	local radius = (Minimap:GetWidth() / 2) + 6
	button:ClearAllPoints()
	button:SetPoint("CENTER", Minimap, "CENTER", math.cos(angle) * radius, math.sin(angle) * radius)
end

local function create()
	button = CreateFrame("Button", "GrimoireForeverMinimapButton", Minimap)
	button:SetSize(31, 31)
	button:SetFrameStrata("MEDIUM")
	button:SetFrameLevel(8)
	button:RegisterForClicks("LeftButtonUp", "RightButtonUp")
	button:RegisterForDrag("LeftButton")
	button:SetHighlightTexture("Interface\\Minimap\\UI-Minimap-ZoomButton-Highlight")
	-- Grimoire's emblem on the dark disc every minimap button has.
	local back = button:CreateTexture(nil, "BACKGROUND")
	back:SetTexture("Interface\\Minimap\\UI-Minimap-Background")
	back:SetSize(22, 22)
	back:SetPoint("TOPLEFT", 5, -5)
	local icon = button:CreateTexture(nil, "ARTWORK")
	icon:SetTexture("Interface\\AddOns\\" .. ns.ADDON .. "\\Media\\Emblem.tga")
	icon:SetSize(20, 20)
	icon:SetPoint("TOPLEFT", 6, -6)
	local border = button:CreateTexture(nil, "OVERLAY")
	border:SetTexture("Interface\\Minimap\\MiniMap-TrackingBorder")
	border:SetSize(53, 53)
	border:SetPoint("TOPLEFT")
	button:SetScript("OnClick", function(_, mouse)
		if mouse == "RightButton" then
			ns.Open("about")
		else
			ns.Toggle()
		end
	end)
	button:SetScript("OnDragStart", function(self)
		self:SetScript("OnUpdate", function()
			local mx, my = Minimap:GetCenter()
			local cx, cy = GetCursorPosition()
			local scale = Minimap:GetEffectiveScale()
			cx, cy = cx / scale, cy / scale
			ns.db.minimap.angle = math.deg(math.atan2(cy - my, cx - mx)) % 360
			place()
		end)
	end)
	button:SetScript("OnDragStop", function(self)
		self:SetScript("OnUpdate", nil)
	end)
	button:SetScript("OnEnter", function(self)
		GameTooltip:SetOwner(self, "ANCHOR_LEFT")
		GameTooltip:SetText("Grimoire")
		GameTooltip:AddLine("Click to open the field guide.", 1, 1, 1)
		GameTooltip:AddLine("Right-click for options. Drag to move.", 0.64, 0.62, 0.58)
		GameTooltip:Show()
	end)
	button:SetScript("OnLeave", function()
		GameTooltip:Hide()
	end)
end

function ns.UpdateMinimapButton()
	if not Minimap or not ns.db then
		return
	end
	if ns.db.minimap.hide then
		if button then
			button:Hide()
		end
		return
	end
	if not button then
		create()
	end
	place()
	button:Show()
end

ns.Listen("LOGIN", function()
	ns.UpdateMinimapButton()
end)
