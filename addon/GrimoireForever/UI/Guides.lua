-- Guides: every Grimoire guide, readable in game.
local _, ns = ...
local UI = ns.UI

local LEFT = 236
local view = { slug = nil }

local function findGuide(slug)
	for _, g in ipairs(ns.guides) do
		if g.slug == slug then
			return g
		end
	end
end

--- The guide list with a header row before each category.
local function entries()
	local out, last = {}, nil
	for _, g in ipairs(ns.guides) do
		if g.category ~= last then
			out[#out + 1] = { header = g.category }
			last = g.category
		end
		out[#out + 1] = { guide = g }
	end
	return out
end

--- The class guide for the player's class first, when nothing is open yet.
local function defaultSlug()
	local cls = ns.player.class
	if cls and findGuide(cls) then
		return cls
	end
	return ns.guides[1] and ns.guides[1].slug
end

function ns.OpenGuide(slug)
	view.slug = slug
	ns.Open("guides")
end

local TITLE_INSET = 40 -- the card, the scroll bar and the row's text insets

local function build(frame)
	local measure = UI.Text(frame, 12.5, ns.RGB.text, { weight = "medium" })
	measure:Hide()
	local card
	card, frame.list = UI.CardList(frame, 34, function(list)
		local row = UI.Row(list)
		row.text = UI.Text(row, 12.5, ns.RGB.text, { weight = "medium", wrap = true, spacing = 2 })
		row.text:SetPoint("LEFT", 14, 0.5)
		row.text:SetPoint("RIGHT", -10, 0.5)
		row.text:SetJustifyV("MIDDLE")
		row.text:SetMaxLines(2)
		row:SetScript("OnClick", function(self)
			if self.item and self.item.guide then
				view.slug = self.item.guide.slug
				frame:Update()
			end
		end)
		return row
	end, function(row, item)
		row.item = item
		local header = UI.HeaderRow(row)
		if item.header then
			header:SetText(item.header)
			header:Show()
			row.rule:Show()
			row.text:Hide()
			row:SetSelected(false)
			row:EnableMouse(false)
		else
			header:Hide()
			row.rule:Hide()
			row.text:Show()
			row:EnableMouse(true)
			local on = item.guide.slug == view.slug
			row.text:SetText(item.guide.title)
			row.text:SetTextColor(unpack(on and ns.RGB.white or ns.RGB.text))
			row:SetSelected(on)
		end
	end, function(item, list)
		if item.header then
			return 38
		end
		-- Long titles take two lines.
		measure:SetText(item.guide.title)
		local room = (list:GetWidth() or LEFT) - TITLE_INSET
		return UI.TextWidth(measure) > room and 50 or 34
	end)
	card:SetPoint("TOPLEFT")
	card:SetPoint("BOTTOMLEFT")
	card:SetWidth(LEFT)
	frame.doc = UI.Document(frame)
	frame.doc:SetPoint("TOPLEFT", LEFT + 26, 0)
	frame.doc:SetPoint("BOTTOMRIGHT")

	function frame:Update()
		view.slug = view.slug and findGuide(view.slug) and view.slug or defaultSlug()
		local list = entries()
		self.list:SetData(list, true)
		local g = findGuide(view.slug)
		if not g then
			return
		end
		if self.shown ~= g.slug then
			self.shown = g.slug
			for i, e in ipairs(list) do
				if e.guide == g then
					self.list:Reveal(i)
				end
			end
			local blocks = { { "title", g.title } }
			if g.desc ~= "" then
				blocks[#blocks + 1] = { "note", g.desc }
			end
			for _, b in ipairs(g.blocks) do
				blocks[#blocks + 1] = b
			end
			self.doc:SetBlocks(blocks)
		end
	end
end

ns.AddTab({
	key = "guides",
	label = "Guides",
	icon = "INV_Misc_Book_07",
	order = 8,
	lede = "Every Grimoire guide, to read in game.",
	build = build,
	show = function(frame)
		frame:Update()
	end,
})
