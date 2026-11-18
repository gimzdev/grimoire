-- At a merchant: your grey items are sold and your gear repaired (one setting; hold Shift as you talk to skip it).
local _, ns = ...

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

local getSlots = C_Container and C_Container.GetContainerNumSlots or GetContainerNumSlots
local getInfo = C_Container and C_Container.GetContainerItemInfo
local useItem = C_Container and C_Container.UseContainerItem or UseContainerItem
local itemInfo = (C_Item and C_Item.GetItemInfo) or GetItemInfo

--- The grey items in your bags that sell: { bag, slot, price } each.
local function junk()
	local out = {}
	if not (getSlots and useItem) then
		return out
	end
	for bag = 0, 4 do
		for slot = 1, getSlots(bag) or 0 do
			local quality, link, locked, noValue, count
			if getInfo then
				local info = getInfo(bag, slot)
				if info then
					quality, link, locked, noValue, count = info.quality, info.hyperlink, info.isLocked, info.hasNoValue, info.stackCount
				end
			elseif GetContainerItemInfo then
				local _, n, isLocked, q, _, _, l, _, none = GetContainerItemInfo(bag, slot)
				quality, link, locked, noValue, count = q, l, isLocked, none, n
			end
			if plain(quality) and quality == 0 and plain(link) and link and not locked and not noValue then
				local price = itemInfo and select(11, itemInfo(link))
				if plain(price) and price and price > 0 then
					out[#out + 1] = { bag, slot, price * (count or 1) }
				end
			end
		end
	end
	return out
end

local open = false
ns.On("MERCHANT_CLOSED", function()
	open = false
end)
ns.On("MERCHANT_SHOW", function()
	open = true
	if not (ns.db and ns.db.merchant ~= false) or (IsShiftKeyDown and IsShiftKeyDown()) then
		return
	end
	local repaired = 0
	if CanMerchantRepair and CanMerchantRepair() and GetRepairAllCost then
		local cost, can = GetRepairAllCost()
		if plain(cost) and cost and cost > 0 and can and GetMoney() >= cost then
			RepairAllItems()
			repaired = cost
		end
	end
	local list = junk()
	local sold = 0
	for _, j in ipairs(list) do
		sold = sold + j[3]
	end
	-- A few at a time, so the merchant takes every one.
	local i = 0
	local function step()
		for _ = 1, 6 do
			i = i + 1
			local j = list[i]
			if not j or not open then
				return
			end
			useItem(j[1], j[2])
		end
		if i < #list and C_Timer then
			C_Timer.After(0.2, step)
		end
	end
	step()
	local coins = (C_CurrencyInfo and C_CurrencyInfo.GetCoinTextureString) or GetMoneyString or GetCoinTextureString
	local said = {}
	if sold > 0 then
		said[#said + 1] = "sold " .. #list .. " grey item" .. (#list == 1 and "" or "s") .. " for " .. (coins and coins(sold) or sold)
	end
	if repaired > 0 then
		said[#said + 1] = "repaired for " .. (coins and coins(repaired) or repaired)
	end
	if #said > 0 then
		ns.Print(table.concat(said, ", ") .. ".")
	end
end)
