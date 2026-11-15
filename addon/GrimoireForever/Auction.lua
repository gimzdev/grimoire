-- The auction house: what things sell for there. A full scan reads every auction at once (the game allows one every
-- 15 minutes, for the whole account) and keeps each item's lowest price per unit, for this realm and faction; every item
-- the selling tab looks up (UI/AuctionSell.lua), and every price the game's own Buy tab shows you, refreshes it. Item
-- tooltips show the price (Tooltip.lua).
-- Also here: the things in your bags the auction house takes, and posting them, for the selling tab.
--
-- Within the game's rules, as Blizzard's own auction window works: a full scan or a search goes out only when you click
-- (one search more after each post, to show your new auction), the game's limits on both are kept, and each auction is
-- posted by a click of yours (the game posts nothing without one). Nothing here buys, bids or cancels.
local _, ns = ...

local A = {}
ns.Auction = A

local AH = C_AuctionHouse
local CHUNK = 2000 -- auctions read per frame during a scan, so the game does not stall
A.SCAN_EVERY = 15 * 60 -- the game's limit between two full scans, for the whole account
local SCAN_ANSWER = 60 -- seconds to wait for the auction house to answer a full scan

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

--- Whether this auction house takes prices in copper; when not, prices are whole silver.
function A.CopperOK()
	if AH and AH.SupportsCopperValues then
		return AH.SupportsCopperValues() == true
	end
	return true
end

--- A price the auction house takes: whole silver (at least one) where it wants that.
function A.Fit(copper)
	copper = math.floor((copper or 0) + 0.5)
	if A.CopperOK() then
		return math.max(1, copper)
	end
	return math.max(100, math.floor(copper / 100) * 100)
end

-- Prices ---------------------------------------------------------------------------------------------------------

--- This realm and faction's prices: { p = { [item id] = copper per unit }, full = time of the last full scan, n =
--- auctions it read }.
function A.Book()
	if not ns.db then
		return nil
	end
	ns.db.ah = ns.db.ah or {}
	local realm = GetRealmName and GetRealmName() or "?"
	local faction = UnitFactionGroup and UnitFactionGroup("player") or ""
	local key = realm .. "-" .. (plain(faction) and faction or "")
	ns.db.ah[key] = ns.db.ah[key] or { p = {} }
	return ns.db.ah[key]
end

--- An item's lowest price per unit at the last look, in copper, or nil.
function A.Price(id)
	local b = A.Book()
	return b and id and b.p[id] or nil
end

function A.SetPrice(id, copper)
	local b = A.Book()
	if b and id and copper and copper > 0 then
		b.p[id] = math.floor(copper + 0.5)
	end
end

-- Full scan --------------------------------------------------------------------------------------------------------

local scan -- { mins = { [id] = lowest unit price }, n = auctions to read (once the game has them), i = next index, read }
A.note = nil -- why the last full scan did not happen, for the selling tab

--- Seconds before the next full scan is allowed (0: now). The game counts for the whole account.
function A.ScanWait()
	if scan then
		return A.SCAN_EVERY
	end
	local last = ns.db and ns.db.ahScanAt
	return last and math.max(0, last + A.SCAN_EVERY - time()) or 0
end

function A.Scanning()
	return scan ~= nil, scan and scan.n and scan.i or 0, scan and scan.n or 0
end

--- Starts a full scan, from a click; false and why when it cannot.
function A.Scan()
	if not (AH and AH.ReplicateItems and AH.GetNumReplicateItems and AH.GetReplicateItemInfo) then
		return false, "This client has no full scan."
	end
	if scan then
		return false, "A scan is running."
	end
	local wait = A.ScanWait()
	if wait > 0 then
		return false, "The game allows a full scan every 15 minutes: the next in " .. math.ceil(wait / 60) .. " min."
	end
	scan = { mins = {}, i = 0, read = 0 }
	A.note = nil
	if ns.db then
		ns.db.ahScanAt = time()
	end
	AH.ReplicateItems()
	local mine = scan
	C_Timer.After(SCAN_ANSWER, function()
		if scan == mine and not scan.n then
			-- The game says nothing when its limit is not over: a scan by another add-on, or on another character,
			-- counts too.
			scan = nil
			A.note = "The auction house did not answer: a full scan in the last 15 minutes (by another add-on or character too) holds the next one back."
			ns.Send("AUCTION")
		end
	end)
	ns.Send("AUCTION")
	return true
end

local function finish()
	local b = A.Book()
	if b and scan then
		for id, unit in pairs(scan.mins) do
			b.p[id] = math.floor(unit + 0.5)
		end
		b.full, b.n = time(), scan.read
	end
	scan = nil
	ns.Send("AUCTION")
end

ns.On("REPLICATE_ITEM_LIST_UPDATE", function()
	if scan and not scan.n then
		scan.n = AH.GetNumReplicateItems() or 0
	end
end)

-- The auctions are read a chunk per frame; the game numbers them from 0 to n - 1.
local reader = CreateFrame("Frame")
reader:SetScript("OnUpdate", function()
	if not (scan and scan.n) then
		return
	end
	local last = math.min(scan.n - 1, scan.i + CHUNK - 1)
	for i = scan.i, last do
		local _, _, count, _, _, _, _, _, _, buyout, _, _, _, _, _, _, id = AH.GetReplicateItemInfo(i)
		if plain(id) and id and plain(buyout) and buyout and buyout > 0 and plain(count) and count and count > 0 then
			local unit = buyout / count
			if not scan.mins[id] or unit < scan.mins[id] then
				scan.mins[id] = unit
			end
			scan.read = scan.read + 1
		end
	end
	scan.i = last + 1
	if scan.i >= scan.n then
		finish()
	elseif scan.i % (CHUNK * 5) < CHUNK then
		ns.Send("AUCTION")
	end
end)

-- One item's auctions -----------------------------------------------------------------------------------------------

local current -- the item looked up: { id, key, commodity }
local waiting -- a look-up held back until the game takes questions again
A.rows = {} -- its auctions, cheapest first: { unit, quantity, mine, bid, buyout, level }

local function sameKey(a, b)
	return a and b and a.itemID == b.itemID and (a.itemLevel or 0) == (b.itemLevel or 0) and (a.itemSuffix or 0) == (b.itemSuffix or 0) and (a.battlePetSpeciesID or 0) == (b.battlePetSpeciesID or 0)
end

local function send()
	if not waiting or not AH then
		return
	end
	if AH.IsThrottledMessageSystemReady and not AH.IsThrottledMessageSystemReady() then
		return -- AUCTION_HOUSE_THROTTLED_SYSTEM_READY sends it
	end
	current, waiting = waiting, nil
	local sorts = { { sortOrder = Enum.AuctionHouseSortOrder.Price, reverseSort = false } }
	if AH.SendSellSearchQuery then
		AH.SendSellSearchQuery(current.key, sorts, true)
	else
		AH.SendSearchQuery(current.key, sorts, true)
	end
end

ns.On("AUCTION_HOUSE_THROTTLED_SYSTEM_READY", send)

local getSlots = C_Container and C_Container.GetContainerNumSlots
local getInfo = C_Container and C_Container.GetContainerItemInfo
local COMMODITY = Enum and Enum.ItemCommodityStatus

--- Where an entry is now, its kind (commodity or not) read again: nil and why when its slot no longer holds it, or the
--- game has not loaded it yet.
local function locate(e)
	if not (e and AH and ItemLocation and getInfo) then
		return nil
	end
	local info = getInfo(e.bag, e.slot)
	if not (info and plain(info.hyperlink) and info.hyperlink == e.link) then
		return nil, "Your bags changed: pick it again."
	end
	local loc = ItemLocation:CreateFromBagAndSlot(e.bag, e.slot)
	local status = AH.GetItemCommodityStatus and AH.GetItemCommodityStatus(loc)
	if COMMODITY and status == COMMODITY.Unknown then
		return nil, "The game is still loading this item: try again in a moment."
	end
	if COMMODITY and status ~= nil then
		e.commodity = status == COMMODITY.Commodity
	end
	if AH.GetItemKeyFromItem then
		e.key = AH.GetItemKeyFromItem(loc) or e.key
	end
	return loc
end

--- Looks up an item's auctions (an entry of A.Sellable()), from a click; "AUCTION_ROWS" says when they are in A.rows.
function A.Lookup(entry)
	A.rows = {}
	if not (entry and AH and (AH.SendSellSearchQuery or AH.SendSearchQuery)) then
		return
	end
	locate(entry)
	if not entry.key then
		return
	end
	waiting = { id = entry.id, key = entry.key, commodity = entry.commodity }
	send()
end

local function settle(rows)
	table.sort(rows, function(a, b)
		if a.unit and b.unit and a.unit ~= b.unit then
			return a.unit < b.unit
		end
		return (a.unit and 1 or 0) > (b.unit and 1 or 0)
	end)
	A.rows = rows
	if rows[1] and rows[1].unit then
		A.SetPrice(current.id, rows[1].unit)
	end
	ns.Send("AUCTION_ROWS")
end

-- The lowest price per unit among rows, or nil.
local function lowest(rows)
	local low
	for _, r in ipairs(rows) do
		if r.unit and r.unit > 0 and (not low or r.unit < low) then
			low = r.unit
		end
	end
	return low
end

-- A search's answer: the selling tab's own look-up settles its rows; any other search (the game's Buy tab) only keeps
-- the price for tooltips.
ns.On("COMMODITY_SEARCH_RESULTS_UPDATED", function(id)
	if not (AH and plain(id) and id) then
		return
	end
	local rows = {}
	for i = 1, AH.GetNumCommoditySearchResults(id) or 0 do
		local r = AH.GetCommoditySearchResultInfo(id, i)
		if r then
			rows[#rows + 1] = { unit = r.unitPrice, quantity = r.quantity or 0, mine = r.containsOwnerItem or (r.numOwnerItems or 0) > 0 }
		end
	end
	if current and current.commodity and id == current.id then
		settle(rows)
	else
		A.SetPrice(id, lowest(rows))
	end
end)

ns.On("ITEM_SEARCH_RESULTS_UPDATED", function(key)
	if not (AH and type(key) == "table" and plain(key.itemID) and key.itemID) then
		return
	end
	local mine = current and not current.commodity and sameKey(key, current.key)
	local rows = {}
	for i = 1, AH.GetNumItemSearchResults(key) or 0 do
		local r = AH.GetItemSearchResultInfo(key, i)
		if r then
			local q = r.quantity or 1
			rows[#rows + 1] = {
				unit = r.buyoutAmount and r.buyoutAmount > 0 and r.buyoutAmount / q or nil,
				buyout = r.buyoutAmount,
				bid = r.bidAmount or r.minBid,
				quantity = q,
				mine = r.containsOwnerItem,
				level = r.itemKey and r.itemKey.itemLevel,
			}
		end
	end
	if mine then
		settle(rows)
	else
		A.SetPrice(key.itemID, lowest(rows))
	end
end)

-- The game's Buy tab: the lowest prices it lists as you browse are kept for tooltips too. Nothing more is asked of the
-- auction house: these are the answers to your own searches.
ns.On("AUCTION_HOUSE_BROWSE_RESULTS_UPDATED", function()
	if not (AH and AH.GetBrowseResults) then
		return
	end
	local low = {}
	for _, r in ipairs(AH.GetBrowseResults() or {}) do
		local key, price = r.itemKey, r.minPrice
		if key and plain(key.itemID) and key.itemID and (key.battlePetSpeciesID or 0) == 0 and plain(price) and price and price > 0 then
			if not low[key.itemID] or price < low[key.itemID] then
				low[key.itemID] = price
			end
		end
	end
	for id, price in pairs(low) do
		A.SetPrice(id, price)
	end
end)

--- The price to ask per unit: a copper under the cheapest auction that is not yours (a silver under, when every price
--- there is in whole silver, or the auction house takes whole silver only), else yours, else the last price seen. Nil
--- when nothing is known.
function A.Suggest(id, rows)
	rows = rows or A.rows
	local cheapest, mine, wholeSilver = nil, nil, true
	for _, r in ipairs(rows) do
		if r.unit then
			if r.unit % 100 ~= 0 then
				wholeSilver = false
			end
			if r.mine then
				mine = mine or r.unit
			elseif not cheapest then
				cheapest = r.unit
			end
		end
	end
	if cheapest then
		if mine and mine <= cheapest then
			return A.Fit(mine)
		end
		local step = ((wholeSilver and cheapest > 100) or not A.CopperOK()) and 100 or 1
		return A.Fit(math.floor(cheapest) - step)
	end
	local known = mine or A.Price(id)
	return known and A.Fit(known) or nil
end

-- Your bags ---------------------------------------------------------------------------------------------------------

-- The order of the groups in the selling tab: weapons, armour, consumables, trade goods, recipes, gems, reagents,
-- containers, then the rest.
local CLASS_ORDER = { [2] = 1, [4] = 2, [0] = 3, [7] = 4, [9] = 5, [3] = 6, [5] = 7, [1] = 8 }

--- What in your bags the auction house takes: groups { name, items = { { id, link, icon, quality, count, bag, slot,
--- key, commodity } } }, each thing once with its count across your bags.
function A.Sellable()
	local byLink, list = {}, {}
	if not (getSlots and getInfo and ItemLocation) then
		return {}
	end
	for bag = 0, NUM_BAG_SLOTS or 4 do
		for slot = 1, getSlots(bag) or 0 do
			local info = getInfo(bag, slot)
			if info and plain(info.itemID) and info.itemID and not info.isBound and plain(info.hyperlink) then
				local loc = ItemLocation:CreateFromBagAndSlot(bag, slot)
				local ok = not (AH and AH.IsSellItemValid) or AH.IsSellItemValid(loc, false)
				if ok then
					local e = byLink[info.hyperlink]
					if e then
						e.count = e.count + (info.stackCount or 1)
					else
						e = { id = info.itemID, link = info.hyperlink, icon = info.iconFileID, quality = info.quality, count = info.stackCount or 1, bag = bag, slot = slot }
						e.key = AH and AH.GetItemKeyFromItem and AH.GetItemKeyFromItem(loc) or (AH and AH.MakeItemKey and AH.MakeItemKey(info.itemID))
						local status = AH and AH.GetItemCommodityStatus and AH.GetItemCommodityStatus(loc)
						e.commodity = COMMODITY and status == COMMODITY.Commodity or false
						byLink[info.hyperlink] = e
						list[#list + 1] = e
					end
				end
			end
		end
	end
	local groups, byClass = {}, {}
	local instant = C_Item and C_Item.GetItemInfoInstant or GetItemInfoInstant
	for _, e in ipairs(list) do
		local _, kind, _, _, _, classID = instant(e.id)
		classID = classID or 15
		local g = byClass[classID]
		if not g then
			g = { name = kind or "Other", class = classID, items = {} }
			byClass[classID] = g
			groups[#groups + 1] = g
		end
		g.items[#g.items + 1] = e
	end
	table.sort(groups, function(a, b)
		local x, y = CLASS_ORDER[a.class] or 99, CLASS_ORDER[b.class] or 99
		if x ~= y then
			return x < y
		end
		return a.name < b.name
	end)
	for _, g in ipairs(groups) do
		table.sort(g.items, function(a, b)
			if (a.quality or 0) ~= (b.quality or 0) then
				return (a.quality or 0) > (b.quality or 0)
			end
			return a.link < b.link
		end)
	end
	return groups
end

-- Posting ----------------------------------------------------------------------------------------------------------

--- The durations the auction house offers, as the game names them.
function A.Durations()
	return { _G.AUCTION_DURATION_ONE or "2 Hours", _G.AUCTION_DURATION_TWO or "8 Hours", _G.AUCTION_DURATION_THREE or "24 Hours" }
end

--- The most of an entry one post takes, as the game counts it.
function A.MaxQuantity(e)
	if not e then
		return 0
	end
	if AH and AH.GetAvailablePostCount and ItemLocation then
		local info = getInfo and getInfo(e.bag, e.slot)
		if info and plain(info.hyperlink) and info.hyperlink == e.link then
			local n = AH.GetAvailablePostCount(ItemLocation:CreateFromBagAndSlot(e.bag, e.slot))
			if plain(n) and n and n > 0 then
				return n
			end
		end
	end
	if e.commodity then
		return e.count
	end
	local info = getInfo and getInfo(e.bag, e.slot)
	return info and info.stackCount or 1
end

--- The deposit for an entry, or nil when the game does not say.
function A.Deposit(e, duration, quantity)
	if not (e and AH and quantity and quantity > 0) then
		return nil
	end
	if e.commodity and AH.CalculateCommodityDeposit then
		return AH.CalculateCommodityDeposit(e.id, duration, quantity)
	elseif not e.commodity and AH.CalculateItemDeposit and ItemLocation then
		local info = getInfo and getInfo(e.bag, e.slot)
		if info and plain(info.hyperlink) and info.hyperlink == e.link then
			return AH.CalculateItemDeposit(ItemLocation:CreateFromBagAndSlot(e.bag, e.slot), duration, quantity)
		end
	end
	return nil
end

local pending -- a post the game wants confirmed (its price is far from the market)

--- Posts quantity of an entry at unit copper each (an item: unit is each auction's buyout, as in the game's own
--- window). Must run from a click: the game posts nothing otherwise. Returns "posted", or "confirm" when the game asks
--- first (A.Confirm, from a click, posts it), or nil and why not.
function A.Post(e, quantity, unit, duration)
	pending = nil
	if not (AH and quantity and quantity > 0 and unit and unit > 0) then
		return nil
	end
	local loc, why = locate(e)
	if not loc then
		return nil, why
	end
	quantity = math.min(quantity, A.MaxQuantity(e))
	unit = A.Fit(unit)
	local post = { commodity = e.commodity, loc = loc, duration = duration, quantity = quantity, unit = unit }
	local ask
	if e.commodity then
		ask = AH.PostCommodity(loc, duration, quantity, unit)
	else
		ask = AH.PostItem(loc, duration, quantity, nil, unit)
	end
	if ask then
		pending = post
		return "confirm"
	end
	return "posted"
end

--- Whether a post waits for A.Confirm.
function A.Pending()
	return pending ~= nil
end

--- Forgets a post the game asked about.
function A.Drop()
	pending = nil
end

--- Posts the post the game asked about. Must run from a click.
function A.Confirm()
	local p = pending
	pending = nil
	if not (p and AH) then
		return false
	end
	if p.commodity then
		AH.ConfirmPostCommodity(p.loc, p.duration, p.quantity, p.unit)
	else
		AH.ConfirmPostItem(p.loc, p.duration, p.quantity, nil, p.unit)
	end
	return true
end

ns.On("AUCTION_HOUSE_AUCTION_CREATED", function()
	ns.Send("AUCTION_POSTED")
end)

ns.On("AUCTION_HOUSE_CLOSED", function()
	pending, waiting, current = nil, nil, nil
	-- What a scan read so far still counts.
	if scan and scan.n then
		finish()
	elseif scan then
		scan = nil
	end
end)
