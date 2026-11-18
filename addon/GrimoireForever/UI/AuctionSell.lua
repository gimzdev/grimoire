-- The Grimoire tab at the auction house: selling, after Auctionator's. On the left, everything in your bags the auction
-- house takes, by kind; pick one and the right shows what it sells for now, the price to ask (a copper under the
-- cheapest that is not yours), the quantity, the duration and Post. The full scan for the tooltips' prices is here too.
-- Auction.lua does the work, within the game's rules: every search and every post comes from a click here.
--
-- The tab sits beside the game's own tabs without touching them: a button of Grimoire's own, and a panel over the
-- auction house's page; any of the game's tabs puts the game's page back.
local _, ns = ...
local UI = ns.UI
local A = ns.Auction

local LEFT_W = 252
local ICON, GAP, PER_ROW = 32, 6, 6
local ROWS = 9 -- current auctions listed

local panel, tab
local selected -- the entry picked (Auction.Sellable)
local edited = false -- the price was typed: auctions coming in no longer change it

local function number(e)
	return tonumber(e:GetText() or "") or 0
end

-- The price and quantity -----------------------------------------------------------------------------------------

local function unitPrice()
	local copper = panel.copper:IsShown() and number(panel.copper) or 0
	return number(panel.gold) * 10000 + number(panel.silver) * 100 + copper
end

local function setPrice(copper)
	copper = math.max(0, math.floor(copper or 0))
	panel.setting = true
	panel.gold:SetText(copper >= 10000 and tostring(math.floor(copper / 10000)) or "")
	panel.silver:SetText(copper >= 100 and tostring(math.floor(copper % 10000 / 100)) or "")
	panel.copper:SetText(panel.copper:IsShown() and tostring(copper % 100) or "")
	panel.setting = false
end

local function quantity()
	return math.max(0, math.min(number(panel.qty), A.MaxQuantity(selected)))
end

-- The game's own choice of duration, which its sell window keeps too.
local function duration()
	local d = tonumber(GetCVar and GetCVar("auctionHouseDurationDropdown") or "")
	return (d and d >= 1 and d <= 3) and d or 2
end

local function resetPost()
	A.Drop()
	panel.post:SetLabel("Post")
	panel.status:SetText("")
end

--- Deposit, total and whether Post can go.
local function summary()
	local q, unit = quantity(), unitPrice()
	local deposit = selected and q > 0 and A.Deposit(selected, duration(), q)
	panel.deposit:SetText("Deposit  " .. (deposit and ns.Money(deposit) or ns.Hex(ns.HEX.fog, "-")))
	panel.total:SetText("Total  " .. (q > 0 and unit > 0 and ns.Money(unit * q) or ns.Hex(ns.HEX.fog, "-")))
	panel.post:SetEnabled(selected ~= nil and q > 0 and unit > 0)
	for i, chip in ipairs(panel.durations) do
		chip:SetSelected(i == duration())
	end
end

-- What it sells for now ---------------------------------------------------------------------------------------------

local function drawRows()
	local rows = A.rows or {}
	local items = selected and not selected.commodity
	panel.levelHead:SetShown(items and true or false)
	for i, row in ipairs(panel.rows) do
		local r = rows[i]
		if r and selected then
			row.price:SetText(r.unit and ns.Money(r.unit) or ns.Hex(ns.HEX.fog, "bid only"))
			row.qty:SetText(tostring(r.quantity or 1))
			row.level:SetText(items and r.level and r.level > 0 and tostring(r.level) or "")
			row.mine:SetText(r.mine and "yours" or "")
			row:Show()
		else
			row:Hide()
		end
	end
	if not selected then
		panel.listNote:SetText("Pick something on the left.")
	elseif #rows == 0 then
		panel.listNote:SetText(panel.looking and "Looking it up..." or "None on sale: the price is yours to set.")
	elseif #rows > ROWS then
		panel.listNote:SetText((#rows - ROWS) .. " more, dearer.")
	else
		panel.listNote:SetText("")
	end
end

-- Picking an item ------------------------------------------------------------------------------------------------

local function ringSelected()
	for _, b in ipairs(panel.slots or {}) do
		b.ring:SetShown(b.entry ~= nil and selected ~= nil and b.entry.link == selected.link)
	end
end

local function pick(entry)
	selected = entry
	edited = false
	resetPost()
	if entry then
		local name = C_Item and C_Item.GetItemInfo and C_Item.GetItemInfo(entry.link)
		panel.icon:SetIcon(entry.icon, entry.quality)
		panel.icon:Show()
		panel.name:SetText(ns.QualityText(entry.quality or 1, name or entry.link))
		panel.have:SetText("In your bags: " .. entry.count)
		panel.qty:SetText(tostring(A.MaxQuantity(entry)))
		setPrice(A.Suggest(entry.id, {}) or 0)
		panel.looking = true
		A.Lookup(entry)
	else
		panel.icon:Hide()
		panel.name:SetText(ns.Hex(ns.HEX.fog, "Nothing picked"))
		panel.have:SetText("")
		panel.qty:SetText("")
		setPrice(0)
		panel.looking = false
		A.rows = {}
	end
	ringSelected()
	summary()
	drawRows()
end

-- Your bags, on the left -------------------------------------------------------------------------------------------

local function slotButton(parent)
	local b = CreateFrame("Button", nil, parent)
	b:SetSize(ICON, ICON)
	b.ring = b:CreateTexture(nil, "BACKGROUND")
	b.ring:SetColorTexture(0.95, 0.71, 0.25, 0.9)
	b.ring:SetPoint("TOPLEFT", -2, 2)
	b.ring:SetPoint("BOTTOMRIGHT", 2, -2)
	b.ring:Hide()
	b.icon = UI.Icon(b, ICON)
	b.icon:SetAllPoints()
	b.icon:EnableMouse(false)
	b.count = UI.Text(b, 11, ns.RGB.white, { weight = "bold", outline = "OUTLINE", justify = "RIGHT" })
	b.count:SetPoint("BOTTOMRIGHT", -2, 2)
	b:SetScript("OnClick", function(self)
		pick(self.entry)
	end)
	b:SetScript("OnEnter", function(self)
		if self.entry then
			GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
			GameTooltip:SetBagItem(self.entry.bag, self.entry.slot)
			GameTooltip:Show()
		end
	end)
	b:SetScript("OnLeave", function()
		GameTooltip:Hide()
	end)
	return b
end

local function drawBags()
	local content = panel.content
	local groups = A.Sellable()
	panel.slots = panel.slots or {}
	panel.heads = panel.heads or {}
	for _, b in ipairs(panel.slots) do
		b:Hide()
		b.entry = nil
	end
	for _, h in ipairs(panel.heads) do
		h:Hide()
	end
	local y, s, still = 0, 0, nil
	for gi, g in ipairs(groups) do
		local h = panel.heads[gi] or UI.Text(content, 11, ns.RGB.mist, { weight = "medium" })
		panel.heads[gi] = h
		h:ClearAllPoints()
		h:SetPoint("TOPLEFT", 0, -y)
		h:SetText(g.name)
		h:Show()
		y = y + 18
		for i, e in ipairs(g.items) do
			s = s + 1
			local b = panel.slots[s] or slotButton(content)
			panel.slots[s] = b
			local col, row = (i - 1) % PER_ROW, math.floor((i - 1) / PER_ROW)
			b:ClearAllPoints()
			b:SetPoint("TOPLEFT", col * (ICON + GAP), -(y + row * (ICON + GAP)))
			b.entry = e
			b.icon:SetIcon(e.icon, e.quality)
			b.count:SetText(e.count > 1 and tostring(e.count) or "")
			b:Show()
			if selected and e.link == selected.link then
				still = e
			end
		end
		y = y + math.ceil(#g.items / PER_ROW) * (ICON + GAP) + 8
	end
	content:SetHeight(math.max(1, y))
	panel.empty:SetShown(#groups == 0)
	if selected and not still then
		pick(nil)
	elseif still then
		selected = still -- its count and slot may have moved
		panel.have:SetText("In your bags: " .. still.count)
		ringSelected()
		summary()
	end
end

-- The full scan, at the top ---------------------------------------------------------------------------------------

local function scanText()
	local running, done, total = A.Scanning()
	if running then
		return total > 0 and string.format("Reading %d of %d auctions...", done, total) or "Asking the auction house..."
	end
	if A.note then
		return ns.Hex(ns.HEX.gold, A.note)
	end
	local b = A.Book()
	if b and b.full then
		local mins = math.floor((time() - b.full) / 60)
		local age = mins < 1 and "just now" or mins < 60 and (mins .. " min ago") or mins < 1440 and (math.floor(mins / 60) .. " h ago") or (math.floor(mins / 1440) .. " days ago")
		return "Tooltip prices from " .. (b.n or 0) .. " auctions, " .. age
	end
	return "No full scan yet: it gives every item's price in its tooltip."
end

local function drawScan()
	panel.scanInfo:SetText(scanText())
	local wait = A.ScanWait()
	panel.scan:SetEnabled(wait <= 0)
	panel.scan.tip = wait > 0 and ("The next full scan in " .. math.ceil(wait / 60) .. " min: the game allows one every 15 minutes.") or "Reads every auction now, for the prices in your tooltips."
end

local function drawMoney()
	panel.money:SetText(ns.Money(GetMoney and GetMoney() or 0))
end

-- Building the panel ----------------------------------------------------------------------------------------------------

local function moneyBox(parent, width, coin, color, letters)
	local e = CreateFrame("EditBox", nil, parent)
	e:SetSize(width, 26)
	UI.Field(e, 6)
	e:SetTextInsets(8, 8, 0, 0)
	e:SetNumeric(true)
	e:SetMaxLetters(letters)
	e:SetJustifyH("RIGHT")
	e.coin = UI.Text(parent, 11, color, { weight = "bold" })
	e.coin:SetPoint("LEFT", e, "RIGHT", 4, 0)
	e.coin:SetText(coin)
	e:SetScript("OnTextChanged", function(_, user)
		if user and not panel.setting then
			edited = true
			resetPost()
		end
		summary()
	end)
	e:SetScript("OnEnterPressed", e.ClearFocus)
	e:SetScript("OnEscapePressed", e.ClearFocus)
	return e
end

local function label(parent, text, x, y)
	local t = UI.Text(parent, 11, ns.RGB.mist)
	t:SetPoint("TOPLEFT", x, y)
	t:SetText(text)
	return t
end

local function build()
	local host = AuctionHouseFrame
	local p = CreateFrame("Frame", "GrimoireForeverAuction", host)
	p:SetPoint("TOPLEFT", host, "TOPLEFT", 4, -28)
	p:SetPoint("BOTTOMRIGHT", host, "BOTTOMRIGHT", -4, 4)
	-- Over the auction house's page; under its portrait and dialogs, which sit far higher.
	p:SetFrameLevel((host:GetFrameLevel() or 1) + 40)
	p:EnableMouse(true)
	UI.Surface(p, 6, { 0.065, 0.07, 0.08, 1 }, { 1, 1, 1, 0.08 })
	panel = p

	-- Top: the full scan.
	p.scan = UI.Button(p, "Full scan", 96, 26, function()
		local ok, why = A.Scan()
		if not ok and why then
			A.note = why
		end
		drawScan()
	end)
	p.scan:SetPoint("TOPRIGHT", -10, -8)
	p.scanInfo = UI.Text(p, 11, ns.RGB.mist, { justify = "RIGHT" })
	p.scanInfo:SetPoint("RIGHT", p.scan, "LEFT", -12, 0)
	p.scanInfo:SetPoint("LEFT", p, "TOPLEFT", 70, -21)

	-- Left: your bags.
	local left = UI.Card(p, 10)
	left:SetPoint("TOPLEFT", 8, -44)
	left:SetPoint("BOTTOMLEFT", 8, 32)
	left:SetWidth(LEFT_W)
	local scroll = CreateFrame("ScrollFrame", nil, left)
	scroll:SetPoint("TOPLEFT", 12, -12)
	scroll:SetPoint("BOTTOMRIGHT", -8, 10)
	local content = CreateFrame("Frame", nil, scroll)
	content:SetSize(LEFT_W - 20, 1)
	scroll:SetScrollChild(content)
	scroll:EnableMouseWheel(true)
	scroll:SetScript("OnMouseWheel", function(self, delta)
		local max = math.max(0, content:GetHeight() - self:GetHeight())
		self:SetVerticalScroll(math.min(max, math.max(0, self:GetVerticalScroll() - delta * (ICON + GAP))))
	end)
	p.content = content
	p.empty = UI.Text(left, 11.5, ns.RGB.fog, { wrap = true })
	p.empty:SetPoint("TOPLEFT", 14, -14)
	p.empty:SetPoint("TOPRIGHT", -14, -14)
	p.empty:SetText("Nothing in your bags the auction house takes.")
	p.money = UI.Text(p, 11.5, ns.RGB.text)
	p.money:SetPoint("BOTTOMLEFT", 14, 11)

	-- Right, above: the item, how many, the price, the duration, Post.
	local sell = UI.Card(p, 10)
	sell:SetPoint("TOPLEFT", left, "TOPRIGHT", 10, 0)
	sell:SetPoint("TOPRIGHT", p, "TOPRIGHT", -8, -44)
	sell:SetHeight(176)
	p.icon = UI.Icon(sell, 40)
	p.icon:SetPoint("TOPLEFT", 16, -16)
	p.name = UI.Text(sell, 13, ns.RGB.white, { weight = "bold" })
	p.name:SetPoint("TOPLEFT", 66, -20)
	p.name:SetPoint("TOPRIGHT", -16, -20)
	p.have = UI.Text(sell, 11, ns.RGB.mist)
	p.have:SetPoint("TOPLEFT", 66, -40)

	label(sell, "Quantity", 16, -70)
	p.qty = CreateFrame("EditBox", nil, sell)
	p.qty:SetSize(56, 26)
	UI.Field(p.qty, 6)
	p.qty:SetTextInsets(8, 8, 0, 0)
	p.qty:SetNumeric(true)
	p.qty:SetMaxLetters(5)
	p.qty:SetPoint("TOPLEFT", 16, -86)
	p.qty:SetScript("OnTextChanged", function(_, user)
		if user then
			resetPost()
		end
		summary()
	end)
	p.qty:SetScript("OnEnterPressed", p.qty.ClearFocus)
	p.qty:SetScript("OnEscapePressed", p.qty.ClearFocus)
	local max = UI.Button(sell, "Max", 44, 26, function()
		if selected then
			p.qty:SetText(tostring(A.MaxQuantity(selected)))
			resetPost()
		end
	end)
	max:SetPoint("LEFT", p.qty, "RIGHT", 6, 0)

	label(sell, "Price per unit", 140, -70)
	p.gold = moneyBox(sell, 56, "g", { 1, 0.82, 0 }, 6)
	p.gold:SetPoint("TOPLEFT", 140, -86)
	p.silver = moneyBox(sell, 34, "s", { 0.78, 0.78, 0.8 }, 2)
	p.silver:SetPoint("LEFT", p.gold.coin, "RIGHT", 8, 0)
	p.copper = moneyBox(sell, 34, "c", { 0.85, 0.55, 0.35 }, 2)
	p.copper:SetPoint("LEFT", p.silver.coin, "RIGHT", 8, 0)
	if not A.CopperOK() then
		-- This auction house takes whole silver only.
		p.copper:Hide()
		p.copper.coin:Hide()
	end

	label(sell, "Duration", 332, -70)
	p.durations = {}
	for i, text in ipairs(A.Durations()) do
		local hours = text:match("%d+")
		local chip = UI.Chip(sell, hours and (hours .. "h") or text, function()
			if SetCVar then
				SetCVar("auctionHouseDurationDropdown", i)
			end
			resetPost()
			summary()
		end)
		chip.tip = text
		if i == 1 then
			chip:SetPoint("TOPLEFT", 332, -87)
		else
			chip:SetPoint("LEFT", p.durations[i - 1], "RIGHT", 6, 0)
		end
		p.durations[i] = chip
	end

	p.post = UI.Button(sell, "Post", 110, 30, function()
		if A.Pending() then
			A.Confirm()
			p.post:SetLabel("Post")
			p.status:SetText("Posting...")
			return
		end
		local result, why = A.Post(selected, quantity(), unitPrice(), duration())
		if result == "confirm" then
			p.post:SetLabel("Post anyway")
			p.status:SetText(ns.Hex(ns.HEX.gold, "The game asks first: that price is far from the market."))
		elseif result == "posted" then
			p.status:SetText("Posting...")
		elseif why then
			p.status:SetText(ns.Hex(ns.HEX.red, why))
		end
	end, "primary")
	p.post:SetPoint("BOTTOMRIGHT", -16, 16)
	p.deposit = UI.Text(sell, 11, ns.RGB.text)
	p.deposit:SetPoint("BOTTOMLEFT", 16, 34)
	p.total = UI.Text(sell, 11, ns.RGB.text)
	p.total:SetPoint("LEFT", p.deposit, "RIGHT", 24, 0)
	p.status = UI.Text(sell, 11, ns.RGB.mist)
	p.status:SetPoint("BOTTOMLEFT", 16, 14)
	p.status:SetPoint("BOTTOMRIGHT", -138, 14)

	-- Right, below: what it sells for now.
	local list = UI.Card(p, 10)
	list:SetPoint("TOPLEFT", sell, "BOTTOMLEFT", 0, -10)
	list:SetPoint("BOTTOMRIGHT", p, "BOTTOMRIGHT", -8, 32)
	label(list, "Price per unit", 16, -14)
	label(list, "Available", 200, -14)
	p.levelHead = label(list, "Item level", 290, -14)
	p.rows = {}
	for i = 1, ROWS do
		local row = CreateFrame("Frame", nil, list)
		row:SetHeight(18)
		row:SetPoint("TOPLEFT", 16, -16 - i * 19)
		row:SetPoint("TOPRIGHT", -16, -16 - i * 19)
		row.price = UI.Text(row, 11.5, ns.RGB.white)
		row.price:SetPoint("LEFT", 0, 0)
		row.qty = UI.Text(row, 11.5, ns.RGB.text)
		row.qty:SetPoint("LEFT", 184, 0)
		row.level = UI.Text(row, 11.5, ns.RGB.text)
		row.level:SetPoint("LEFT", 274, 0)
		row.mine = UI.Text(row, 11.5, ns.RGB.green)
		row.mine:SetPoint("LEFT", 364, 0)
		row:Hide()
		p.rows[i] = row
	end
	p.listNote = UI.Text(list, 11, ns.RGB.fog)
	p.listNote:SetPoint("BOTTOMLEFT", 16, 12)

	p:SetScript("OnShow", function()
		drawBags()
		drawScan()
		drawRows()
		drawMoney()
		summary()
	end)
	local since = 0
	p:SetScript("OnUpdate", function(_, elapsed)
		since = since + elapsed
		if since >= 1 then
			since = 0
			drawScan()
		end
	end)
	p:Hide()
	pick(nil)
	return p
end

-- The tab ----------------------------------------------------------------------------------------------------------

-- While the panel is up, the game's own warning about a far-off price (its dialog posts only from its own window) is
-- left to the panel's "Post anyway"; the game's window gets it back when the panel goes.
local held = false
local function holdWarning(on)
	local f = AuctionHouseFrame
	if not (f and f.IsEventRegistered) then
		return
	end
	if on and not held and f:IsEventRegistered("AUCTION_HOUSE_POST_WARNING") then
		f:UnregisterEvent("AUCTION_HOUSE_POST_WARNING")
		held = true
	elseif not on and held then
		f:RegisterEvent("AUCTION_HOUSE_POST_WARNING")
		held = false
	end
end

local function hide()
	if panel and panel:IsShown() then
		panel:Hide()
		A.Drop()
	end
	holdWarning(false)
	if tab then
		tab:SetSelected(false)
	end
end

local function show()
	panel = panel or build()
	panel:Show()
	holdWarning(true)
	tab:SetSelected(true)
end

local function makeTab()
	if tab or not AuctionHouseFrame then
		return
	end
	tab = UI.Button(AuctionHouseFrame, "Grimoire", 96, 26, function()
		if panel and panel:IsShown() then
			return
		end
		show()
	end)
	tab.tip = "Sell what is in your bags, at the going price."
	local tabs = AuctionHouseFrame.Tabs
	local lastTab = tabs and tabs[#tabs]
	if lastTab then
		tab:SetPoint("LEFT", lastTab, "RIGHT", 2, 1)
	else
		tab:SetPoint("TOPLEFT", AuctionHouseFrame, "BOTTOMLEFT", 20, -2)
	end
	-- Any of the game's tabs, or the game opening its own selling page, puts the game's page back.
	if AuctionHouseFrame.SetDisplayMode then
		hooksecurefunc(AuctionHouseFrame, "SetDisplayMode", hide)
	end
end

local function update()
	if not AuctionHouseFrame then
		return
	end
	if ns.db and ns.db.ahTab == false then
		hide()
		if tab then
			tab:Hide()
		end
		return
	end
	makeTab()
	tab:Show()
end
ns.UpdateAuctionTab = update

ns.On("AUCTION_HOUSE_SHOW", function()
	-- The game loads its auction house window as it opens: the tab joins it a moment later.
	C_Timer.After(0, update)
end)
ns.On("AUCTION_HOUSE_CLOSED", hide)
ns.On("BAG_UPDATE_DELAYED", function()
	if panel and panel:IsShown() then
		drawBags()
	end
end)
ns.On("PLAYER_MONEY", function()
	if panel and panel:IsShown() then
		drawMoney()
	end
end)
ns.Listen("AUCTION_POSTED", function()
	if not (panel and panel:IsShown()) then
		return
	end
	panel.status:SetText(ns.Hex(ns.HEX.green, "Posted."))
	panel.post:SetLabel("Post")
	-- One more look, to show your new auction among the others.
	C_Timer.After(1, function()
		if selected and panel:IsShown() then
			A.Lookup(selected)
		end
	end)
end)
ns.Listen("AUCTION_ROWS", function()
	if not panel then
		return
	end
	panel.looking = false
	if selected and not edited then
		local price = A.Suggest(selected.id)
		if price then
			setPrice(price)
		end
	end
	summary()
	drawRows()
end)
ns.Listen("AUCTION", function()
	if panel and panel:IsShown() then
		drawScan()
	end
end)
