#!/usr/bin/env node
// Tests the add-on's auction house parts in a Lua VM (fengari) against a fake game: the full scan and the prices it
// keeps (Auction.lua), one item's auctions and the price to ask, the things in your bags the auction house takes,
// posting and the game's "far from the market" question, the short item tooltip (Tooltip.lua), and the selling tab
// itself (UI/AuctionSell.lua), driven by clicks. The fake auction house keeps the game's rules: auctions are numbered
// from 0, searches wait for the throttle, a price may have to be whole silver.
//
//   node scripts/addon/test-auction.mjs
//
// fengari is not one of the site's dependencies: install it next to the repo (npm install --no-save fengari) or point
// FENGARI at a copy.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let fengari;
for (const p of [process.env.FENGARI, 'fengari', '/tmp/luap/node_modules/fengari', '/tmp/fengari/node_modules/fengari'].filter(Boolean)) {
  try {
    fengari = require(p);
    break;
  } catch {}
}
if (!fengari) {
  console.error('This test needs fengari: npm install --no-save fengari, or FENGARI=/path/to/fengari.');
  process.exit(2);
}
const { lua, lauxlib, lualib, to_luastring } = fengari;
const ADDON = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'addon', 'GrimoireForever');

const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);
function run(code, name, args = []) {
  if (lauxlib.luaL_loadbuffer(L, to_luastring(code), null, to_luastring(name)) !== lua.LUA_OK) throw new Error(lua.lua_tojsstring(L, -1));
  for (const a of args) {
    if (a === 'NS') lua.lua_getglobal(L, to_luastring('NS'));
    else lua.lua_pushstring(L, to_luastring(a));
  }
  if (lua.lua_pcall(L, args.length, 0, 0) !== lua.LUA_OK) throw new Error(`${name}: ${lua.lua_tojsstring(L, -1)}`);
}

/* ── The fake game ───────────────────────────────────────────────────────── */

run(String.raw`
NS = {}
PRINTS = {}
print = function(...) local t = {} for i = 1, select("#", ...) do t[#t + 1] = tostring((select(i, ...))) end PRINTS[#PRINTS + 1] = table.concat(t, " ") end
SlashCmdList = {}
unpack = unpack or table.unpack
strtrim = function(s) return (s:gsub("^%s+", ""):gsub("%s+$", "")) end
function strsplit(sep, s) local out = {} for part in (s .. sep):gmatch("(.-)" .. sep:gsub("%p", "%%%0")) do out[#out + 1] = part end return unpack(out) end
function geterrorhandler() return function(e) error(e, 0) end end

NOW = 1000
function GetTime() return NOW end
time = function() return 1794000000 + math.floor(NOW) end

-- Frames: events, scripts, sizes, text; OnUpdate runs for shown frames as the clock moves.
local events, updates = {}, {}
local function noop() end
Frame = {}
Frame.__index = function(_, k)
	local v = rawget(Frame, k)
	if v ~= nil then return v end
	if type(k) == "string" and k:match("^%u") then return noop end
end
function Frame:RegisterEvent(e) events[e] = events[e] or {} self.reg = self.reg or {} if not self.reg[e] then self.reg[e] = true table.insert(events[e], self) end end
function Frame:UnregisterEvent(e) if self.reg then self.reg[e] = nil end for i, f in ipairs(events[e] or {}) do if f == self then table.remove(events[e], i) break end end end
function Frame:IsEventRegistered(e) return self.reg and self.reg[e] or false end
function Frame:SetScript(k, fn) self.scripts = self.scripts or {} self.scripts[k] = fn if k == "OnUpdate" then updates[#updates + 1] = self end end
function Frame:GetScript(k) return self.scripts and self.scripts[k] end
function Frame:HookScript(k, fn) local old = self:GetScript(k) self:SetScript(k, function(...) if old then old(...) end fn(...) end) end
function Frame:Show() local was = self.shown self.shown = true if not was and self:GetScript("OnShow") then self:GetScript("OnShow")(self) end end
function Frame:Hide() local was = self.shown self.shown = false if was and self:GetScript("OnHide") then self:GetScript("OnHide")(self) end end
function Frame:SetShown(on) if on then self:Show() else self:Hide() end end
function Frame:IsShown() return self.shown end
function Frame:IsVisible() return self.shown end
function Frame:GetFrameLevel() return 1 end
function Frame:SetSize(w, h) self.width, self.height = w, h end
function Frame:SetWidth(w) self.width = w end
function Frame:GetWidth() return self.width or 0 end
function Frame:SetHeight(h) self.height = h end
function Frame:GetHeight() return self.height or 0 end
function Frame:SetText(t) self.text = t end
function Frame:GetText() return self.text end
function Frame:GetStringWidth() return #(self.text or "") * 6 end
function Frame:GetUnboundedStringWidth() return #(self.text or "") * 6 end
function Frame:GetStringHeight() return self.text and self.text ~= "" and 14 or 0 end
function Frame:SetFont() return true end
function Frame:IsEnabled() return self.enabled ~= false end
function Frame:Enable() self.enabled = true end
function Frame:Disable() self.enabled = false end
function Frame:SetEnabled(on) self.enabled = on and true or false end
function Frame:GetPoint() return "CENTER", nil, "CENTER", 0, 0 end
function Frame:GetVerticalScroll() return 0 end
function Frame:HasFocus() return false end
function Frame:CreateFontString() return setmetatable({ shown = true }, Frame) end
function Frame:CreateTexture() return setmetatable({ shown = true }, Frame) end
function Frame:CreateMaskTexture() return setmetatable({ shown = true }, Frame) end
CREATED = {}
function CreateFrame(_, name, parent) local f = setmetatable({ shown = true, parent = parent }, Frame) if name then _G[name] = f end CREATED[#CREATED + 1] = f return f end
function FIRE(e, ...) local list = {} for i, f in ipairs(events[e] or {}) do list[i] = f end for _, f in ipairs(list) do local h = f:GetScript("OnEvent") if h then h(f, e, ...) end end end
function GetLocale() return "enUS" end
UIParent = CreateFrame("Frame", "UIParent")
UIParent:SetSize(1920, 1080)
GameTooltip = CreateFrame("Frame")

local timers = {}
C_Timer = { After = function(delay, fn) timers[#timers + 1] = { due = NOW + (delay or 0), fn = fn } end }
function FLUSH()
	for _ = 1, 50 do
		local due, rest = {}, {}
		for _, t in ipairs(timers) do if t.due <= NOW then due[#due + 1] = t else rest[#rest + 1] = t end end
		timers = rest
		if #due == 0 then return end
		for _, t in ipairs(due) do t.fn() end
	end
end
function ADVANCE(seconds) for _ = 1, seconds do NOW = NOW + 1 FLUSH() for _, f in ipairs(updates) do local fn = f:GetScript("OnUpdate") if fn and f.shown ~= false then fn(f, 1) end end end end

function hooksecurefunc(a, b, c)
	local t, k, fn = _G, a, b
	if type(a) == "table" then t, k, fn = a, b, c end
	local old = t[k]
	t[k] = function(...) local r = { old(...) } fn(...) return unpack(r) end
end

-- The character
function UnitName() return "Tester" end
function GetRealmName() return "Realm" end
function UnitClass() return "Warrior", "WARRIOR" end
function UnitLevel() return 60 end
function UnitFactionGroup() return "Alliance" end
MONEY = 123456
function GetMoney() return MONEY end
C_CurrencyInfo = { GetCoinTextureString = function(c) return "$" .. c end }
CVARS = {}
function GetCVar(k) return CVARS[k] end
function SetCVar(k, v) CVARS[k] = tostring(v) end
AUCTION_DURATION_ONE, AUCTION_DURATION_TWO, AUCTION_DURATION_THREE = "2 Hours", "8 Hours", "24 Hours"
NUM_BAG_SLOTS = 4

Enum = {
	ItemCommodityStatus = { Unknown = 0, Item = 1, Commodity = 2 },
	AuctionHouseSortOrder = { Price = 0 },
	TooltipDataType = { Item = 0, Unit = 1 },
	TooltipDataLineType = { SellPrice = 11 },
}
ItemLocation = { CreateFromBagAndSlot = function(_, bag, slot) return { bag = bag, slot = slot } end }

-- Items: the bags, what each is, and what the game says of it.
local function link(id, name) return "|cffffffff|Hitem:" .. id .. "::::::::60:::::|h[" .. name .. "]|h|r" end
LINKS = { [2589] = link(2589, "Linen Cloth"), [2592] = link(2592, "Wool Cloth"), [7000] = link(7000, "Heavy Sword"), [6948] = link(6948, "Hearthstone"), [5000] = link(5000, "Quest Thing"), [2318] = link(2318, "Light Leather") }
NAMES = { [2589] = "Linen Cloth", [2592] = "Wool Cloth", [7000] = "Heavy Sword", [2318] = "Light Leather" }
SELL = { [2589] = 13, [2592] = 33, [7000] = 2500 }
CLASS = { [2589] = { 7, "Trade Goods" }, [2592] = { 7, "Trade Goods" }, [7000] = { 2, "Weapon" }, [2318] = { 7, "Trade Goods" } }
KIND = { [2589] = 2, [2592] = 2, [7000] = 1, [2318] = 2 }
local function item(id, count, extra) local t = { itemID = id, hyperlink = LINKS[id], iconFileID = "icon" .. id, quality = 1, stackCount = count or 1 } for k, v in pairs(extra or {}) do t[k] = v end return t end
ITEM = item
function FILL()
	BAGS = {
		[0] = { [1] = item(2589, 20), [2] = item(2589, 5), [3] = item(7000, 1, { quality = 3 }), [4] = item(6948, 1, { isBound = true }), [5] = item(5000, 1, { noAH = true }) },
		[1] = { [1] = item(2592, 3) },
	}
end
FILL()
C_Container = {
	GetContainerNumSlots = function(bag) return BAGS[bag] and 16 or 0 end,
	GetContainerItemInfo = function(bag, slot) return BAGS[bag] and BAGS[bag][slot] end,
}
local function nameOf(x) if type(x) == "number" then return NAMES[x] end local id = tonumber(tostring(x):match("item:(%d+)")) return id and NAMES[id], id end
local function info(x) local name, id = nameOf(x) id = id or x return name, LINKS[id], 1, 60, 0, "", "", 20, "", "icon", SELL[id] end
GetItemInfo = info
C_Item = {
	GetItemInfo = info,
	GetItemInfoInstant = function(id) local c = CLASS[id] or { 15, "Miscellaneous" } return id, c[2], nil, nil, nil, c[1] end,
}

-- The auction house. AH logs every call that reaches the server.
AH = {}
REPL = {} -- the auctions a full scan reads: { count, buyout, item id }
READY, NEEDS, COPPER = true, false, true
BROWSE = {}
COMMODITY_RESULTS, ITEM_RESULTS = {}, {}
local function slotInfo(loc) return BAGS[loc.bag] and BAGS[loc.bag][loc.slot] end
C_AuctionHouse = {
	SupportsCopperValues = function() return COPPER end,
	ReplicateItems = function() AH[#AH + 1] = { "ReplicateItems" } end,
	GetNumReplicateItems = function() return #REPL end,
	GetReplicateItemInfo = function(i)
		if i < 0 or i >= #REPL then error("GetReplicateItemInfo: no auction " .. i) end
		local a = REPL[i + 1]
		return nil, nil, a[1], 1, true, 1, "", 0, 0, a[2], 0, nil, nil, nil, nil, 0, a[3], true
	end,
	IsThrottledMessageSystemReady = function() return READY end,
	SendSellSearchQuery = function(key) AH[#AH + 1] = { "SendSellSearchQuery", key.itemID } end,
	GetNumCommoditySearchResults = function(id) return #(COMMODITY_RESULTS[id] or {}) end,
	GetCommoditySearchResultInfo = function(id, i) return COMMODITY_RESULTS[id][i] end,
	GetNumItemSearchResults = function(key) return #(ITEM_RESULTS[key.itemID] or {}) end,
	GetItemSearchResultInfo = function(key, i) return ITEM_RESULTS[key.itemID][i] end,
	IsSellItemValid = function(loc) local s = slotInfo(loc) return s ~= nil and not s.noAH and not s.isBound end,
	GetItemKeyFromItem = function(loc) local s = slotInfo(loc) return { itemID = s.itemID, itemLevel = 0, itemSuffix = 0, battlePetSpeciesID = 0 } end,
	MakeItemKey = function(id) return { itemID = id } end,
	GetItemCommodityStatus = function(loc) local s = slotInfo(loc) return KIND[s.itemID] or 1 end,
	GetAvailablePostCount = function(loc)
		local s, n = slotInfo(loc), 0
		for _, slots in pairs(BAGS) do for _, x in pairs(slots) do if x.hyperlink == s.hyperlink then n = n + x.stackCount end end end
		return n
	end,
	GetBrowseResults = function() return BROWSE end,
	CalculateCommodityDeposit = function(id, d, q) return 10 * d * q end,
	CalculateItemDeposit = function(loc, d, q) return 20 * d * q end,
	PostCommodity = function(loc, d, q, u) AH[#AH + 1] = { "PostCommodity", loc.bag, loc.slot, d, q, u } return NEEDS end,
	PostItem = function(loc, d, q, bid, buyout) AH[#AH + 1] = { "PostItem", loc.bag, loc.slot, d, q, bid or "nil", buyout } return NEEDS end,
	ConfirmPostCommodity = function(loc, d, q, u) AH[#AH + 1] = { "ConfirmPostCommodity", loc.bag, loc.slot, d, q, u } end,
	ConfirmPostItem = function(loc, d, q, bid, buyout) AH[#AH + 1] = { "ConfirmPostItem", loc.bag, loc.slot, d, q, bid or "nil", buyout } end,
}
function LAST(kind) for i = #AH, 1, -1 do if not kind or AH[i][1] == kind then return AH[i] end end end
function COUNT(kind) local n = 0 for _, c in ipairs(AH) do if c[1] == kind then n = n + 1 end end return n end

-- Tooltips: the item and unit post-calls the add-on adds.
POSTCALLS = {}
TooltipDataProcessor = { AddTooltipPostCall = function(kind, fn) POSTCALLS[kind] = fn end }
function TOOLTIP() local t = { lines = {} } function t:AddDoubleLine(a, b) self.lines[#self.lines + 1] = { a, b } end function t:AddLine(a) self.lines[#self.lines + 1] = { a } end return t end
`, 'fake game');

for (const f of ['Core.lua', 'Tooltip.lua', 'Auction.lua', 'UI/Widgets.lua', 'UI/AuctionSell.lua']) {
  run(readFileSync(path.join(ADDON, f), 'utf8'), f, ['GrimoireForever', 'NS']);
}

/* ── The tests ───────────────────────────────────────────────────────────── */

run(String.raw`
local ns, A = NS, NS.Auction
local fails, count = {}, 0
local function check(what, ok, detail) count = count + 1 if not ok then fails[#fails + 1] = what .. (detail and (": " .. tostring(detail)) or "") end end
local function eq(what, got, want) check(what, got == want, "got " .. tostring(got) .. ", want " .. tostring(want)) end
local function call(what, c, ...) local want = { ... } local ok = c ~= nil for i, v in ipairs(want) do ok = ok and c[i + 1] == v end check(what, ok, c and table.concat((function() local t = {} for i = 1, #c do t[i] = tostring(c[i]) end return t end)(), " ") or "no call") end
local heard = {}
for _, m in ipairs({ "AUCTION", "AUCTION_ROWS", "AUCTION_POSTED" }) do ns.Listen(m, function() heard[m] = (heard[m] or 0) + 1 end) end

FIRE("ADDON_LOADED", "GrimoireForever")
FIRE("PLAYER_LOGIN")
FLUSH()

-- The full scan: every auction, from 0, each item's lowest price per unit.
eq("a full scan is allowed at first", A.ScanWait(), 0)
REPL = { { 20, 2000, 2589 }, { 5, 400, 2589 }, { 1, 0, 2592 }, { 1, 15000, 7000 }, { 3, 1000, 2592 } }
check("the scan starts", A.Scan())
eq("it asks the game once", COUNT("ReplicateItems"), 1)
check("it is running", (A.Scanning()))
FIRE("REPLICATE_ITEM_LIST_UPDATE")
ADVANCE(1)
check("it is over", not A.Scanning())
eq("Linen: the cheaper per unit of two auctions", A.Price(2589), 80)
eq("Wool: an auction with no buyout does not count", A.Price(2592), 333)
eq("the sword", A.Price(7000), 15000)
eq("auctions read", A.Book().n, 4)
check("the next scan waits for the game's 15 minutes", A.ScanWait() > 890, A.ScanWait())
local ok, why = A.Scan()
check("a scan too soon is refused", not ok and why and why:find("15 minutes"), why)
eq("and the game is not asked", COUNT("ReplicateItems"), 1)
-- No answer (another add-on or character scanned): the scan gives up, the tab says why.
NOW = NOW + 901
check("a scan after 15 minutes starts", A.Scan())
ADVANCE(61)
check("unanswered, it gives up", not A.Scanning())
check("and says why", A.note and A.note:find("did not answer"), A.note)
check("the next one waits again", A.ScanWait() > 0)
eq("prices from the first scan stay", A.Price(2589), 80)

-- Your bags: one entry per thing, with its count across the bags; bound and refused things left out.
local groups = A.Sellable()
eq("two groups", #groups, 2)
eq("weapons first", groups[1].name, "Weapon")
eq("then trade goods", groups[2].name, "Trade Goods")
local linen, wool, sword
for _, g in ipairs(groups) do for _, e in ipairs(g.items) do if e.id == 2589 then linen = e elseif e.id == 2592 then wool = e elseif e.id == 7000 then sword = e end end end
eq("Linen counted across two stacks", linen and linen.count, 25)
check("Linen is a commodity", linen and linen.commodity)
check("the sword is not", sword and not sword.commodity)
local total = 0
for _, g in ipairs(groups) do total = total + #g.items end
eq("the Hearthstone and the quest item are left out", total, 3)

-- One item's auctions: the search waits for the game's throttle.
READY = false
A.Lookup(linen)
eq("no search while the game is busy", COUNT("SendSellSearchQuery"), 0)
READY = true
FIRE("AUCTION_HOUSE_THROTTLED_SYSTEM_READY")
call("then the search goes, for Linen", LAST("SendSellSearchQuery"), 2589)
COMMODITY_RESULTS[2589] = { { unitPrice = 95, quantity = 10, numOwnerItems = 0 }, { unitPrice = 90, quantity = 4, numOwnerItems = 0 }, { unitPrice = 120, quantity = 50, numOwnerItems = 0 } }
FIRE("COMMODITY_SEARCH_RESULTS_UPDATED", 2589)
eq("cheapest first", A.rows[1].unit, 90)
eq("the price kept for tooltips", A.Price(2589), 90)
eq("the price to ask: a copper under the cheapest", A.Suggest(2589), 89)
eq("whole-silver prices: a silver under", A.Suggest(2589, { { unit = 200 }, { unit = 300 } }), 100)
eq("yours the cheapest: yours", A.Suggest(2589, { { unit = 150, mine = true }, { unit = 200 } }), 150)
eq("nothing on sale: the price seen last", A.Suggest(2589, {}), 90)
COPPER = false
eq("whole silver only: a silver under, rounded down", A.Suggest(2589, { { unit = 1300 } }), 1200)
eq("never under a silver", A.Fit(40), 100)
COPPER = true
ITEM_RESULTS[7000] = { { buyoutAmount = 16000, quantity = 1, containsOwnerItem = false, itemKey = { itemID = 7000, itemLevel = 30 } }, { bidAmount = 9000, quantity = 1, containsOwnerItem = true, itemKey = { itemID = 7000, itemLevel = 30 } } }
A.Lookup(sword)
FIRE("ITEM_SEARCH_RESULTS_UPDATED", { itemID = 7000, itemLevel = 0, itemSuffix = 0, battlePetSpeciesID = 0 })
eq("items: a buyout first", A.rows[1].buyout, 16000)
eq("a bid-only auction last, with no price per unit", A.rows[2].unit, nil)

-- Posting: what the game is asked, in its own terms.
eq("most Linen at once: all of it", A.MaxQuantity(linen), 25)
eq("a commodity's deposit by item", A.Deposit(linen, 2, 10), 200)
eq("an item's deposit by its place", A.Deposit(sword, 3, 1), 60)
eq("Linen posts", A.Post(linen, 30, 89, 2), "posted")
call("PostCommodity: its slot, the duration, all 25, the unit price", LAST("PostCommodity"), 0, 1, 2, 25, 89)
eq("the sword posts", A.Post(sword, 1, 15000, 3), "posted")
call("PostItem: no bid, the buyout of each item", LAST("PostItem"), 0, 3, 3, 1, "nil", 15000)
NEEDS = true
eq("a price far from the market: the game asks first", A.Post(linen, 5, 89, 1), "confirm")
check("the post waits", A.Pending())
check("Post anyway sends it", A.Confirm())
call("ConfirmPostCommodity with the same post", LAST("ConfirmPostCommodity"), 0, 1, 1, 5, 89)
check("nothing waits after", not A.Pending())
NEEDS = false
COPPER = false
A.Post(linen, 5, 1234, 2)
call("whole silver only: the price is rounded down to it", LAST("PostCommodity"), 0, 1, 2, 5, 1200)
COPPER = true
local posts = COUNT("PostCommodity")
BAGS[0][1] = ITEM(2318, 4)
local res, msg = A.Post(linen, 5, 89, 2)
check("bags changed under it: no post", res == nil and msg and msg:find("bags changed"), msg)
eq("and nothing sent", COUNT("PostCommodity"), posts)
FILL()
KIND[2592] = 0
res, msg = A.Post(wool, 1, 300, 2)
check("an item the game has not loaded: no post", res == nil and msg and msg:find("loading"), msg)
KIND[2592] = 2
FIRE("AUCTION_HOUSE_AUCTION_CREATED", 1)
eq("a new auction is heard", heard.AUCTION_POSTED, 1)

-- The game's own Buy tab: what it lists, and what you search there, goes into the prices.
BROWSE = {
	{ itemKey = { itemID = 2318, itemLevel = 0, itemSuffix = 0, battlePetSpeciesID = 0 }, minPrice = 75, totalQuantity = 40 },
	{ itemKey = { itemID = 2318, itemLevel = 0, itemSuffix = 0, battlePetSpeciesID = 0 }, minPrice = 60, totalQuantity = 3 },
	{ itemKey = { itemID = 9999, itemLevel = 0, itemSuffix = 0, battlePetSpeciesID = 5 }, minPrice = 500, totalQuantity = 1 },
}
FIRE("AUCTION_HOUSE_BROWSE_RESULTS_UPDATED")
eq("browsing keeps the lowest price listed", A.Price(2318), 60)
eq("battle pets are left out", A.Price(9999), nil)
local before = A.rows
COMMODITY_RESULTS[2592] = { { unitPrice = 410, quantity = 5, numOwnerItems = 0 }, { unitPrice = 395, quantity = 2, numOwnerItems = 0 } }
FIRE("COMMODITY_SEARCH_RESULTS_UPDATED", 2592)
eq("a search in the game's own tab keeps its lowest price", A.Price(2592), 395)
check("and leaves the selling tab's rows alone", A.rows == before)
ITEM_RESULTS[7001] = { { buyoutAmount = 30000, quantity = 1, itemKey = { itemID = 7001, itemLevel = 40 } }, { buyoutAmount = 27000, quantity = 1, itemKey = { itemID = 7001, itemLevel = 40 } } }
FIRE("ITEM_SEARCH_RESULTS_UPDATED", { itemID = 7001, itemLevel = 40, itemSuffix = 0, battlePetSpeciesID = 0 })
eq("an item searched there too", A.Price(7001), 27000)

-- Tooltips: vendor, auction, drop rate; nothing else.
ns.minor = ns.minor or {}
ns.minor[2589] = { "Linen Cloth", 1, "icon", "Drop: Defias Bandit (Westfall), 12.5%" }
local t = TOOLTIP()
POSTCALLS[Enum.TooltipDataType.Item](t, { id = 2589, lines = {} })
eq("three lines", #t.lines, 3)
eq("vendor", t.lines[1] and t.lines[1][1], "Vendor")
eq("vendor price", t.lines[1] and t.lines[1][2], "$13")
eq("auction", t.lines[2] and t.lines[2][2], "$90")
check("drop rate, its creature without the zone", t.lines[3] and t.lines[3][1] == "Drop rate" and t.lines[3][2]:find("^12.5%%") and t.lines[3][2]:find("Defias Bandit", 1, true) and not t.lines[3][2]:find("Westfall"), t.lines[3] and t.lines[3][2])
t = TOOLTIP()
POSTCALLS[Enum.TooltipDataType.Item](t, { id = 2589, lines = { { type = Enum.TooltipDataLineType.SellPrice, price = 13 } } })
eq("the data has a sell price line but the game drew no price (away from a vendor): vendor and auction both show", t.lines[1] and t.lines[1][1], "Vendor")
eq("and the auction line after it", t.lines[2] and t.lines[2][1], "Auction")
t = TOOLTIP()
t.shownMoneyFrames = 1
POSTCALLS[Enum.TooltipDataType.Item](t, { id = 2589, lines = { { type = Enum.TooltipDataLineType.SellPrice, price = 13 } } })
eq("where the game drew its own sell price (at a vendor), no second one", t.lines[1] and t.lines[1][1], "Auction")
t = TOOLTIP()
t.shownMoneyFrames = 0
POSTCALLS[Enum.TooltipDataType.Item](t, { id = 2589, lines = {} })
eq("a tooltip whose money lines were cleared: the vendor line shows", t.lines[1] and t.lines[1][1], "Vendor")
t = TOOLTIP()
t.isShopping = true
t.shownMoneyFrames = 1
POSTCALLS[Enum.TooltipDataType.Item](t, { id = 2589, lines = { { type = Enum.TooltipDataLineType.SellPrice, price = 13 } } })
eq("a comparison tooltip, where the game prints no sell price: the vendor line shows", t.lines[1] and t.lines[1][1], "Vendor")
local chance, who = ns.DropRate(2589)
eq("drop rate parsed", chance, "12.5%")
ns.minor[1] = { "x", 1, "i", "Drop: Moonrage Armorer, 0.82%" }
eq("a creature with no zone", select(2, ns.DropRate(1)), "Moonrage Armorer")
ns.minor[2] = { "x", 1, "i", "Vendor: Kzixx (Duskwood)" }
eq("not a drop: no rate", ns.DropRate(2), nil)

-- The selling tab, by clicks.
AuctionHouseFrame = CreateFrame("Frame", "AuctionHouseFrame")
AuctionHouseFrame.Tabs = { CreateFrame("Button"), CreateFrame("Button"), CreateFrame("Button") }
AuctionHouseFrame:RegisterEvent("AUCTION_HOUSE_POST_WARNING")
function AuctionHouseFrame:SetDisplayMode(mode) self.mode = mode end
FILL()
COMMODITY_RESULTS[2589] = { { unitPrice = 95, quantity = 10, numOwnerItems = 0 } }
FIRE("AUCTION_HOUSE_SHOW")
FLUSH()
local tab
for _, f in ipairs(CREATED) do if f.label and f.label.text == "Grimoire" and f.parent == AuctionHouseFrame then tab = f end end
check("a Grimoire tab beside the game's tabs", tab and tab:IsShown())
local function click(b) b:GetScript("OnClick")(b, "LeftButton") end
click(tab)
local p = GrimoireForeverAuction
check("its panel opens", p and p:IsShown())
check("the tab shows it is open", tab.selected)
check("the game's own price warning waits while it is open", not AuctionHouseFrame:IsEventRegistered("AUCTION_HOUSE_POST_WARNING"))
local slot
for _, b in ipairs(p.slots or {}) do if b.entry and b.entry.id == 2589 and b:IsShown() then slot = b end end
check("Linen is in the bag list", slot)
local searches = COUNT("SendSellSearchQuery")
click(slot)
eq("picking it looks it up", COUNT("SendSellSearchQuery"), searches + 1)
FIRE("COMMODITY_SEARCH_RESULTS_UPDATED", 2589)
eq("the price to ask is filled in", (p.copper:GetText()), "94")
eq("no silver", p.silver:GetText(), "")
eq("all of it to post", p.qty:GetText(), "25")
check("Post is ready", p.post:IsEnabled())
check("the auctions are listed", p.rows[1]:IsShown() and p.rows[1].qty.text == "10", p.rows[1].qty.text)
click(p.durations[3])
eq("a duration is kept as the game keeps it", CVARS.auctionHouseDurationDropdown, "3")
click(p.post)
call("Post sends it", LAST("PostCommodity"), 0, 1, 3, 25, 94)
eq("and says so", p.status.text, "Posting...")
FIRE("AUCTION_HOUSE_AUCTION_CREATED", 2)
check("the game's answer: posted", p.status.text and p.status.text:find("Posted"), p.status.text)
ADVANCE(1)
eq("and the auctions are looked up once more", COUNT("SendSellSearchQuery"), searches + 2)
NEEDS = true
click(p.post)
eq("the game asks first: the button says so", p.post.label.text, "Post anyway")
local confirms = COUNT("ConfirmPostCommodity")
click(p.post)
eq("a second click posts it", COUNT("ConfirmPostCommodity"), confirms + 1)
eq("the button is back", p.post.label.text, "Post")
NEEDS = false
p.qty:SetText("0")
p.qty:GetScript("OnTextChanged")(p.qty, true)
check("nothing to post: Post waits", not p.post:IsEnabled())
AuctionHouseFrame:SetDisplayMode("Buy")
check("one of the game's tabs closes the panel", not p:IsShown())
check("and gives the game its warning back", AuctionHouseFrame:IsEventRegistered("AUCTION_HOUSE_POST_WARNING"))
check("the tab no longer shows open", not tab.selected)
ns.db.ahTab = false
ns.UpdateAuctionTab()
check("turned off in Options, the tab goes", not tab:IsShown())
ns.db.ahTab = true
ns.UpdateAuctionTab()
check("and comes back", tab:IsShown())
FIRE("AUCTION_HOUSE_CLOSED")

if #fails > 0 then
	RESULT = #fails .. " of " .. count .. " checks failed:\n  " .. table.concat(fails, "\n  ")
else
	RESULT = "ok: " .. count .. " checks passed"
end
`, 'tests');

lua.lua_getglobal(L, to_luastring('RESULT'));
const result = lua.lua_tojsstring(L, -1);
console.log(result);
if (!result.startsWith('ok')) process.exitCode = 1;
