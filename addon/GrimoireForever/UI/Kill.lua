-- The kill bar: a hairline along the foot of your target's health bar, there only while your own damage over time is
-- ticking on it. It fills from the right toward a short mark at its left end as your DoTs come to cover the health the
-- target has left. Full, it turns gold and its mark lights: your DoTs will finish it, so you can turn to the next one.
-- Forever hides a creature's health from add-ons, and this keeps it hidden: Grimoire never reads it, guesses it or
-- compares anything with it. The bar takes the hidden value straight from the game (a status bar may), so only the
-- game knows how full it is. The gold is the game's doing too: copies of the bar, fed the same numbers but a thousand
-- times as long, of which only the full end is in sight, so their fill comes into view only once the bar is full.
-- Grimoire counts its own side: your DoTs, from their spell text, each one counted from its first tick on your target
-- on, at the size the game shows for that tick.
-- It sits on the game's target frame, or on the frame a unit frame add-on shows in its place, and moves only out of
-- combat.
local _, ns = ...
local UI = ns.UI

local WINDOW = 0.6 -- seconds either side of the time a tick is due
local FIRST = 1.8 -- the first tick may land this much after its time: the spell's flight, the server's own beat
local MISS = 0.8 -- a miss, dodge or resist this soon after a cast takes the cast back
local REDRAW = 0.2 -- seconds between redraws while the bar shows

local LINE = 2 -- the bar's height
local MARK_W, MARK_H = 2, 6 -- the mark at its full end
local GLOW = 7 -- the light around the mark once the bar is full: its radius
local ZOOM = 1000 -- how many times as long as the bar its gold copies are: they come into view past 99.9%
local SCAN = 10 -- seconds between searches for a unit frame add-on's target frame

local SCHOOL = { physical = 1, holy = 2, fire = 4, nature = 8, frost = 16, shadow = 32, arcane = 64 }
local MISSES = { MISS = true, DODGE = true, PARRY = true, BLOCK = true, RESIST = true, IMMUNE = true, EVADE = true, DEFLECT = true, REFLECT = true }
local NOT_A_TICK = { CRITICAL = true, CRUSHING = true, GLANCING = true } -- damage over time never lands like these
-- Spells whose damage ticks every 2 seconds (the rest tick every 3): Curse of Agony, Insect Swarm, Rip, Rupture and
-- Fireball, by their first rank. Their names come from the game, so every rank, in any language, matches.
local EVERY2 = { 980, 5570, 1079, 1943, 133 }

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

--- Whether a school mask holds a school (one bit); 0 holds them all.
local function holds(mask, school)
	return school == 0 or math.floor(mask / school) % 2 == 1
end

local function number(s)
	return tonumber((s:gsub(",", "")))
end

--- A spell's damage over time from its text: { total, school, length[, period] }, or nil.
local function parse(text)
	local total, school, length = text:match("(%d[%d,]*) (%a+) damage over (%d+%.?%d*) sec")
	if not total then
		total, length = text:match("(%d[%d,]*) damage over (%d+%.?%d*) sec")
		school = total and "physical"
	end
	if total then
		return { total = number(total), school = SCHOOL[school:lower()] or 0, length = tonumber(length) }
	end
	-- "Transfers 15 health from the target to the caster every 3 sec. Lasts 30 sec." (Siphon Life)
	local each, period, last = text:match("(%d[%d,]*) health [%a ]-every (%d+%.?%d*) sec%. Lasts (%d+%.?%d*) sec")
	if each then
		period, last = tonumber(period), tonumber(last)
		return { total = number(each) * math.floor(last / period + 0.5), school = 0, length = last, period = period }
	end
	return nil
end

local every2 -- the names of the spells that tick every 2 seconds
local function periodOf(name)
	if not every2 then
		every2 = {}
		for _, id in ipairs(EVERY2) do
			local n = C_Spell and C_Spell.GetSpellName and C_Spell.GetSpellName(id)
			if plain(n) and n then
				every2[n] = true
			end
		end
	end
	return every2[name] and 2 or 3
end

local spells = {} -- spell ID -> its damage over time, or false
local function dotOf(id)
	local known = spells[id]
	if known ~= nil then
		return known or nil
	end
	if not (C_Spell and C_Spell.GetSpellDescription) then
		return nil
	end
	local text = C_Spell.GetSpellDescription(id)
	if not plain(text) or type(text) ~= "string" or text == "" then
		return nil -- not loaded yet: asked again next time
	end
	local harmful = C_Spell.IsSpellHarmful and C_Spell.IsSpellHarmful(id)
	local d = harmful ~= false and parse(text) or nil
	local name = C_Spell.GetSpellName and C_Spell.GetSpellName(id)
	if d and d.total and d.length and d.length > 0 and plain(name) and name then
		d.name = name
		d.period = d.period or periodOf(name)
		d.ticks = math.max(1, math.floor(d.length / d.period + 0.5))
		d.size = d.total / d.ticks -- the tick by the text: only a yardstick for the ticks the game shows
	else
		d = nil
	end
	spells[id] = d or false
	return d
end

-- Your damage over time on your target, by spell name:
-- { start, period, ticks, est, size, school, seen, anchored, sure, cast, prev }
-- start: when its ticks count from (the cast, then the first tick it is matched to); seen: the last tick matched;
-- sure: a tick of it landed on your target, so it counts, at size (the last tick's damage); prev: what a refresh
-- replaced, put back if the refresh misses.
local dots = {}
local aimed, aims = {}, 0 -- cast GUID -> whether the cast went at a unit (not the ground, not yourself); how many
-- holder: the kill bar, all its parts in one frame; host: the health bar it sits on; broken: the game refused the
-- health; bars: the bar and its gold copies, fed the same numbers; copies: the gold ones, sized to the bar (sized: the
-- width they were sized for).
local holder, host, broken, sized
local bars, copies = {}, {}

local function on()
	return holder ~= nil and host ~= nil and not broken and ns.db and ns.db.killBar ~= false
end

--- Drops what has run out, and casts whose first tick never landed on your target (it went elsewhere, or missed).
local function prune(now)
	for name, d in pairs(dots) do
		local done = math.max(d.seen, math.floor((now - d.start) / d.period))
		if done >= d.ticks or (not d.anchored and now > d.start + d.period + FIRST) then
			dots[name] = nil
		end
	end
end

--- The damage your DoTs on your target still have to do, by the ticks the game showed.
local function pending(now)
	local sum = 0
	for _, d in pairs(dots) do
		if d.sure and d.size then
			local done = math.max(d.seen, math.floor((now - d.start) / d.period))
			sum = sum + math.max(0, d.ticks - done) * d.size
		end
	end
	return sum
end

local showUntil = 0 -- /grim kill shows the bar full for a moment, to see where it sits

--- Gives the bar and its gold copies the same range and value.
local function paint(max, value)
	for _, b in ipairs(bars) do
		b:SetMinMaxValues(0, max)
		b:SetValue(value)
	end
end

--- The target's health goes from the game to the bars unseen: the bar is full once what is left is no more than your
--- DoTs still do, and the gold shows only then.
local function paintTarget(left)
	paint(UnitHealth("target"), left)
end

--- Sizes the gold copies for the bar's width.
local function resize()
	sized = holder:GetWidth() or 0
	for _, c in ipairs(copies) do
		c:SetWidth(math.max(1, sized) * ZOOM)
	end
end

--- Shows the bar. The copies follow its width as it changes, and are checked here too: too short, they would show gold
--- before the bar is full.
local function show()
	if holder:GetWidth() ~= sized then
		resize()
	end
	holder:Show()
end

local function redraw()
	if not holder then
		return
	end
	local now = GetTime()
	if now < showUntil and host then
		paint(1, 1)
		show()
		return
	end
	prune(now)
	local left = pending(now)
	if left <= 0 or not on() or not UnitExists("target") or UnitIsDead("target") then
		holder:Hide()
		return
	end
	if pcall(paintTarget, left) then
		show()
	else
		broken = true
		holder:Hide()
	end
end

local function reset()
	wipe(dots)
	redraw()
end

local function cast(castGUID, spellID)
	if not (on() and plain(spellID) and plain(castGUID)) then
		return
	end
	local info = dotOf(spellID)
	local at = aimed[castGUID]
	aimed[castGUID] = nil
	if not info or at == false or not (UnitExists("target") and UnitCanAttack("player", "target")) then
		return
	end
	local now = GetTime()
	local old = dots[info.name]
	dots[info.name] = {
		start = now, period = info.period, ticks = info.ticks, est = info.size, school = info.school, seen = 0,
		sure = old and old.sure, size = old and old.size, cast = now, prev = old,
	}
end

local function tick(event, flag, amount, school)
	if not (next(dots) and plain(event) and plain(amount) and plain(school)) or type(amount) ~= "number" then
		return
	end
	local now = GetTime()
	if MISSES[event] then
		for name, d in pairs(dots) do
			if d.cast and now - d.cast <= MISS and holds(school, d.school) then
				dots[name] = d.prev
			end
		end
		redraw()
		return
	end
	if event ~= "WOUND" or (plain(flag) and NOT_A_TICK[flag]) then
		return
	end
	-- The tick this is: the one due nearest now among your DoTs of its school.
	local best, bestK, bestErr
	for _, d in pairs(dots) do
		if holds(school, d.school) then
			local k = d.anchored and math.floor((now - d.start) / d.period + 0.5) or 1
			if k > d.seen and k >= 1 and k <= d.ticks then
				local err = now - (d.start + k * d.period)
				if err >= -WINDOW and err <= (d.anchored and WINDOW or FIRST) and (not bestErr or math.abs(err) < bestErr) then
					best, bestK, bestErr = d, k, math.abs(err)
				end
			end
		end
	end
	-- A tick far from what the spell's text says is something else landing at the same moment.
	if not best or amount < best.est * 0.2 or amount > best.est * 2.5 then
		return
	end
	if not best.anchored then
		best.start, best.anchored = now - bestK * best.period, true
	end
	best.seen, best.size, best.sure, best.cast, best.prev = bestK, amount, true, nil, nil
	redraw()
end

-- Where it sits ----------------------------------------------------------------------------------------------------
-- On your target's health bar. The game's target frame is the place while it is in use; a unit frame add-on (ElvUI,
-- Shadowed Unit Frames, PitBull and the like) turns it off and shows its own, found as the frame that shows the unit
-- "target" and holds a health bar. The bar moves there out of combat only, at login and whenever your target shows
-- without the frame it sits on.

local wanted -- a move put off until combat ends
local scanned = -SCAN -- when the last search for an add-on's frame was

--- Whether the game's target frame is in use: shown, while you have a target; else still taking its events and not
--- hidden away under a hidden parent (how unit frame add-ons turn it off).
local function gameInUse()
	local t = TargetFrame
	if not (t and t.IsVisible) then
		return false
	end
	if UnitExists("target") then
		return t:IsVisible()
	end
	local parent = t:GetParent()
	local listening = not t.IsEventRegistered or t:IsEventRegistered("PLAYER_TARGET_CHANGED")
	return listening and parent ~= nil and parent:IsVisible()
end

local HEALTH = { "Health", "HealthBar", "healthBar", "healthbar" } -- what unit frames call theirs

--- A unit frame's health bar: by the names unit frames give it, else the tallest status bar shown in it, a few frames
--- down (a health bar stands taller than the power bar beside it).
local function healthIn(frame)
	for _, key in ipairs(HEALTH) do
		local b = frame[key]
		if type(b) == "table" and b.IsObjectType and b:IsObjectType("StatusBar") then
			return b
		end
	end
	local best, tallest
	local function look(f, depth)
		for _, child in ipairs({ f:GetChildren() }) do
			if child ~= holder and child:IsShown() then
				if child:IsObjectType("StatusBar") then
					local h = child:GetHeight() or 0
					if not tallest or h > tallest then
						best, tallest = child, h
					end
				end
				if depth < 3 then
					look(child, depth + 1)
				end
			end
		end
	end
	look(frame, 1)
	return best
end

--- The health bar of the game's target frame: the box its bars sit in, as the modern engine draws it, else the bar.
local function gameHealth()
	local t = TargetFrame
	local main = t and t.TargetFrameContent and t.TargetFrameContent.TargetFrameContentMain
	return main and main.HealthBarsContainer or t and healthIn(t) or TargetFrameHealthBar
end

--- A unit frame add-on's health bar for your target: in a frame other than the game's that shows the unit "target" (a
--- secure unit button's attribute) and holds one. One shown now if there is (you have a target), else one in a shown
--- parent, as the frame itself hides while you have no target. A frame that will not say is passed over.
local function addonHealth()
	local spare
	local f = EnumerateFrames()
	while f do
		if f ~= TargetFrame and not (f.IsForbidden and f:IsForbidden()) then
			local ok, unit = pcall(f.GetAttribute, f, "unit")
			local shown = ok and unit == "target" and f:IsVisible()
			local parent = ok and unit == "target" and f:GetParent()
			if shown or (parent and not spare and parent:IsVisible()) then
				local b = healthIn(f)
				if b and shown then
					return b
				end
				spare = spare or b
			end
		end
		f = EnumerateFrames(f)
	end
	return spare
end

--- Where the bar should sit now: the game's health bar while its frame is in use, else an add-on's. The search through
--- the screen's frames runs at most every SCAN seconds, unless forced.
local function findHost(force)
	local game = gameInUse() and gameHealth()
	if game then
		return game
	end
	local now = GetTime()
	if not force and now - scanned < SCAN then
		return nil
	end
	scanned = now
	return EnumerateFrames and addonHealth() or nil
end

--- Puts the bar on your target's health bar (see findHost), above it; with nothing found it stays where it is. Out of
--- combat only: in combat it waits for the end. force: search now, however soon after the last search (/grim kill).
local function attach(force)
	if not holder then
		return
	end
	if InCombatLockdown and InCombatLockdown() then
		wanted = true
		return
	end
	wanted = false
	local ok, b = pcall(findHost, force)
	if not ok or not b or b == host or not b.GetFrameLevel then
		return
	end
	host = b
	holder:SetParent(b)
	holder:ClearAllPoints()
	holder:SetPoint("BOTTOMLEFT", b, "BOTTOMLEFT", 0, 0)
	holder:SetPoint("BOTTOMRIGHT", b, "BOTTOMRIGHT", 0, 0)
	local level = b:GetFrameLevel() + 4
	holder:SetFrameLevel(level)
	for k, part in ipairs(holder.parts) do
		part:SetFrameLevel(level + k)
	end
	resize()
	redraw()
end

--- With a new target, or once combat ends: your target should show the health bar the kill bar sits on. When it does
--- not (an add-on's frame took the game's place), or a move waits for the end of combat, it moves.
local function check()
	if holder and (wanted or (UnitExists("target") and UIParent:IsVisible() and not (host and host:IsVisible()))) then
		attach()
	end
end

local events = CreateFrame("Frame")
events:RegisterUnitEvent("UNIT_SPELLCAST_SENT", "player")
events:RegisterUnitEvent("UNIT_SPELLCAST_SUCCEEDED", "player")
events:RegisterUnitEvent("UNIT_SPELLCAST_CHANNEL_START", "player")
events:RegisterUnitEvent("UNIT_COMBAT", "target")
events:RegisterUnitEvent("UNIT_HEALTH", "target")
events:RegisterEvent("PLAYER_TARGET_CHANGED")
events:RegisterEvent("PLAYER_REGEN_ENABLED")
events:SetScript("OnEvent", function(_, event, unit, a, b, c, d)
	if event == "UNIT_COMBAT" then
		tick(a, b, c, d)
	elseif event == "UNIT_SPELLCAST_SENT" then
		-- a: the cast's target, by name (hidden for creatures): none means the ground or yourself.
		if plain(b) then
			aims = aims + 1
			if aims > 40 then
				wipe(aimed)
				aims = 0
			end
			aimed[b] = not plain(a) or (a ~= nil and a ~= "")
		end
	elseif event == "UNIT_SPELLCAST_SUCCEEDED" then
		cast(a, b)
	elseif event == "UNIT_SPELLCAST_CHANNEL_START" then
		-- Channelled spells stop when you do: never counted ahead.
		if plain(b) then
			spells[b] = false
			local name = C_Spell and C_Spell.GetSpellName and C_Spell.GetSpellName(b)
			if plain(name) and name then
				dots[name] = nil
			end
		end
	elseif event == "UNIT_HEALTH" then
		if holder and holder:IsShown() then
			redraw()
		end
	else
		-- A new target, or the end of combat: nothing counted carries over. The frames showing a new target settle a
		-- moment later, so that is when the bar looks at where it sits.
		reset()
		if event == "PLAYER_REGEN_ENABLED" then
			check()
		elseif C_Timer and C_Timer.After then
			C_Timer.After(0.3, check)
		end
	end
end)

-- The look -----------------------------------------------------------------------------------------------------------

--- A gold copy of the bar, for the full state: filling from the right like the bar, ZOOM times as long and starting at
--- the bar's full end, so only the last thousandth of its fill can reach the window it is seen through.
local function copy(parent, color, alpha)
	local c = CreateFrame("StatusBar", nil, parent)
	c:SetStatusBarTexture(UI.WHITE)
	c:SetStatusBarColor(color[1], color[2], color[3], alpha)
	c:SetReverseFill(true)
	c:SetMinMaxValues(0, 1)
	c:SetValue(0)
	bars[#bars + 1] = c
	copies[#copies + 1] = c
	return c
end

--- A frame over a region that cuts what is drawn in it to the region.
local function window(parent, region)
	local w = CreateFrame("Frame", nil, parent)
	w:SetAllPoints(region)
	w:SetClipsChildren(true)
	return w
end

--- Builds the bar, away until it has a health bar to sit on (attach): a dark track and your DoTs' share of what is
--- left in soft light, from the right; the mark at the left end; over them the gold, seen through the bar itself, the
--- mark, and a round glow around the mark. A client that cannot cut or mask frames gets the bar and the mark alone.
local function build()
	local h = CreateFrame("Frame", nil, UIParent)
	h:SetHeight(LINE)
	h:Hide()
	local b = CreateFrame("StatusBar", nil, h)
	b:SetAllPoints()
	b:SetStatusBarTexture(UI.WHITE)
	local soft = ns.RGB.text
	b:SetStatusBarColor(soft[1], soft[2], soft[3], 0.8)
	b:SetReverseFill(true) -- from the right, as health goes, toward the mark
	b:SetMinMaxValues(0, 1)
	b:SetValue(0)
	local track = b:CreateTexture(nil, "BACKGROUND")
	track:SetAllPoints()
	track:SetColorTexture(0, 0, 0, 0.5)
	local mark = b:CreateTexture(nil, "OVERLAY")
	mark:SetColorTexture(1, 1, 1, 0.55)
	mark:SetSize(MARK_W, MARK_H)
	mark:SetPoint("LEFT", h, "LEFT", 0, 0)
	bars[1] = b
	local parts = { b }
	local gold, bright = UI.colors.gilt, UI.colors.giltBright
	if h.SetClipsChildren then
		-- The bar turns gold, and the mark with it.
		local line = window(h, h)
		local full = copy(line, gold, 1)
		full:SetPoint("TOPLEFT", h, "TOPLEFT", 0, 0)
		full:SetPoint("BOTTOMLEFT", h, "BOTTOMLEFT", 0, 0)
		local tip = window(h, mark)
		local lit = copy(tip, bright, 1)
		lit:SetPoint("TOPLEFT", mark, "TOPLEFT", 0, 0)
		lit:SetPoint("BOTTOMLEFT", mark, "BOTTOMLEFT", 0, 0)
		for _, p in ipairs({ line, full, tip, lit }) do
			parts[#parts + 1] = p
		end
	end
	if h.CreateMaskTexture then
		-- A soft light around the mark.
		local glow = copy(h, bright, 0.85)
		glow:SetPoint("TOPLEFT", mark, "CENTER", -GLOW, GLOW)
		glow:SetHeight(2 * GLOW)
		local shape = glow:CreateMaskTexture()
		shape:SetTexture(UI.MEDIA .. "Glow.tga", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
		shape:SetPoint("CENTER", mark, "CENTER", 0, 0)
		shape:SetSize(2 * GLOW, 2 * GLOW)
		glow:GetStatusBarTexture():AddMaskTexture(shape)
		parts[#parts + 1] = glow
	end
	h.parts = parts
	h:SetScript("OnSizeChanged", resize)
	local wait = 0
	h:SetScript("OnUpdate", function(_, elapsed)
		wait = wait + elapsed
		if wait >= REDRAW then
			wait = 0
			redraw()
		end
	end)
	holder = h
end

ns.Listen("LOGIN", function()
	if not pcall(build) then
		holder = nil
		return
	end
	attach(true)
	-- Unit frame add-ons put their frames in place as they load, some after this: a second look in a moment.
	if C_Timer and C_Timer.After then
		C_Timer.After(2, function()
			attach(true)
		end)
	end
end)

--- Turns the kill bar on or off (Options).
function ns.UpdateKillBar()
	if not on() then
		wipe(dots)
	end
	redraw()
end

--- Shows the kill bar full for five seconds, to see where it sits (/grim kill).
function ns.ShowKillBar()
	if not holder then
		ns.Print("the kill bar cannot be drawn in this game client.")
		return
	end
	attach(true)
	if not host then
		ns.Print("the kill bar sits on your target frame's health bar, and no target frame was found.")
		return
	end
	if not host:IsVisible() then
		ns.Print("target something to see where the kill bar sits.")
	end
	showUntil = GetTime() + 5
	redraw()
end

-- For the tests: the DoTs being counted.
ns.killDots = dots
