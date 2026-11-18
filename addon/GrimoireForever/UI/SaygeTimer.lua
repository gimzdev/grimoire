-- The timer for Sayge's fortune (Sayge.lua): a small pill with the time still to play before Sayge gives the next one,
-- shown while a count runs and once it is done. Drag it anywhere; right-click hides it until your next fortune.
local _, ns = ...
local UI = ns.UI
local S = ns.Sayge

local timer

local function hidden()
	local st = ns.char and ns.char.sayge
	return not st or st.hidden or (ns.db and ns.db.saygeTimer == false) or S.Left() == nil
end

local function tooltip(self)
	local st = ns.char and ns.char.sayge
	if not st then
		return
	end
	local left = S.Left() or 0
	local lines = {}
	if left > 0 then
		lines[#lines + 1] = { "Next fortune in " .. S.Span(left) .. " of play on this character.", 1, 1, 1 }
	else
		lines[#lines + 1] = { "Sayge will read your fortune again.", ns.RGB.green[1], ns.RGB.green[2], ns.RGB.green[3] }
	end
	lines[#lines + 1] = { "Sayge gives one fortune per four hours played on the same character. Time offline or on another character does not count.", 0.64, 0.62, 0.58 }
	local buff = S.BuffLeft()
	if st.name then
		lines[#lines + 1] = " "
		lines[#lines + 1] = { (st.name or "Your fortune") .. (buff and (": " .. S.Span(buff) .. " left") or ", worn off"), 1, 0.82, 0 }
	end
	if st.guess then
		lines[#lines + 1] = { "Estimated: Grimoire saw this fortune after it began, and counted from the buff's own timer.", 0.64, 0.62, 0.58 }
	end
	local others = S.Others()
	if #others > 0 then
		lines[#lines + 1] = " "
		lines[#lines + 1] = { "Your other characters", 1, 1, 1 }
		for _, o in ipairs(others) do
			local who = o.class and ns.ClassText(o.class:lower(), o.name) or o.name
			lines[#lines + 1] = { who .. "   " .. (o.left <= 0 and ns.Hex(ns.HEX.green, "ready") or (S.Span(o.left) .. " to play")), 1, 1, 1 }
		end
	end
	lines[#lines + 1] = " "
	lines[#lines + 1] = { "Drag to move. Right-click to hide it until your next fortune; /grim sayge shows it again.", 0.47, 0.45, 0.42 }
	UI.TextTooltip(self, "Sayge's fortune", lines, "ANCHOR_BOTTOM")
end

local function draw()
	if not timer then
		return
	end
	local st = ns.char and ns.char.sayge
	local left = S.Left()
	if not (st and left) then
		return
	end
	timer.icon:SetIcon(st.icon or S.ICON)
	if left > 0 then
		timer.label:SetText("Sayge")
		timer.clock:SetText(S.Clock(left))
		timer.clock:SetTextColor(unpack(ns.RGB.white))
		timer.surface:SetBorder(1, 1, 1, 0.1)
	else
		timer.label:SetText("Sayge")
		timer.clock:SetText("ready")
		timer.clock:SetTextColor(unpack(ns.RGB.green))
		timer.surface:SetBorder(ns.RGB.green[1], ns.RGB.green[2], ns.RGB.green[3], 0.5)
	end
	timer:SetWidth(math.ceil(UI.TextWidth(timer.label) + UI.TextWidth(timer.clock)) + 58)
end

local function remember(f)
	local x, y = f:GetCenter()
	if not (x and y) then
		return
	end
	local s = f:GetEffectiveScale() / UIParent:GetEffectiveScale()
	ns.db.saygePos = { math.floor(x * s + 0.5), math.floor(y * s + 0.5) }
	f:ClearAllPoints()
	f:SetPoint("CENTER", UIParent, "BOTTOMLEFT", ns.db.saygePos[1], ns.db.saygePos[2])
end

local function build()
	local f = CreateFrame("Frame", "GrimoireForeverSayge", UIParent)
	f:SetSize(150, 28)
	f:SetFrameStrata("MEDIUM")
	f:SetClampedToScreen(true)
	f:SetMovable(true)
	f:EnableMouse(true)
	f:RegisterForDrag("LeftButton")
	if f.SetDontSavePosition then
		f:SetDontSavePosition(true)
	end
	local pos = ns.db.saygePos
	if pos and pos[1] then
		f:SetPoint("CENTER", UIParent, "BOTTOMLEFT", pos[1], pos[2])
	else
		-- Until you move it: the top of the screen, a little left of the middle, clear of the game's own frames there.
		f:SetPoint("TOP", UIParent, "TOP", -120, -14)
	end
	f.surface = UI.Surface(f, 14, { 0.08, 0.085, 0.1, 0.92 }, { 1, 1, 1, 0.1 })
	f.icon = UI.Icon(f, 20)
	f.icon:SetPoint("LEFT", 5, 0)
	f.label = UI.Text(f, 11, ns.RGB.mist, { weight = "medium" })
	f.label:SetPoint("LEFT", f.icon, "RIGHT", 7, 0)
	f.clock = UI.Text(f, 12, ns.RGB.white, { weight = "bold" })
	f.clock:SetPoint("LEFT", f.label, "RIGHT", 6, 0)
	f:SetScript("OnDragStart", function(self)
		self:StartMoving()
	end)
	f:SetScript("OnDragStop", function(self)
		self:StopMovingOrSizing()
		remember(self)
	end)
	f:SetScript("OnMouseUp", function(self, button)
		if button == "RightButton" and ns.char and ns.char.sayge then
			ns.char.sayge.hidden = true
			self:Hide()
			GameTooltip:Hide()
			ns.Print("Sayge's timer hidden until your next fortune. " .. ns.Hex(ns.HEX.gold, "/grim sayge") .. " shows it again.")
		end
	end)
	f:SetScript("OnEnter", tooltip)
	f:SetScript("OnLeave", function()
		GameTooltip:Hide()
	end)
	local since = 0
	f:SetScript("OnUpdate", function(self, elapsed)
		since = since + elapsed
		if since < 1 then
			return
		end
		since = 0
		draw()
		if self:IsMouseOver() and GameTooltip:IsOwned(self) then
			tooltip(self)
		end
	end)
	return f
end

--- Shows or hides the timer as the count and the settings say.
function ns.UpdateSaygeTimer()
	if not ns.db then
		return
	end
	if hidden() then
		if timer then
			timer:Hide()
		end
		return
	end
	timer = timer or build()
	draw()
	timer:Show()
end

--- /grim sayge: the count in chat, and the timer back if it was hidden.
function ns.ShowSayge()
	if ns.char and ns.char.sayge then
		ns.char.sayge.hidden = nil
	end
	if ns.db and ns.db.saygeTimer == false then
		ns.db.saygeTimer = true
		if ns.RefreshOptions then
			ns.RefreshOptions()
		end
	end
	S.Report()
	ns.UpdateSaygeTimer()
end

ns.Listen("SAYGE", ns.UpdateSaygeTimer)
ns.Listen("LOGIN", ns.UpdateSaygeTimer)
