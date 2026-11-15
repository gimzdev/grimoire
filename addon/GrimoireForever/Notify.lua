-- Level-up notes in the chat window: where the new talent point goes, and what the trainer has for you.
local _, ns = ...

local function spellList(list, max)
	local names, seen = {}, {}
	for _, a in ipairs(list) do
		local label = ns.SpellLabel(a)
		if not seen[label] then
			seen[label] = true
			names[#names + 1] = ns.Hex(ns.HEX.blue, label)
		end
	end
	if max and #names > max then
		local more = #names - max
		for i = #names, max + 1, -1 do
			names[i] = nil
		end
		names[#names + 1] = "and " .. more .. " more"
	end
	return table.concat(names, ", ")
end

local function stepText(step)
	local t = step.info and step.info.talent
	if not t then
		return nil
	end
	return ns.Hex(ns.HEX.gold, t.name) .. " (" .. step.info.treeName .. ", rank " .. step.rank .. " of " .. t.max .. ")"
end

--- Prints the next talent point and the spells to train. Quiet parts are left out.
function ns.ReportNext()
	ns.UpdatePlayer()
	local level = ns.player.level
	-- the build you follow, moved along its respec once your talents fit the next build, and the respec still open
	local build, into = ns.Bars.FollowPath()
	if build then
		local _, _, nextStep, verified, ready = ns.BuildProgress(build, ns.player.class)
		-- every point of a build with an open respec spent: the respec is the answer
		local spent = into and ns.Bars.Complete(build, ns.player.class)
		if spent then
			ns.Print("next (" .. ns.BuildTitle(build) .. "): " .. ns.Bars.RespecText(build, into, "respec"))
		elseif nextStep and ready then
			ns.Print("next talent point (" .. ns.BuildTitle(build) .. "): " .. (stepText(nextStep) or "?") .. "." .. (ns.Bars and ns.Bars.LearnLink(nextStep) or ""))
		elseif nextStep then
			ns.Print("next talent point (" .. ns.BuildTitle(build) .. "), at level " .. ns.PointLevel(nextStep.n) .. ": " .. (stepText(nextStep) or "?") .. ".")
		elseif ns.PlanEnded(build, ns.player.class) then
			ns.Print(ns.BuildTitle(build) .. " plans no more points. Plan the rest in " .. ns.Hex(ns.HEX.gold, "/grim talents") .. ".")
		elseif verified then
			ns.Print("your talents match " .. ns.BuildTitle(build) .. ".")
		end
		if into and not spent then
			ns.Print(ns.Bars.RespecText(build, into, nextStep and "or respec" or "respec"))
		end
	elseif ns.PointsAvailable() > 0 or level >= 5 then
		ns.Print("pick a talent build in " .. ns.Hex(ns.HEX.gold, "/grim talents") .. " and Grimoire tells you where every point goes.")
	end
	local train = ns.ToTrain(level)
	if #train > 0 then
		ns.Print(#train .. " spell" .. (#train == 1 and "" or "s") .. " to train: " .. spellList(train, 8) .. ".")
	else
		local at, list = ns.NextSpells(level)
		if at then
			ns.Print("nothing to train now. At " .. at .. ": " .. spellList(list, 6) .. ".")
		end
	end
end

local function announce(level)
	if not ns.db then
		return
	end
	if ns.db.levelUp then
		ns.ForgetTalents()
		local build, into = ns.Bars.FollowPath()
		if build then
			-- The point to spend now: the build's first one you have not spent, when you have a point for it.
			local _, _, nextStep, _, ready = ns.BuildProgress(build, ns.player.class)
			local spent = into and ns.Bars.Complete(build, ns.player.class)
			local text = not spent and ready and nextStep and stepText(nextStep)
			if text then
				-- [Learn it] spends that point, when it is legal now (Bars.lua).
				ns.Print("level " .. level .. " talent point: " .. text .. "." .. (ns.Bars and ns.Bars.LearnLink(nextStep) or ""))
			elseif ns.PlanEnded(build, ns.player.class) then
				ns.Print("level " .. level .. " talent point: " .. ns.BuildTitle(build) .. " plans no more points. Plan the rest in " .. ns.Hex(ns.HEX.gold, "/grim talents") .. ".")
			end
			-- The respec, once, at its level beside the point; at any level when the build has no point left.
			if into and (spent or level == build.next.at) then
				ns.Print(text and ns.Bars.RespecText(build, into, "or respec") or ("level " .. level .. ": " .. ns.Bars.RespecText(build, into, "respec")))
			end
		elseif ns.PointsAvailable() > 0 and not ns.char.hinted then
			ns.char.hinted = true
			ns.Print("pick a talent build in " .. ns.Hex(ns.HEX.gold, "/grim talents") .. " and Grimoire tells you where each point goes.")
		end
	end
	if ns.db.trainer then
		local list = ns.abilities and ns.abilities[ns.player.class or ""] or {}
		local talentsOf = ns.TalentNames(ns.player.class or "")
		local known = ns.KnownRanks()
		local fresh = {}
		for _, a in ipairs(list) do
			if a.level == level and ns.FromTrainer(a, known, talentsOf) and ns.Learnable(a) and not ns.Knows(a.id) then
				fresh[#fresh + 1] = a
			end
		end
		if #fresh > 0 then
			ns.Print("new at your class trainer: " .. spellList(fresh) .. ".")
		end
	end
end

ns.On("PLAYER_LEVEL_UP", function(level)
	if type(level) ~= "number" or (issecretvalue and issecretvalue(level)) then
		return
	end
	-- The level-up itself settles first; the note follows a moment later so it is not lost in the level-up messages.
	C_Timer.After(1.5, function()
		announce(level)
		ns.Send("LEVEL", level)
	end)
end)
