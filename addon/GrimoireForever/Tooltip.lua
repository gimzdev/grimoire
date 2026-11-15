-- Tooltips, kept short. An item: what a vendor pays, its price on the auction house (Auction.lua) and how often it drops.
-- A creature: its three likeliest drops.
local _, ns = ...

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

local LABEL = { 0.95, 0.71, 0.25 } -- the labels, in Grimoire's gold
local DROPS_SHOWN = 3

local itemInfo = (C_Item and C_Item.GetItemInfo) or GetItemInfo

-- Whether the game's own tooltip shows the sell price: only when it has drawn it, as a money line (SetTooltipMoney counts
-- those in shownMoneyFrames). The tooltip's data carries a sell price line for every item, but Forever draws it only in
-- some places (at a vendor), and never on a comparison tooltip, so the data alone does not say.
local function showsSellPrice(tooltip)
	if tooltip.isShopping then
		return false
	end
	local shown = tooltip.shownMoneyFrames
	return type(shown) == "number" and shown > 0
end

--- An item's drop rate and the creature it drops from most, from Grimoire's data ("Drop: Name (Zone), 12%").
function ns.DropRate(id)
	local it = ns.items and ns.items[id]
	local source = it and ns.Gear and ns.Gear.Source(it) or (ns.minor and ns.minor[id] and ns.minor[id][4])
	if type(source) ~= "string" then
		return nil
	end
	local who, chance = source:match("^Drop: (.-), ([<%d%.]+%%)$")
	if not who then
		return nil
	end
	return chance, (who:gsub(" %b()$", ""))
end

local function line(tooltip, label, value)
	tooltip:AddDoubleLine(label, value, LABEL[1], LABEL[2], LABEL[3], 1, 1, 1)
end

local function onItem(tooltip, data)
	if not (ns.db and ns.db.tooltipItems) or not data then
		return
	end
	local id = data.id
	if not plain(id) or type(id) ~= "number" then
		return
	end
	local vendor = itemInfo and select(11, itemInfo(id))
	if plain(vendor) and vendor and vendor > 0 and not showsSellPrice(tooltip) then
		line(tooltip, "Vendor", ns.Money(vendor))
	end
	local auction = ns.Auction and ns.Auction.Price(id)
	if auction then
		line(tooltip, "Auction", ns.Money(auction))
	end
	local chance, who = ns.DropRate(id)
	if chance then
		line(tooltip, "Drop rate", chance .. ns.Hex(ns.HEX.fog, "  " .. who))
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
	local rows = ns.ParseLoot(drops)
	table.sort(rows, function(a, b)
		return a.chance > b.chance
	end)
	local parts = {}
	for _, row in ipairs(rows) do
		local name, quality = ns.ItemInfo(row.id)
		if name then
			parts[#parts + 1] = ns.QualityText(quality, name) .. " " .. ns.Hex(ns.HEX.mist, ns.Chance(row.chance))
			if #parts == DROPS_SHOWN then
				break
			end
		end
	end
	if #parts > 0 then
		tooltip:AddLine(ns.Hex(ns.HEX.gilt, "Drops  ") .. table.concat(parts, ns.Hex(ns.HEX.fog, ", ")), 1, 1, 1, true)
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
