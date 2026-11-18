-- Bars: the action bar of the build you follow, put on your main bar with a preview first and an undo after; a new rank
-- swapped in where the rank before it sits; the build's spells marked at your class trainer; and the build's next talent
-- point spent with one click. Bars and talents only change out of combat: what you ask for in a fight waits for it to
-- end. Nothing leaves the game: the undo is kept with this character's settings, and that is all Bars saves.
local _, ns = ...

local B = {}
ns.Bars = B

-- The keys of the main bar, in the order each bar in Data/Bars.lua lists them.
local KEYS = { "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=" }
B.KEYS = KEYS
-- Every action slot a client can have: Classic's 120 and the extra bars of newer clients.
local LAST_SLOT = 180

local function plain(v)
	return v ~= nil and not (issecretvalue and issecretvalue(v))
end

local function inCombat()
	return InCombatLockdown ~= nil and InCombatLockdown() and true or false
end

local function copy(t)
	local out = {}
	for k, v in pairs(t) do
		out[k] = v
	end
	return out
end

-- Waiting for the end of combat ---------------------------------------------------------------------------------

local waiting, waitOrder = {}, {}

--- Runs fn now when out of combat, else once combat ends; a second ask under the same key takes the first one's place.
--- Returns true when it ran now.
function B.OutOfCombat(key, fn)
	if not inCombat() then
		fn()
		return true
	end
	if not waiting[key] then
		waitOrder[#waitOrder + 1] = key
	end
	waiting[key] = fn
	ns.Send("BARS")
	return false
end

--- Whether something asked under key waits for the end of combat.
function B.Waiting(key)
	return waiting[key] ~= nil
end

ns.On("PLAYER_REGEN_ENABLED", function()
	local keys, fns = waitOrder, waiting
	waitOrder, waiting = {}, {}
	for _, key in ipairs(keys) do
		local ok, err = pcall(fns[key])
		if not ok and geterrorhandler then
			geterrorhandler()(err)
		end
	end
	ns.Send("BARS")
end)

--- Out of combat and with nothing on the cursor: Grimoire moves actions with the cursor, so what you are dragging is
--- given a moment rather than dropped.
local function run(key, fn, tries)
	return B.OutOfCombat(key, function()
		if GetCursorInfo and GetCursorInfo() and (tries or 0) < 20 and C_Timer and C_Timer.After then
			C_Timer.After(0.5, function()
				run(key, fn, (tries or 0) + 1)
			end)
			return
		end
		fn()
	end)
end

-- Spells by name and rank ---------------------------------------------------------------------------------------

local function spellName(id)
	if C_Spell and C_Spell.GetSpellName then
		local n = C_Spell.GetSpellName(id)
		if plain(n) and n then
			return n
		end
	end
	if GetSpellInfo then
		local n = GetSpellInfo(id)
		if plain(n) and n then
			return n
		end
	end
end

local function spellTexture(id)
	if C_Spell and C_Spell.GetSpellTexture then
		local t = C_Spell.GetSpellTexture(id)
		if plain(t) and t then
			return t
		end
	end
	if GetSpellTexture then
		local t = GetSpellTexture(id)
		if plain(t) and t then
			return t
		end
	end
end

local ladders = {}

--- A class's trainer spells as ladders of ranks: byKey[key] = { { id, key, name, rank, level, icon }, ... } from the
--- lowest rank up (a key is ns.SpellKey: the name, or "Polymorph|Pig" for a spell of its own), byId[id] = the same rank.
local function ladder(cls)
	local l = ladders[cls]
	if not l then
		l = { byKey = {}, byId = {} }
		for _, a in ipairs(ns.abilities and ns.abilities[cls] or {}) do
			local e = { id = a.id, key = ns.SpellKey(a), name = a.name, rank = ns.RankNumber(a.rank), level = a.level or 1, icon = a.icon }
			l.byKey[e.key] = l.byKey[e.key] or {}
			table.insert(l.byKey[e.key], e)
			l.byId[a.id] = e
		end
		for _, list in pairs(l.byKey) do
			table.sort(list, function(x, y)
				return x.rank < y.rank
			end)
		end
		ladders[cls] = l
	end
	return l
end
B.Ladder = ladder

--- The spell key of a spell id: from Grimoire's data, else by the game's name for it (in any language).
function B.KeyOf(cls, id)
	local l = ladder(cls)
	local e = l.byId[id]
	if e then
		return e.key
	end
	if not l.names then
		-- Keys first, so "Polymorph" stays Polymorph's and never becomes Polymorph: Pig's.
		l.names = {}
		for key in pairs(l.byKey) do
			l.names[key] = key
		end
		for key, list in pairs(l.byKey) do
			local n = list[1] and spellName(list[1].id)
			if n and not l.names[n] then
				l.names[n] = key
			end
		end
	end
	local n = spellName(id)
	return n and l.names[n] or nil
end

--- The highest rank you know of a spell on a bar, as a spell id; nil when you know none. A rank Grimoire's data has no
--- game id for (Lacerate's new ranks) is found by the spell's name in your spellbook.
function B.Best(cls, name)
	local list = ladder(cls).byKey[name]
	if list then
		for i = #list, 1, -1 do
			if ns.Knows(list[i].id) then
				return list[i].id
			end
		end
	end
	local n = (list and list[1] and spellName(list[1].id)) or name
	local id
	if C_Spell and C_Spell.GetSpellInfo then
		local info = C_Spell.GetSpellInfo(n)
		id = type(info) == "table" and info.spellID or nil
	elseif GetSpellInfo then
		id = select(7, GetSpellInfo(n))
	end
	if plain(id) and type(id) == "number" and ns.Knows(id) and spellName(id) == n then
		return id
	end
end

--- When you get a spell you do not know yet: its level and how ("talent", with the build's first point in its talent, or
--- "trainer"). No level when the spell is a talent the build does not take.
function B.WhenLearned(cls, name, build)
	if ns.TalentNames(cls)[name] then
		for _, step in ipairs(build and ns.BuildSteps(build, cls) or {}) do
			local t = step.info and step.info.talent
			if t and t.name == name then
				return ns.PointLevel(step.n), "talent"
			end
		end
		return nil, "talent"
	end
	local list = ladder(cls).byKey[name]
	return list and list[1] and list[1].level or nil, "trainer"
end

--- A spell you do not know yet in two short lines, for under its icon: "at level\n40", "at the\ntrainer", "talent\npoint",
--- "not in\nyour build"; and a sentence for its tooltip.
function B.WhenText(level, how)
	if not level then
		return "not in\nyour build", "Your build does not take the talent that teaches it."
	end
	if level > (ns.player.level or 1) then
		return "at level\n" .. level, (how == "talent" and "Its talent comes at level " or "Learned at level ") .. level .. "."
	end
	if how == "talent" then
		return "talent\npoint", "Your build's talent point for it is ready to spend."
	end
	return "at the\ntrainer", "Ready to learn at your class trainer."
end

-- A build's bar -------------------------------------------------------------------------------------------------

--- A build's suggested bar (12 entries: a name, or false for a key left free) and the build it comes from. Grimoire's
--- builds have their own; one of yours takes the bar of the Grimoire build it began as, else Grimoire's for its spec
--- (leveling below 60, PvE at 60).
function B.Layout(build, cls)
	local bars = ns.bars
	if type(build) ~= "table" or type(bars) ~= "table" then
		return nil
	end
	if bars[build.id] then
		return bars[build.id], build
	end
	local base = build.base and ns.FindBuild(build.base)
	if base and bars[base.id] then
		return bars[base.id], base
	end
	if build.spec then
		local leveling = (ns.player.level or 1) < 60
		local first
		for _, b in ipairs(ns.builds and ns.builds[cls] or {}) do
			if b.spec == build.spec and bars[b.id] then
				if b.kind ~= "pvp" and (b.kind == "leveling") == leveling then
					return bars[b.id], b
				end
				first = first or b
			end
		end
		if first then
			return bars[first.id], first
		end
	end
	return nil
end

-- The main bar --------------------------------------------------------------------------------------------------

--- The slot before the main bar's first button: keys 1 to = act on slots first + 1 to first + 12. That is slots 1 to 12,
--- or the bar of the stance or form you are in (73 to 84 in Battle Stance, Stealth or Cat Form), as the game's main bar
--- works it out. Bar 1 is what keys 1 to = press, so that is where a build's bar goes.
function B.MainBar()
	local page = GetActionBarPage and GetActionBarPage() or 1
	local bonus = GetBonusBarOffset and GetBonusBarOffset() or 0
	page = plain(page) and tonumber(page) or 1
	bonus = plain(bonus) and tonumber(bonus) or 0
	if page == 1 and bonus > 0 then
		page = (NUM_ACTIONBAR_PAGES or 6) + bonus
	end
	return (page - 1) * 12
end

--- The main bar in words: "your main bar", or the stance or form whose bar it is now ("your Battle Stance bar").
function B.BarName(first)
	if first == 0 then
		return "your main bar"
	end
	local form = GetShapeshiftForm and GetShapeshiftForm() or 0
	if plain(form) and type(form) == "number" and form > 0 and GetShapeshiftFormInfo then
		-- (icon, name, active, castable) on older clients, (icon, active, castable, spell id) on newer ones
		local _, b, _, d = GetShapeshiftFormInfo(form)
		local name = (plain(b) and type(b) == "string" and b) or (plain(d) and type(d) == "number" and d > 1 and spellName(d)) or nil
		if name then
			return "your " .. name .. " bar"
		end
	end
	if first < 72 then
		return "page " .. (math.floor(first / 12) + 1) .. " of your main bar"
	end
	return "your main bar"
end

--- What an action slot holds, in a form Grimoire can put back: { kind = "spell" | "macro" | "item", id, name }, nil
--- when empty. Anything else (a pet's action, an equipment set, a mount) is { keep = true }: Grimoire never changes such
--- a slot, since Undo could not put it back.
function B.ReadSlot(slot)
	if not (HasAction and HasAction(slot)) then
		return nil
	end
	local kind, id, sub = GetActionInfo(slot)
	if not (plain(kind) and plain(id)) then
		return { kind = "unknown", keep = true }
	end
	if kind == "spell" and sub ~= "pet" and type(id) == "number" then
		return { kind = "spell", id = id }
	elseif kind == "macro" then
		local name = GetActionText and GetActionText(slot)
		return { kind = "macro", id = id, name = plain(name) and name or nil }
	elseif kind == "item" and type(id) == "number" then
		return { kind = "item", id = id }
	end
	return { kind = tostring(kind), id = id, keep = true }
end

--- Whether two slot contents are the same action (nil for an empty slot).
function B.Same(a, b)
	if not a or not b then
		return not a and not b
	end
	if a.kind ~= b.kind then
		return false
	end
	if a.kind == "macro" and a.name and b.name then
		return a.name == b.name
	end
	return a.id == b.id
end

--- Puts an action in a slot through the cursor, which the slot's old action leaves on. False when the game would not
--- pick the action up (an item no longer in your bags, a deleted macro): the slot then stays as it was.
local function put(slot, what)
	ClearCursor()
	if what.kind == "spell" then
		local pickup = (C_Spell and C_Spell.PickupSpell) or PickupSpell
		pickup(what.id)
	elseif what.kind == "macro" then
		-- by name first: a macro's number changes when one before it is deleted
		local index = what.name and GetMacroIndexByName and GetMacroIndexByName(what.name)
		PickupMacro((index and index > 0) and index or what.id)
	elseif what.kind == "item" then
		local pickup = (C_Item and C_Item.PickupItem) or PickupItem
		pickup(what.id)
	end
	local held = GetCursorInfo() and true or false
	if held then
		PlaceAction(slot)
	end
	ClearCursor()
	return held
end

local function clear(slot)
	ClearCursor()
	PickupAction(slot)
	ClearCursor()
end

-- Set up my bars ------------------------------------------------------------------------------------------------

--- What Set up my bars would do now for a build: { first, bar, from, slots, changes, later, kept }, with for each key
--- { slot, key, now, name, spell, after, change } and, for a spell you do not know yet, its level and how. after is
--- what the slot holds afterwards: the build's spell at its best rank you know, else what is there now. The same spell
--- elsewhere on the bar moves (moved: the key it goes to), and a slot holding what Grimoire could not put back stays
--- (kept). Nil when the build has no bar.
function B.Plan(build, cls)
	local layout, from = B.Layout(build, cls)
	if not layout then
		return nil
	end
	local first = B.MainBar()
	local plan = { first = first, bar = B.BarName(first), from = from, build = build, slots = {}, changes = 0, later = 0, kept = 0 }
	local placing = {}
	for i = 1, 12 do
		local s = { slot = first + i, key = KEYS[i] }
		s.now = B.ReadSlot(s.slot)
		if type(layout[i]) == "string" then
			s.name = layout[i]
			if s.now and s.now.keep then
				s.kept = true
			else
				s.spell = B.Best(cls, s.name)
				if s.spell then
					placing[s.name] = i
				else
					s.level, s.how = B.WhenLearned(cls, s.name, build)
				end
			end
		end
		plan.slots[i] = s
	end
	for _, s in ipairs(plan.slots) do
		local movable = s.now and s.now.kind == "spell" and not s.now.keep
		local goes = movable and not s.spell and placing[B.KeyOf(cls, s.now.id) or ""]
		if s.spell then
			s.after = { kind = "spell", id = s.spell }
		elseif goes then
			s.moved, s.after = goes, nil
		else
			s.after = s.now
		end
		s.change = not B.Same(s.now, s.after)
		if s.change then
			plan.changes = plan.changes + 1
		end
		if s.name and not s.spell and not s.kept then
			plan.later = plan.later + 1
		end
		if s.kept then
			plan.kept = plan.kept + 1
		end
	end
	return plan
end

local function note(text, color)
	B.note = { text = text, color = color }
end

--- Sets up the main bar for the build you follow; asked in combat, it waits for combat to end. The 12 slots as they were
--- are kept for Undo first.
function B.Apply()
	note(inCombat() and "Waits for the end of combat." or nil)
	return run("bars", function()
		local cls = ns.player.class
		local build = cls and ns.SelectedBuild()
		local plan = build and B.Plan(build, cls)
		if not plan then
			note(nil)
			return
		end
		if plan.changes == 0 then
			-- nothing to do, and the undo of the last set-up stays
			note("Your bar already matches the build.")
			ns.Send("BARS")
			return
		end
		local undo = { first = plan.first, build = build.id, slots = {} }
		for i, s in ipairs(plan.slots) do
			undo.slots[i] = s.now and copy(s.now) or false
		end
		ns.char.barsUndo = undo
		for _, s in ipairs(plan.slots) do
			if s.change then
				if s.after then
					put(s.slot, s.after)
				else
					clear(s.slot)
				end
			end
		end
		note("Done: " .. plan.changes .. (plan.changes == 1 and " key" or " keys") .. " set. Undo puts all 12 back as they were.", "green")
		ns.Send("BARS")
	end)
end

--- Whether there is a set-up to undo.
function B.CanUndo()
	local u = ns.char and ns.char.barsUndo
	return type(u) == "table" and type(u.slots) == "table"
end

--- Puts the 12 keys of the last set-up back exactly as they were: spells, macros and items, and the empty ones empty.
function B.Undo()
	if not B.CanUndo() then
		return false
	end
	note(inCombat() and "Undo waits for the end of combat." or nil)
	return run("bars", function()
		local u = ns.char.barsUndo
		if type(u) ~= "table" then
			return
		end
		local missed = 0
		for i = 1, 12 do
			local slot = (tonumber(u.first) or 0) + i
			local want = u.slots[i] or nil
			if not (want and want.keep) and not B.Same(B.ReadSlot(slot), want) then
				if not want then
					clear(slot)
				elseif not put(slot, want) then
					missed = missed + 1
				end
			end
		end
		ns.char.barsUndo = nil
		if missed > 0 then
			note(missed .. (missed == 1 and " key" or " keys") .. " could not come back: an item no longer in your bags, or a deleted macro.", "red")
		else
			note("Your bar is back as it was.")
		end
		ns.Send("BARS")
	end)
end

-- New ranks -----------------------------------------------------------------------------------------------------

local known -- the best rank you know of each spell, as last seen
local swaps = {} -- [spell key] = { from = rank, to = rank }: swaps waiting for the end of combat

--- Swaps rank to of a spell in wherever rank from sits, on every action slot; returns how many slots changed. Only the
--- rank that was your best is replaced: a lower one on your bars is there on purpose (a cheap Frostbolt to slow, a small
--- heal to save mana).
function B.SwapRank(cls, key, from, to)
	local list = ladder(cls).byKey[key]
	if not list or to <= from then
		return 0
	end
	local fromIds, toId = {}, nil
	for _, e in ipairs(list) do
		if e.rank == from then
			fromIds[e.id] = true
		elseif e.rank == to and ns.Knows(e.id) then
			toId = e.id
		end
	end
	if not toId then
		return 0
	end
	local n = 0
	for slot = 1, LAST_SLOT do
		if HasAction(slot) then
			local kind, id = GetActionInfo(slot)
			if kind == "spell" and plain(id) and fromIds[id] then
				put(slot, { kind = "spell", id = toId })
				n = n + 1
			end
		end
	end
	return n
end

local function flushSwaps()
	local cls = ns.player.class
	local list = swaps
	swaps = {}
	for key, s in pairs(list) do
		if cls and ns.db and ns.db.barRanks ~= false then
			local n = B.SwapRank(cls, key, s.from, s.to)
			if n > 0 then
				local name = key:match("^[^|]+")
				ns.Print("new rank on your bars: " .. ns.Hex(ns.HEX.blue, name .. " (Rank " .. s.to .. ")") .. (n > 1 and (", " .. n .. " buttons") or "") .. ".")
			end
		end
	end
end

--- Compares the ranks you know with the last look and swaps each new rank in. The first look only takes note.
function B.CheckRanks()
	if not ns.player.class then
		return
	end
	local now = ns.KnownRanks()
	local before = known
	known = now
	if not before or not (ns.db and ns.db.barRanks ~= false) then
		return
	end
	local found = false
	for key, r in pairs(now) do
		local was = before[key] or 0
		if was > 0 and r > was then
			local s = swaps[key]
			swaps[key] = { from = s and s.from or was, to = r }
			found = true
		end
	end
	if found then
		run("ranks", flushSwaps)
	end
end

local checking = false
local function checkSoon()
	if checking then
		return
	end
	checking = true
	local function go()
		checking = false
		B.CheckRanks()
	end
	if C_Timer and C_Timer.After then
		C_Timer.After(0.3, go)
	else
		go()
	end
end

ns.Listen("LOGIN", function()
	known = ns.KnownRanks()
end)
ns.On("SPELLS_CHANGED", checkSoon)

-- The class trainer ---------------------------------------------------------------------------------------------

local trainer = { hooked = false, tags = {} }

--- The followed build's bar spells under every name a trainer may list them by: Grimoire's and the game's own.
function B.TrainerNames()
	local cls = ns.player.class
	local build = cls and ns.SelectedBuild()
	local layout = build and B.Layout(build, cls)
	if not layout then
		return nil
	end
	local names = {}
	for i = 1, 12 do
		local name = layout[i]
		if type(name) == "string" then
			names[name] = true
			local list = ladder(cls).byKey[name]
			local own = list and list[1] and spellName(list[1].id)
			if own then
				names[own] = true
			end
		end
	end
	return names, build
end

--- Copper as the site writes money: "1g 20s", "45s", "80c".
function B.Money(copper)
	copper = math.max(0, math.floor(tonumber(copper) or 0))
	local g, s, c = math.floor(copper / 10000), math.floor(copper / 100) % 100, copper % 100
	local parts = {}
	if g > 0 then
		parts[#parts + 1] = g .. "g"
	end
	if s > 0 then
		parts[#parts + 1] = s .. "s"
	end
	if c > 0 and g == 0 then
		parts[#parts + 1] = c .. "c"
	end
	return #parts > 0 and table.concat(parts, " ") or "0c"
end

--- What the trainer has for the build now: how many of its bar's spells you can learn here and what they cost.
function B.TrainerSummary(names)
	local count, cost, seen = 0, 0, {}
	for index = 1, (GetNumTrainerServices and GetNumTrainerServices() or 0) do
		local name, _, kind = GetTrainerServiceInfo(index)
		if kind == "available" and plain(name) and names[name] then
			cost = cost + (tonumber((GetTrainerServiceCost(index))) or 0)
			if not seen[name] then
				seen[name] = true
				count = count + 1
			end
		end
	end
	return count, cost
end

--- A small gold tag at the right of a trainer row.
local function tagFor(row)
	local tag = trainer.tags[row]
	if not tag then
		local UI = ns.UI
		tag = CreateFrame("Frame", nil, row)
		tag:SetHeight(14)
		tag:SetPoint("RIGHT", row, "RIGHT", -4, 0)
		local s = UI.Surface(tag, 7)
		local c = UI.colors.gilt
		s:SetFill(c[1], c[2], c[3], 0.18)
		s:SetBorder(c[1], c[2], c[3], 0.6)
		tag.text = UI.Text(tag, 9.5, ns.RGB.gold, { weight = "bold", justify = "CENTER" })
		tag.text:SetPoint("CENTER", 0, 0.5)
		tag.text:SetText("Build")
		tag:SetWidth(math.ceil(UI.TextWidth(tag.text)) + 12)
		trainer.tags[row] = tag
	end
	return tag
end

local function markRow(row, index, names)
	local show = false
	if names and row:IsShown() and type(index) == "number" then
		local name, _, kind = GetTrainerServiceInfo(index)
		show = kind ~= "header" and plain(name) and names[name] and true or false
	end
	if show or trainer.tags[row] then
		tagFor(row):SetShown(show)
	end
end

--- The line over the trainer window: "Your build: 3 spells, 1g 20s".
local function summaryChip()
	if not trainer.chip then
		local UI = ns.UI
		local chip = CreateFrame("Frame", nil, ClassTrainerFrame)
		chip:SetHeight(24)
		-- Centred over the window as drawn: Classic's frame is wider than its art, which its hit insets leave out.
		local left, right = 0, 0
		if ClassTrainerFrame.GetHitRectInsets then
			left, right = ClassTrainerFrame:GetHitRectInsets()
		end
		chip:SetPoint("BOTTOM", ClassTrainerFrame, "TOP", ((tonumber(left) or 0) - (tonumber(right) or 0)) / 2, -6)
		chip:SetFrameLevel(ClassTrainerFrame:GetFrameLevel() + 20)
		UI.Surface(chip, 12, UI.colors.menu, UI.colors.giltLine)
		chip.text = UI.Text(chip, 11.5, ns.RGB.white, { weight = "medium" })
		chip.text:SetPoint("CENTER", 0, 0.5)
		chip:EnableMouse(true)
		chip:SetScript("OnEnter", function(self)
			if self.build then
				UI.TextTooltip(self, "Your build: " .. ns.BuildTitle(self.build), { { "The spells on this build's bar, the ones you can learn now, at this trainer's prices. Rows with a gold tag are its spells.", 1, 1, 1 } }, "ANCHOR_BOTTOM")
			end
		end)
		chip:SetScript("OnLeave", function()
			GameTooltip:Hide()
		end)
		trainer.chip = chip
	end
	return trainer.chip
end

--- Marks the build's spells in the trainer's list and says what they cost. Class trainers only.
function B.UpdateTrainer()
	if not (ClassTrainerFrame and ClassTrainerFrame:IsShown()) then
		return
	end
	local names, build = B.TrainerNames()
	if IsTradeskillTrainer and IsTradeskillTrainer() then
		names = nil
	end
	-- Classic's list: a row per button, its service in the button's id.
	for i = 1, (CLASS_TRAINER_SKILLS_DISPLAYED or 11) do
		local row = _G["ClassTrainerSkill" .. i]
		if row then
			markRow(row, row:GetID(), names)
		end
	end
	-- A newer list draws its rows through a scroll box.
	local box = ClassTrainerFrame.ScrollBox
	if type(box) == "table" and box.ForEachFrame then
		pcall(box.ForEachFrame, box, function(row, data)
			markRow(row, type(data) == "number" and data or type(data) == "table" and (data.skillIndex or data.index) or row:GetID(), names)
		end)
	end
	local chip = summaryChip()
	if not names then
		chip:Hide()
		return
	end
	local count, cost = B.TrainerSummary(names)
	local text
	if count > 0 then
		local money = B.Money(cost)
		local short = GetMoney and GetMoney() < cost
		text = "Your build: " .. count .. (count == 1 and " spell, " or " spells, ") .. ns.Hex(short and ns.HEX.red or ns.HEX.gold, money)
	else
		text = "Your build: nothing to learn here now"
	end
	chip.build = build
	chip.text:SetText(text)
	chip:SetWidth(math.ceil(ns.UI.TextWidth(chip.text)) + 28)
	chip:Show()
end

-- The trainer window loads with its add-on, Blizzard_TrainerUI, the first time a trainer is opened.
local function hookTrainer()
	if trainer.hooked or not ClassTrainerFrame then
		return
	end
	trainer.hooked = true
	if type(ClassTrainerFrame_Update) == "function" then
		hooksecurefunc("ClassTrainerFrame_Update", B.UpdateTrainer)
	end
	ClassTrainerFrame:HookScript("OnShow", B.UpdateTrainer)
	local box = ClassTrainerFrame.ScrollBox
	if type(box) == "table" and ScrollUtil and ScrollUtil.AddInitializedFrameCallback then
		pcall(ScrollUtil.AddInitializedFrameCallback, box, function()
			B.UpdateTrainer()
		end, trainer)
	end
end

ns.On("ADDON_LOADED", function(name)
	if name == "Blizzard_TrainerUI" then
		hookTrainer()
	end
end)
ns.Listen("LOGIN", function()
	if ClassTrainerFrame then
		hookTrainer()
	end
end)

-- The build's next talent point ---------------------------------------------------------------------------------

--- Your talents through the game's classic talent frame: { [talent id] = rank }, the points spent, and where each talent
--- is for LearnTalent ({ tab, index }). Nil when the client has no such frame, or its trees are not Grimoire's (a talent
--- missing where Grimoire puts it, or with another number of ranks).
local function classicTalents(cls)
	if not (GetNumTalents and GetTalentInfo and LearnTalent) then
		return nil
	end
	local trees = ns.talents and ns.talents[cls] and ns.talents[cls].trees
	if not trees then
		return nil
	end
	local ok, ranks, spent, where = pcall(function()
		local ranks, spent, where = {}, 0, {}
		for tab, tree in ipairs(trees) do
			local n = GetNumTalents(tab)
			if type(n) ~= "number" or n < 1 then
				return nil
			end
			local byPlace = {}
			for i = 1, n do
				local name, _, tier, column, rank, maxRank = GetTalentInfo(tab, i)
				if type(tier) == "number" and type(column) == "number" then
					byPlace[tier .. ":" .. column] = { index = i, name = name, rank = tonumber(rank) or 0, max = tonumber(maxRank) or 0 }
				end
			end
			for _, t in ipairs(tree.talents) do
				local g = byPlace[(t.row + 1) .. ":" .. (t.col + 1)]
				if not g or g.max ~= t.max then
					return nil
				end
				where[t.id] = { tab = tab, index = g.index }
				if g.rank > 0 then
					ranks[t.id] = g.rank
					spent = spent + g.rank
				end
			end
		end
		return ranks, spent, where
	end)
	if ok and ranks then
		return ranks, spent, where
	end
	return nil
end

local function unspentPoints()
	local n = ns.UnspentPoints()
	if n then
		return n
	end
	if UnitCharacterPoints then
		local p = UnitCharacterPoints("player")
		if plain(p) and type(p) == "number" then
			return p
		end
	end
	return nil
end

-- A respec path ----------------------------------------------------------------------------------------------------

--- Your talents, from the game's talent system or the classic talent frame; nil when neither reads.
local function talentsNow(cls)
	return ns.ReadTalents() or (classicTalents(cls))
end

--- Whether talents hold no point a build does not take: none spent, as after a reset, fits every build.
local function fits(ranks, build, cls)
	local most = {}
	for _, s in ipairs(ns.BuildSteps(build, cls)) do
		most[s.id] = s.rank
	end
	for id, r in pairs(ranks) do
		if r > (most[id] or 0) then
			return false
		end
	end
	return true
end

--- Where a build's respecs stand for your level and talents. A Grimoire build can respec into another at a level (next =
--- { id, at }: Discipline leveling into Shadow leveling at 40, a raid or tank build at 60). A respec is a choice: the build stays yours until that level has
--- come and your talents fit the next build (none spent after the reset, or only its points); then that one is, and on
--- through its own respec. Returns the build whose points you spend now, and the build the last respec came from.
local function along(build, cls, ranks)
	local from, seen = nil, {}
	-- seen: a respec back to a build already passed would loop for ever (the data's lint refuses one)
	while build and build.next and not seen[build] and (ns.player.level or 1) >= build.next.at do
		local n = ns.FindBuild(build.next.id)
		if not (n and ranks and fits(ranks, n, cls)) then
			break
		end
		seen[build] = true
		build, from = n, build
	end
	return build, from
end

--- The build a build you follow can respec into now: once the respec's level has come, while your talents are not
--- the next build's (no reset yet, or they cannot be read). Nil otherwise.
function B.OpenRespec(build, cls)
	local into = build and build.next and (ns.player.level or 1) >= build.next.at and ns.FindBuild(build.next.id)
	if into then
		local ranks = talentsNow(cls)
		if not (ranks and fits(ranks, into, cls)) then
			return into
		end
	end
	return nil
end

--- Whether your talents hold every point a build plans, so it has none left to offer. False when they cannot be read.
function B.Complete(build, cls)
	local ranks = talentsNow(cls)
	if not ranks then
		return false
	end
	for _, s in ipairs(ns.BuildSteps(build, cls)) do
		if (ranks[s.id] or 0) < s.rank then
			return false
		end
	end
	return true
end

--- The build you follow, along its respecs: once the respec's level has come and your talents fit the build it goes
--- into, Grimoire follows that build and says so. Back the other way when your talents hold the build the respec came
--- from and not the new one: the other set of Secondary Talents. Returns the build followed, and the build it can
--- respec into now (B.OpenRespec).
function B.FollowPath()
	local cls = ns.player.class
	local build = cls and ns.SelectedBuild()
	if not build then
		return nil
	end
	local ranks = talentsNow(cls)
	local back = ns.char.respecFrom and ns.FindBuild(ns.char.respecFrom)
	if back and ranks and not fits(ranks, build, cls) and fits(ranks, back, cls) then
		ns.SelectBuild(back.id)
		ns.Print("following " .. ns.Hex(ns.HEX.gold, ns.BuildTitle(back)) .. " again: your talents hold its points.")
		build = back
	end
	local now, from = along(build, cls, ranks)
	if now ~= build then
		ns.SelectBuild(now.id)
		-- remembered until you pick a build yourself (ns.SelectBuild), to come back to it
		ns.char.respecFrom = from.id
		ns.Print("following " .. ns.Hex(ns.HEX.gold, ns.BuildTitle(now)) .. " now: " .. ns.BuildTitle(from) .. " respecs into it at " .. from.next.at .. ".")
	end
	return now, B.OpenRespec(now, cls)
end

--- The respec in words: lead ("respec", "or respec") .. " into Shadow leveling at your class trainer: 1 gold if it is your
--- first reset, ... Grimoire follows it after the reset."
function B.RespecText(build, into, lead)
	return lead .. " into " .. ns.Hex(ns.HEX.gold, ns.BuildTitle(into)) .. " at your class trainer: " .. build.next.cost .. " Grimoire follows it after the reset."
end

--- The point Learn next point would spend: the build's first point you have not spent, when you have a point for it
--- and the talent rules allow it now; once your talents fit the build a respec goes into, in that build (along). Returns
--- the step, nil and how, and where to learn it; or nil, why not, and the step when there is one: "done", "unread" (your
--- talents cannot be read), "points" (none to spend: the step says when the next one comes), "max", "tier", "prereq", or
--- "none" (no build).
function B.NextPoint(build, cls)
	if type(build) ~= "table" or not cls then
		return nil, "none"
	end
	local ranks, how, where = ns.ReadTalents(), "traits", nil
	if not ranks then
		local r, _, w = classicTalents(cls)
		ranks, how, where = r, "classic", w
	end
	if not ranks then
		return nil, "unread"
	end
	build = along(build, cls, ranks)
	local step
	for _, s in ipairs(ns.BuildSteps(build, cls)) do
		if (ranks[s.id] or 0) < s.rank then
			step = s
			break
		end
	end
	if not step then
		return nil, "done"
	end
	local free = unspentPoints()
	if free == nil then
		free = ns.PointsAvailable() - ns.TalentRules.Total(cls, ranks)
	end
	if free < 1 then
		return nil, "points", step
	end
	local block = ns.TalentRules.Block(cls, ranks, step.id)
	if block then
		return nil, block, step
	end
	return step, how, where
end

--- A step as a line: "Improved Rend (Arms, rank 3 of 3)".
function B.StepText(step)
	local t = step and step.info and step.info.talent
	if not t then
		return "?"
	end
	return t.name .. " (" .. step.info.treeName .. ", rank " .. step.rank .. " of " .. t.max .. ")"
end

local function learnClassic(where, step)
	local w = where and where[step.id]
	if not w then
		return false
	end
	local _, _, _, _, rank = GetTalentInfo(w.tab, w.index)
	if (tonumber(rank) or 0) ~= step.rank - 1 then
		return false
	end
	LearnTalent(w.tab, w.index)
	return true
end

-- The newer talent system: the talent's trait node, bought and committed. Grimoire never commits changes you made in the
-- talent window and have not applied yet.
local function learnTraits(step)
	if not (C_ClassTalents and C_ClassTalents.GetActiveConfigID and C_Traits and C_Traits.PurchaseRank and ns.TalentOfNode) then
		return false
	end
	local configID = C_ClassTalents.GetActiveConfigID()
	if not configID or (C_Traits.ConfigHasStagedChanges and C_Traits.ConfigHasStagedChanges(configID)) then
		return false
	end
	local config = C_Traits.GetConfigInfo(configID)
	for _, treeID in ipairs(config and config.treeIDs or {}) do
		for _, nodeID in ipairs(C_Traits.GetTreeNodes(treeID) or {}) do
			local node = C_Traits.GetNodeInfo(configID, nodeID)
			local entryID = node and ((node.activeEntry and node.activeEntry.entryID) or (node.entryIDs and node.entryIDs[1]))
			local entry = entryID and C_Traits.GetEntryInfo(configID, entryID)
			local def = entry and entry.definitionID and C_Traits.GetDefinitionInfo(entry.definitionID)
			local t = def and ns.TalentOfNode(node, def)
			if t and t.id == step.id then
				if (node.ranksPurchased or node.activeRank or 0) ~= step.rank - 1 then
					return false
				end
				if C_Traits.CanPurchaseRank and not C_Traits.CanPurchaseRank(configID, nodeID, entryID) then
					return false
				end
				if not C_Traits.PurchaseRank(configID, nodeID) then
					return false
				end
				local commit = C_ClassTalents.CommitConfig or C_Traits.CommitConfig
				if commit and commit(configID) then
					return true
				end
				if C_Traits.RollbackConfig then
					C_Traits.RollbackConfig(configID)
				end
				return false
			end
		end
	end
	return false
end

local WHY = {
	done = "your talents already match every point the build plans.",
	unread = "Grimoire cannot read your talents on this client: spend the point in the talent window.",
	points = "you have no talent point to spend yet.",
	max = "that talent is already at its highest rank.",
	tier = "its row is not open yet: spend the build's earlier points first.",
	prereq = "the talent it needs comes first.",
	none = "you are not following a build.",
}
B.WHY = WHY

-- The point asked for and not yet confirmed: until the game answers, your talents still read as before it, so a second
-- click would name the same point again. One point at a time.
local learning

--- Spends the build's next point, out of combat (asked in combat, it waits). expected is the step the player saw: a
--- click on an old button or chat link never spends a different point than it named.
function B.LearnNext(expected)
	if inCombat() and not B.Waiting("talent") then
		ns.Print("your next talent point is learned when combat ends.")
	end
	return run("talent", function()
		if learning then
			return
		end
		local cls = ns.player.class
		local build = cls and ns.SelectedBuild()
		local step, how, where = B.NextPoint(build, cls)
		if not step then
			ns.Print("no talent point learned: " .. (WHY[how] or "it is not legal now."))
			return
		end
		if expected and (expected.id ~= step.id or expected.rank ~= step.rank) then
			ns.Print("your next talent point is now " .. ns.Hex(ns.HEX.gold, B.StepText(step)) .. ". Learn it from " .. ns.Hex(ns.HEX.gold, "/grim talents") .. ".")
			return
		end
		local ok, asked
		if how == "classic" then
			ok, asked = pcall(learnClassic, where, step)
		else
			ok, asked = pcall(learnTraits, step)
		end
		if not (ok and asked) then
			ns.Print("the game did not take that point: spend it in the talent window.")
			return
		end
		learning = step
		-- The game answers a moment later; the point counts once the talents read as learned.
		local function confirm()
			learning = nil
			ns.ForgetTalents()
			local ranks = ns.ReadTalents() or classicTalents(cls)
			if ranks and (ranks[step.id] or 0) >= step.rank then
				ns.Print("learned " .. ns.Hex(ns.HEX.gold, B.StepText(step)) .. ".")
			end
			ns.Send("TALENTS")
		end
		if C_Timer and C_Timer.After then
			C_Timer.After(0.8, confirm)
		else
			confirm()
		end
	end)
end

-- A chat link that learns the point the level-up note names: a link type every client lets addons click (the one DBM
-- and WeakAuras use), answered here and nowhere else.
local LINK = "garrmission:grimoire:learn:"

--- " [Learn it]" for a level-up note about step: a link that spends it, when it is legal now; else "".
function B.LearnLink(step)
	if not (step and hooksecurefunc and SetItemRef) then
		return ""
	end
	local nextStep = B.NextPoint(ns.SelectedBuild(), ns.player.class)
	if not nextStep or nextStep.id ~= step.id or nextStep.rank ~= step.rank then
		return ""
	end
	return "  |cff" .. ns.HEX.gold .. "|H" .. LINK .. step.id .. ":" .. step.rank .. "|h[Learn it]|h|r"
end

if hooksecurefunc and SetItemRef then
	hooksecurefunc("SetItemRef", function(link, _, button)
		-- A plain left click only: shift-clicking a link to quote it, or a right click, spends nothing.
		if type(link) ~= "string" or (button and button ~= "LeftButton") or (IsModifiedClick and IsModifiedClick()) then
			return
		end
		local id, rank = link:match("^" .. LINK:gsub("%p", "%%%0") .. "(%d+):(%d+)")
		if id then
			B.LearnNext({ id = tonumber(id), rank = tonumber(rank) })
		end
	end)
end

-- The preview panel ---------------------------------------------------------------------------------------------

local PAD, GUTTER, ICON = 12, 40, 24
B.PANEL_HEIGHT = 172

local function setIcon(icon, texture, grey)
	icon.texture:SetTexture(texture)
	if icon.texture.SetDesaturated then
		icon.texture:SetDesaturated(grey and true or false)
	end
	icon.texture:SetAlpha(grey and 0.45 or 1)
	if texture then
		icon.edge:SetVertexColor(0, 0, 0, 0.9)
	else
		-- an empty key: a faint well
		icon.edge:SetVertexColor(1, 1, 1, 0.07)
	end
end

local function slotTooltip(owner, s, which)
	local UI = ns.UI
	if which == "now" then
		if s.now and GameTooltip.SetAction then
			GameTooltip:SetOwner(owner, "ANCHOR_RIGHT")
			GameTooltip:SetAction(s.slot)
			GameTooltip:AddLine("On key " .. s.key .. " now.", 0.64, 0.62, 0.58)
			GameTooltip:Show()
		else
			UI.TextTooltip(owner, "Key " .. s.key, { { "Empty now.", 0.64, 0.62, 0.58 } })
		end
		return
	end
	local lines = {}
	if s.kept then
		UI.TextTooltip(owner, s.name, { { "Stays as it is: this key holds something Undo could not put back, so Grimoire leaves it alone.", 1, 1, 1 } })
		return
	end
	if s.spell then
		UI.SpellTooltip(owner, s.spell, s.name)
		GameTooltip:AddLine(s.change and ("Goes on key " .. s.key .. ".") or ("Already on key " .. s.key .. "."), 0.6, 0.89, 0.48)
		GameTooltip:Show()
		return
	end
	if s.name then
		local _, sentence = B.WhenText(s.level, s.how)
		lines[#lines + 1] = { sentence, 1, 0.82, 0 }
		lines[#lines + 1] = { "Not known yet, so the key keeps what it has. Set up again once you have it.", 0.64, 0.62, 0.58 }
		UI.TextTooltip(owner, s.name, lines)
		return
	end
	if s.moved then
		UI.TextTooltip(owner, "Key " .. s.key, { { "Empties: this spell moves to key " .. KEYS[s.moved] .. ".", 1, 1, 1 } })
		return
	end
	UI.TextTooltip(owner, "Key " .. s.key, { { s.now and "Stays as it is: the build leaves this key to you." or "Stays empty: the build leaves this key free.", 0.64, 0.62, 0.58 } })
end

--- The preview: the 12 keys as they are now and as Set up my bars leaves them, with Apply and Undo. For the Talents page;
--- it shows the build you follow. panel:Update() redraws it.
function B.Panel(parent)
	local UI = ns.UI
	local p = UI.Card(parent)
	p:SetHeight(B.PANEL_HEIGHT)
	p.title = UI.Text(p, 12, ns.RGB.white, { weight = "bold" })
	p.title:SetPoint("TOPLEFT", PAD + 2, -PAD)
	p.from = UI.Text(p, 11, ns.RGB.mist, { justify = "RIGHT" })
	p.from:SetPoint("TOPRIGHT", -PAD, -PAD - 1)
	p.title:SetPoint("RIGHT", p.from, "LEFT", -10, 0)
	p.nowLabel = UI.Text(p, 10.5, ns.RGB.fog, { weight = "medium" })
	p.nowLabel:SetText("Now")
	p.afterLabel = UI.Text(p, 10.5, ns.RGB.fog, { weight = "medium" })
	p.afterLabel:SetText("After")
	p.cols = {}
	for i = 1, 12 do
		local c = CreateFrame("Frame", nil, p)
		c:SetSize(34, 100)
		c.key = UI.Text(c, 10, ns.RGB.fog, { weight = "medium", justify = "CENTER" })
		c.key:SetPoint("TOP", 0, 0)
		c.now = UI.Icon(c, ICON)
		c.now:SetPoint("TOP", 0, -14)
		c.after = UI.Icon(c, ICON)
		c.after:SetPoint("TOP", c.now, "BOTTOM", 0, -6)
		-- a gold ring round a key that changes
		c.ring = CreateFrame("Frame", nil, c)
		c.ring:SetPoint("TOPLEFT", c.after, "TOPLEFT", -2, 2)
		c.ring:SetPoint("BOTTOMRIGHT", c.after, "BOTTOMRIGHT", 2, -2)
		c.ring.shape = UI.Ring(c.ring, 6, UI.colors.giltLine, "OVERLAY")
		c.caption = UI.Text(c, 8.5, ns.RGB.mist, { justify = "CENTER" })
		c.caption:SetPoint("TOP", c.after, "BOTTOM", 0, -3)
		c.caption:SetWordWrap(true)
		c.caption:SetSpacing(1)
		for _, which in ipairs({ "now", "after" }) do
			local icon = c[which]
			icon:EnableMouse(true)
			icon:SetScript("OnEnter", function(self)
				if c.slot then
					slotTooltip(self, c.slot, which)
				end
			end)
			icon:SetScript("OnLeave", function()
				GameTooltip:Hide()
			end)
		end
		p.cols[i] = c
	end
	p.apply = UI.Button(p, "Apply", 80, 26, function()
		B.Apply()
		p:Update()
	end, "primary")
	p.apply:SetPoint("BOTTOMLEFT", PAD, PAD)
	p.apply.tip = "Puts the build's spells you know on these keys, the best rank of each. Keys whose spell you do not have yet keep what they hold."
	p.undo = UI.Button(p, "Undo", 70, 26, function()
		B.Undo()
		p:Update()
	end)
	p.undo:SetPoint("LEFT", p.apply, "RIGHT", 8, 0)
	p.undo.tip = "Puts the 12 keys back as they were before the last set-up: spells, macros and items."
	p.note = UI.Text(p, 11, ns.RGB.mist, { wrap = true, spacing = 2 })
	p.note:SetPoint("LEFT", p.undo, "RIGHT", 12, 0)
	p.note:SetPoint("RIGHT", p, "RIGHT", -PAD, 0)
	p.note:SetMaxLines(2)

	function p:Layout()
		local width = self:GetWidth()
		if not width or width <= 0 then
			width = 468
		end
		local colW = math.max(26, math.floor((width - PAD * 2 - GUTTER) / 12))
		local top = PAD + 22
		for i, c in ipairs(self.cols) do
			c:SetWidth(colW)
			c:ClearAllPoints()
			c:SetPoint("TOPLEFT", self, "TOPLEFT", PAD + GUTTER + (i - 1) * colW, -top)
			c.caption:SetWidth(colW + 4)
		end
		self.nowLabel:ClearAllPoints()
		self.nowLabel:SetPoint("LEFT", self, "TOPLEFT", PAD + 2, -(top + 14 + ICON / 2))
		self.afterLabel:ClearAllPoints()
		self.afterLabel:SetPoint("LEFT", self, "TOPLEFT", PAD + 2, -(top + 14 + ICON + 6 + ICON / 2))
	end
	p:SetScript("OnSizeChanged", p.Layout)

	function p:Update()
		self:Layout()
		local cls = ns.player.class
		local build = cls and ns.SelectedBuild()
		local plan = build and B.Plan(build, cls)
		self.plan = plan
		if not plan then
			self.title:SetText("This build has no suggested bar.")
			self.from:SetText("")
			for _, c in ipairs(self.cols) do
				c:Hide()
			end
			self.apply:Disable()
			self.undo:SetEnabled(B.CanUndo())
			self.note:SetText("")
			return
		end
		self.title:SetText("Keys 1 to = on " .. plan.bar)
		self.from:SetText(plan.from and plan.from ~= build and ("The bar of " .. ns.BuildTitle(plan.from)) or "")
		for i, s in ipairs(plan.slots) do
			local c = self.cols[i]
			c.slot = s
			c:Show()
			c.key:SetText(s.key)
			setIcon(c.now, s.now and GetActionTexture(s.slot) or nil)
			local texture, grey, caption = nil, false, ""
			if s.spell then
				local e = ladder(cls).byId[s.spell]
				texture = spellTexture(s.spell) or (e and ns.Icon(e.icon))
			elseif s.name and not s.kept then
				local list = ladder(cls).byKey[s.name]
				texture = ns.Icon(list and list[1] and list[1].icon)
				grey = true
				caption = B.WhenText(s.level, s.how)
			elseif s.after then
				texture = GetActionTexture(s.slot)
			end
			setIcon(c.after, texture, grey)
			c.ring:SetShown(s.change and true or false)
			c.caption:SetText(caption)
		end
		local waits = B.Waiting("bars")
		self.apply:SetEnabled(plan.changes > 0 and not waits)
		self.undo:SetEnabled(B.CanUndo() and not waits)
		local text, color = nil, "mist"
		if B.note and B.note.text then
			text, color = B.note.text, B.note.color or "mist"
		elseif plan.changes == 0 then
			text = plan.later > 0 and ("Your bar matches the build so far. " .. plan.later .. (plan.later == 1 and " spell comes" or " spells come") .. " later.") or "Your bar already matches the build."
		else
			text = "Sets " .. plan.changes .. (plan.changes == 1 and " key" or " keys") .. (plan.later > 0 and ("; " .. plan.later .. (plan.later == 1 and " spell comes" or " spells come") .. " later.") or ".")
		end
		if not (B.note and B.note.text) then
			if plan.kept > 0 then
				text = text .. " " .. plan.kept .. (plan.kept == 1 and " key keeps" or " keys keep") .. " what Undo could not put back."
			end
			if plan.first >= 72 then
				-- a stance's or form's bar: Battle Stance, Cat Form, Stealth
				text = text .. " Only the bar of the stance or form you are in changes."
			end
		end
		self.note:SetText(text)
		self.note:SetTextColor(unpack(ns.RGB[color] or ns.RGB.mist))
	end

	p:SetScript("OnShow", function(self)
		B.note = nil
		self:Update()
	end)
	B.panel = p
	return p
end

-- Redraw what shows when the bars, stances, spells or the build change under it.
local redrawing = false
local function redraw()
	if redrawing then
		return
	end
	redrawing = true
	local function go()
		redrawing = false
		if B.panel and B.panel:IsVisible() then
			B.panel:Update()
		end
		if trainer.hooked then
			B.UpdateTrainer()
		end
	end
	if C_Timer and C_Timer.After then
		C_Timer.After(0.1, go)
	else
		go()
	end
end
for _, event in ipairs({ "ACTIONBAR_SLOT_CHANGED", "UPDATE_BONUS_ACTIONBAR", "ACTIONBAR_PAGE_CHANGED", "UPDATE_SHAPESHIFT_FORM", "SPELLS_CHANGED" }) do
	ns.On(event, redraw)
end
ns.Listen("BARS", redraw)
ns.Listen("BUILD", function()
	B.note = nil
	redraw()
end)
-- A reset at the trainer: the build you follow goes on in the build it respecs into.
ns.Listen("TALENTS", function()
	B.FollowPath()
end)
