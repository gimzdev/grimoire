-- Tooltips: where an item comes from, and what a creature drops.
local _, ns = ...

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

local LABEL = "|cff" .. ns.HEX.gilt .. "Grimoire|r  "

-- The comparison tooltips beside the main one show what you wear: no upgrade line there.
local function compares(tooltip)
	return tooltip == GameTooltip or tooltip == ItemRefTooltip
end

local function onItem(tooltip, data)
	if not (ns.db and ns.db.tooltipItems) or not data then
		return
	end
	local id = data.id
	if not plain(id) or type(id) ~= "number" then
		return
	end
	-- How much it adds for your build, then where it comes from: the label on the first line only.
	local lines = {}
	if ns.Gear and compares(tooltip) then
		local link = data.hyperlink
		if not (plain(link) and type(link) == "string") and tooltip.GetItem then
			local _, l = tooltip:GetItem()
			link = plain(l) and l or nil
		end
		local ok, text = pcall(ns.Gear.Text, link or id)
		if ok and text then
			lines[#lines + 1] = text
		end
	end
	local it = ns.items and ns.items[id]
	local m = not it and ns.minor and ns.minor[id]
	local source = it and ns.Gear.Source(it) or m and m[4]
	if source and source ~= "" then
		lines[#lines + 1] = ns.Hex(ns.HEX.text, source)
	end
	for i, line in ipairs(lines) do
		tooltip:AddLine((i == 1 and LABEL or "") .. line, 1, 1, 1, true)
	end
	if it and it[8] == "r" then
		tooltip:AddLine("Classic raid loot: not in Forever's launch raids", 0.64, 0.62, 0.58, true)
	end
end

local function onUnit(tooltip, data)
	if not (ns.db and ns.db.tooltipNpcs) or not data then
		return
	end
	local guid = data.guid
	if not plain(guid) or type(guid) ~= "string" then
		return
	end
	local kind, _, _, _, _, npcID = strsplit("-", guid)
	if kind ~= "Creature" and kind ~= "Vehicle" then
		return
	end
	local drops = ns.npcDrops and ns.npcDrops[tonumber(npcID or "")]
	if not drops then
		return
	end
	local parts = {}
	for _, row in ipairs(ns.ParseLoot(drops)) do
		local name, quality = ns.ItemInfo(row.id)
		if name then
			local text = ns.QualityText(quality, name) .. " " .. ns.Hex(ns.HEX.mist, ns.Chance(row.chance))
			if row.quest then
				text = text .. ns.Hex(ns.HEX.fog, " quest")
			end
			parts[#parts + 1] = text
		end
	end
	if #parts > 0 then
		tooltip:AddLine(LABEL .. ns.Hex(ns.HEX.mist, "Drops: ") .. table.concat(parts, ns.Hex(ns.HEX.fog, ", ")), 1, 1, 1, true)
	end
end

if TooltipDataProcessor and TooltipDataProcessor.AddTooltipPostCall and Enum and Enum.TooltipDataType then
	TooltipDataProcessor.AddTooltipPostCall(Enum.TooltipDataType.Item, function(tooltip, data)
		local ok, err = pcall(onItem, tooltip, data)
		if not ok and ns.debug then
			ns.Print("tooltip error: " .. tostring(err))
		end
	end)
	TooltipDataProcessor.AddTooltipPostCall(Enum.TooltipDataType.Unit, function(tooltip, data)
		local ok, err = pcall(onUnit, tooltip, data)
		if not ok and ns.debug then
			ns.Print("tooltip error: " .. tostring(err))
		end
	end)
end
