-- Grimoire's page in the game's Options window (AddOns tab).
local _, ns = ...
local UI = ns.UI

local function register()
	if not (Settings and Settings.RegisterCanvasLayoutCategory and Settings.RegisterAddOnCategory) then
		return
	end
	local panel = CreateFrame("Frame")
	panel:Hide()
	local mark = panel:CreateTexture(nil, "ARTWORK")
	mark:SetTexture(UI.MEDIA .. "Emblem.tga")
	mark:SetSize(30, 30)
	mark:SetPoint("TOPLEFT", 16, -14)
	local title = UI.Text(panel, 23, ns.RGB.white, { weight = "mark" })
	title:SetPoint("LEFT", mark, "RIGHT", 9, 0)
	title:SetText("Grimoire")
	local sub = UI.Text(panel, 12, ns.RGB.mist)
	sub:SetPoint("TOPLEFT", 16, -52)
	sub:SetText("The WoW Forever field guide. Type /grim to open it.")
	local doc = UI.Document(panel)
	doc:SetPoint("TOPLEFT", 16, -82)
	doc:SetPoint("BOTTOMRIGHT", -16, 16)
	local function blocks()
		local list = ns.OptionBlocks()
		list[#list + 1] = { "space", 8 }
		list[#list + 1] = { "buttons", { { "Open Grimoire", function()
			ns.Open()
		end, true } } }
		return list
	end
	panel:SetScript("OnShow", function()
		ns.ShowOptions(doc, blocks)
	end)
	local ok, category = pcall(Settings.RegisterCanvasLayoutCategory, panel, "Grimoire")
	if ok and category then
		pcall(Settings.RegisterAddOnCategory, category)
		ns.settingsCategory = category
	end
end

ns.Listen("LOGIN", function()
	local ok = pcall(register)
	if not ok and ns.debug then
		ns.Print("could not add Grimoire to the Options window.")
	end
end)
