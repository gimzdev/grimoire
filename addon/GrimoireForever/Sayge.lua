-- Sayge's fortune: the Darkmoon Faire's two-hour buff, which Sayge gives again only after four hours played on the same
-- character since the last one. Time offline or on another character does not count. Grimoire notes the moment you get
-- a fortune against the character's played time (the game's /played, asked quietly), so the count survives a logout, a
-- reload or a crash, and tells you when the next fortune is yours. Each character's count is kept for the others, which
-- shows which alt can get one now. UI/SaygeTimer.lua draws the small timer.
local _, ns = ...

local S = {}
ns.Sayge = S

S.COOLDOWN = 4 * 3600 -- seconds played on the character between two fortunes
S.ICON = "Interface\\Icons\\INV_Misc_Orb_02"
local FRESH = 120 -- a fortune whose buff began less than this long ago was just given
local ASK_AGAIN = 30 -- seconds before asking the game for the played time again, if it did not answer

-- Sayge's Dark Fortune of Strength, Agility, Stamina, Spirit, Intelligence, Armor, Damage and Resistance.
S.SPELLS = { 23735, 23736, 23737, 23738, 23766, 23767, 23768, 23769 }
local IDS, NAMES = {}, {}
for _, id in ipairs(S.SPELLS) do
	IDS[id] = true
end

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

local function spellName(id)
	if C_Spell and C_Spell.GetSpellName then
		return C_Spell.GetSpellName(id)
	end
	return GetSpellInfo and (GetSpellInfo(id)) or nil
end

-- The buffs' names in the game's language, for a client that gives an aura without its spell.
local function learnNames()
	for _, id in ipairs(S.SPELLS) do
		local name = spellName(id)
		if plain(name) and name ~= "" then
			NAMES[name] = id
		end
	end
end

local function isFortune(id, name)
	if plain(id) and IDS[id] then
		return true
	end
	return plain(name) and (NAMES[name] ~= nil or name:find("^Sayge's Dark Fortune") ~= nil)
end

--- The fortune on the player now, as { spell, name, icon, duration, expires } (expires on GetTime's clock), or nil.
function S.Aura()
	if C_UnitAuras and C_UnitAuras.GetBuffDataByIndex then
		for i = 1, 40 do
			local a = C_UnitAuras.GetBuffDataByIndex("player", i)
			if not a then
				break
			end
			if isFortune(a.spellId, a.name) then
				return { spell = plain(a.spellId) and a.spellId or nil, name = a.name, icon = a.icon, duration = a.duration, expires = a.expirationTime }
			end
		end
	elseif UnitBuff then
		for i = 1, 40 do
			local name, icon, _, _, duration, expires, _, _, _, id = UnitBuff("player", i)
			if not name then
				break
			end
			if isFortune(id, name) then
				return { spell = plain(id) and id or nil, name = name, icon = icon, duration = duration, expires = expires }
			end
		end
	end
	return nil
end

-- Played time ----------------------------------------------------------------------------------------------------

local played -- { total = seconds played when the game said so, at = GetTime() then }
local asked -- GetTime() of the last question, while waiting for the answer
local muted = {}

--- Seconds played on this character now, or nil before the game has said.
function S.Played()
	return played and (played.total + (GetTime() - played.at)) or nil
end

local function chatFrames()
	local out = {}
	if type(CHAT_FRAMES) == "table" then
		for _, name in ipairs(CHAT_FRAMES) do
			out[#out + 1] = _G[name]
		end
	else
		for i = 1, (NUM_CHAT_WINDOWS or 10) do
			out[#out + 1] = _G["ChatFrame" .. i]
		end
	end
	return out
end

local function unmute()
	for _, cf in ipairs(muted) do
		cf:RegisterEvent("TIME_PLAYED_MSG")
	end
	muted = {}
end

--- Asks the game for the played time without the answer showing in chat (a /played you type still shows).
function S.Ask()
	if not RequestTimePlayed or (asked and GetTime() - asked < ASK_AGAIN) then
		return
	end
	asked = GetTime()
	for _, cf in ipairs(chatFrames()) do
		if cf and cf.IsEventRegistered and cf:IsEventRegistered("TIME_PLAYED_MSG") then
			cf:UnregisterEvent("TIME_PLAYED_MSG")
			muted[#muted + 1] = cf
		end
	end
	RequestTimePlayed()
	-- Should no answer come, the chat gets the event back anyway.
	C_Timer.After(ASK_AGAIN, function()
		if asked and #muted > 0 then
			unmute()
		end
	end)
end

-- This character's fortune -----------------------------------------------------------------------------------------

local function key()
	local name, realm = UnitName("player"), GetRealmName and GetRealmName() or ""
	return (name or "?") .. (realm ~= "" and ("-" .. realm) or "")
end

--- Seconds still to play before the next fortune: 0 when it is due, nil when there is no fortune on record or the
--- played time is not known yet.
function S.Left()
	local st = ns.char and ns.char.sayge
	local now = S.Played()
	if not (st and st.played and now) then
		return nil
	end
	return math.max(0, st.played + S.COOLDOWN - now)
end

--- Seconds left on the buff itself, or nil without it.
function S.BuffLeft()
	local a = S.Aura()
	if a and plain(a.expires) and a.expires > 0 then
		return math.max(0, a.expires - GetTime())
	end
	return nil
end

--- "1h 05m", "12m", "45s".
function S.Span(seconds)
	seconds = math.max(0, math.floor((seconds or 0) + 0.5))
	if seconds >= 3600 then
		return string.format("%dh %02dm", math.floor(seconds / 3600), math.floor(seconds % 3600 / 60))
	elseif seconds >= 60 then
		return string.format("%dm", math.floor(seconds / 60))
	end
	return seconds .. "s"
end

--- "1:05:09", for the timer.
function S.Clock(seconds)
	seconds = math.max(0, math.floor((seconds or 0) + 0.5))
	return string.format("%d:%02d:%02d", math.floor(seconds / 3600), math.floor(seconds % 3600 / 60), seconds % 60)
end

-- What every character has left, for the others to show: name -> { class, left, seen }.
local function remember()
	if not (ns.db and ns.char) then
		return
	end
	ns.db.sayge = ns.db.sayge or {}
	local left = S.Left()
	local st = ns.char.sayge
	if st and left then
		local _, classFile = UnitClass("player")
		ns.db.sayge[key()] = { class = plain(classFile) and classFile or nil, left = math.floor(left + 0.5), seen = time() }
	elseif not st then
		ns.db.sayge[key()] = nil
	end
end

--- The other characters with a fortune on record, as { name, class, left } rows, soonest first.
function S.Others()
	local out, me = {}, key()
	for name, row in pairs(ns.db and ns.db.sayge or {}) do
		if name ~= me and type(row) == "table" and row.left then
			out[#out + 1] = { name = name, class = row.class, left = row.left }
		end
	end
	table.sort(out, function(a, b)
		if a.left ~= b.left then
			return a.left < b.left
		end
		return a.name < b.name
	end)
	return out
end

local function changed()
	remember()
	ns.Send("SAYGE")
end

-- Looks at the player's buffs: a fortune Grimoire has not seen starts the count.
function S.Check()
	if not ns.char then
		return
	end
	local a = S.Aura()
	if not a then
		return
	end
	local now = S.Played()
	if not now then
		-- Counted once the game says how long this character has played.
		S.Ask()
		return
	end
	local age = 0
	if plain(a.duration) and plain(a.expires) and a.duration > 0 and a.expires > 0 then
		age = math.max(0, a.duration - (a.expires - GetTime()))
	end
	local st = ns.char.sayge
	local since = st and st.played and (now - st.played)
	-- The fortune on record still counts: this buff is that fortune, unless it was given a moment ago and the one on
	-- record is older (Sayge gave another, whatever the count said).
	if since and since < S.COOLDOWN and not (age < FRESH and since > FRESH + 60) then
		return
	end
	ns.char.sayge = {
		played = now - age,
		at = time() - math.floor(age + 0.5),
		spell = a.spell,
		name = plain(a.name) and a.name or nil,
		icon = plain(a.icon) and a.icon or nil,
		-- Seen after it began (Grimoire was off, or came later): its start comes from the buff's own clock.
		guess = age >= FRESH or nil,
	}
	changed()
	if ns.db and ns.db.saygeTimer ~= false then
		local name = ns.char.sayge.name and ns.Hex(ns.HEX.gold, ns.char.sayge.name) or "Sayge's fortune"
		ns.Print(name .. ". The next one in " .. S.Span(S.Left()) .. " of play on this character: Grimoire counts it.")
	end
end

--- The status in words, for chat and tooltips: "ready", "1h 05m to play" or nil without a fortune on record.
function S.Status()
	local left = S.Left()
	if not left then
		return nil
	end
	return left <= 0 and "ready" or (S.Span(left) .. " to play")
end

-- The moment the count runs out: a note in chat and the alarm clock's ring, once per fortune.
local function tick()
	local st = ns.char and ns.char.sayge
	local left = S.Left()
	if not (st and left) or left > 0 or st.told then
		return
	end
	st.told = true
	changed()
	if ns.db and ns.db.saygeTimer ~= false then
		ns.Print(ns.Hex(ns.HEX.green, "Sayge will read your fortune again") .. ": four hours played since the last one.")
		if PlaySound and SOUNDKIT and SOUNDKIT.ALARM_CLOCK_WARNING_3 then
			PlaySound(SOUNDKIT.ALARM_CLOCK_WARNING_3)
		end
	end
end

--- Prints this character's count and the others'.
function S.Report()
	local status = S.Status()
	local st = ns.char and ns.char.sayge
	if not st then
		ns.Print("no fortune from Sayge on record for this character. Grimoire starts counting when you get one.")
	elseif not status then
		ns.Print("Sayge's fortune: waiting for the game's played time.")
		S.Ask()
	elseif status == "ready" then
		ns.Print("Sayge's fortune: " .. ns.Hex(ns.HEX.green, "ready") .. ", four hours played since the last one.")
	else
		ns.Print("Sayge's fortune: the next one after " .. ns.Hex(ns.HEX.gold, S.Span(S.Left())) .. " more of play on this character (time offline or on other characters does not count)." .. (st.guess and " Estimated: Grimoire saw that fortune after it began." or ""))
	end
	local others = S.Others()
	if #others > 0 then
		local parts = {}
		for _, o in ipairs(others) do
			parts[#parts + 1] = o.name .. " " .. (o.left <= 0 and ns.Hex(ns.HEX.green, "ready") or S.Span(o.left))
		end
		ns.Print("other characters: " .. table.concat(parts, ", ") .. ".")
	end
end

-- Events ------------------------------------------------------------------------------------------------------------

ns.On("TIME_PLAYED_MSG", function(total)
	if not plain(total) or type(total) ~= "number" then
		return
	end
	played = { total = total, at = GetTime() }
	asked = nil
	-- The chat frames get the event back after this one, so the game's line does not show for Grimoire's question.
	if #muted > 0 then
		C_Timer.After(0, unmute)
	end
	S.Check()
	tick()
	changed()
end)

local dirty = false
ns.On("UNIT_AURA", function(unit)
	if unit ~= "player" or dirty then
		return
	end
	dirty = true
	C_Timer.After(0.5, function()
		dirty = false
		S.Check()
	end)
end)

ns.Listen("LOGIN", function()
	learnNames()
	-- Asked only when there is something to count: a fortune on record, or one on the player.
	C_Timer.After(3, function()
		if (ns.char and ns.char.sayge) or S.Aura() then
			S.Ask()
		end
	end)
end)

ns.On("PLAYER_LOGOUT", remember)

-- Once a second while a count runs: the ring when it is done, and every minute the record the other characters show.
local ticker = CreateFrame("Frame")
local since, saved = 0, 0
ticker:SetScript("OnUpdate", function(_, elapsed)
	since, saved = since + elapsed, saved + elapsed
	if since < 1 then
		return
	end
	since = 0
	tick()
	if saved >= 60 then
		saved = 0
		remember()
	end
end)
