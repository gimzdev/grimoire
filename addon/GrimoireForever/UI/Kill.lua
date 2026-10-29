-- The kill bar: a thin bar along the foot of your target's health bar that fills, from the right, toward a skull as
-- your own damage over time comes to cover the health the target has left. Full: your DoTs will finish it, so you can
-- turn to the next one.
-- Forever hides a creature's health from add-ons, and this keeps it hidden: Grimoire never reads it, guesses it or
-- compares anything with it. The bar takes the hidden value straight from the game (a status bar may), so only the
-- game knows how full it is. Grimoire counts its own side: your DoTs, from their spell text, each one counted from its
-- first tick on your target on, at the size the game shows for that tick.
local _, ns = ...

local WINDOW = 0.6 -- seconds either side of the time a tick is due
local FIRST = 1.8 -- the first tick may land this much after its time: the spell's flight, the server's own beat
local MISS = 0.8 -- a miss, dodge or resist this soon after a cast takes the cast back
local REDRAW = 0.2 -- seconds between redraws while the bar shows

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
local bar, broken

local function on()
	return bar ~= nil and not broken and ns.db and ns.db.killBar ~= false
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

local function redraw()
	if not bar then
		return
	end
	local now = GetTime()
	if now < showUntil then
		bar:SetMinMaxValues(0, 1)
		bar:SetValue(1)
		bar:Show()
		return
	end
	prune(now)
	local left = pending(now)
	if left <= 0 or not on() or not UnitExists("target") or UnitIsDead("target") then
		bar:Hide()
		return
	end
	-- The target's health goes from the game to the bar unseen: the bar is full once what is left is no more than
	-- your DoTs still do.
	local ok = pcall(function()
		bar:SetMinMaxValues(0, UnitHealth("target"))
		bar:SetValue(left)
	end)
	if ok then
		bar:Show()
	else
		broken = true
		bar:Hide()
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
		if bar and bar:IsShown() then
			redraw()
		end
	else
		reset()
	end
end)

local function build()
	local content = TargetFrame and TargetFrame.TargetFrameContent
	local holder = content and content.TargetFrameContentMain and content.TargetFrameContentMain.HealthBarsContainer
	if not (holder and holder.GetFrameLevel) then
		return
	end
	local b = CreateFrame("StatusBar", nil, holder)
	b:SetPoint("BOTTOMLEFT", holder, "BOTTOMLEFT", 0, 0)
	b:SetPoint("BOTTOMRIGHT", holder, "BOTTOMRIGHT", 0, 0)
	b:SetHeight(3)
	b:SetFrameLevel(holder:GetFrameLevel() + 4)
	b:SetStatusBarTexture("Interface\\Buttons\\WHITE8X8")
	b:SetStatusBarColor(ns.RGB.gilt[1], ns.RGB.gilt[2], ns.RGB.gilt[3], 1)
	b:SetReverseFill(true) -- from the right, as health goes, toward the skull
	local track = b:CreateTexture(nil, "BACKGROUND")
	track:SetAllPoints()
	track:SetColorTexture(0, 0, 0, 0.6)
	local skull = b:CreateTexture(nil, "OVERLAY")
	skull:SetTexture("Interface\\TargetingFrame\\UI-RaidTargetingIcon_8")
	skull:SetSize(12, 12)
	skull:SetPoint("RIGHT", b, "LEFT", -1, 1)
	b.skull = skull
	local wait = 0
	b:SetScript("OnUpdate", function(_, elapsed)
		wait = wait + elapsed
		if wait >= REDRAW then
			wait = 0
			redraw()
		end
	end)
	b:Hide()
	bar = b
	ns.KillBar = b
end

ns.Listen("LOGIN", function()
	local ok = pcall(build)
	if not ok then
		bar = nil
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
	if not bar then
		ns.Print("the kill bar needs the game's own target frame.")
		return
	end
	showUntil = GetTime() + 5
	redraw()
end

-- For the tests: the DoTs being counted.
ns.killDots = dots
