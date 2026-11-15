---
title: Sayge and the Darkmoon Faire: the fortunes and Grimoire's timer
description: Sayge's eight fortunes at the Darkmoon Faire in World of Warcraft: Forever, the answers that give each one, and exactly how Grimoire's add-on counts the play time to your next fortune.
category: Systems
art: untoldStories
icon: inv_misc_orb_02
updated: 2026-11-14
order: 18
---

Give [[npc:14822]] the first answer to both of his questions for Sayge's Dark Fortune of Damage, 10% more damage in Classic's data. His other answers give 10% to one stat or to armor, or 25 to all resistances: the table has every pair. Grimoire's [add-on](/tools/addon) then counts four hours of play on that character and tells you when Sayge will read your fortune again.

## The fortunes

Sayge asks two questions; his answers count in the order he lists them. Effects are Classic’s (patch 1.12, from VMaNGOS): Forever may have changed them, so the buff's tooltip in game has the last word.

<!-- generated: sayge-fortunes -->
| Fortune | What it does | Answer his first question, then his second |
| --- | --- | --- |
| **Agility** | Increases agility by 10%. | third, then third |
| **Armor** | Increases armor by 10%. | first, then third; or fourth, then third |
| **Damage** | Increases damage by 10%. | first, then first |
| **Intelligence** | Increases intelligence by 10%. | second, then second; or fourth, then first |
| **Resistance** | Increases all magical resistances by 25. | first, then second; or second, then third |
| **Spirit** | Increases spirit by 10%. | second, then first; or fourth, then second |
| **Stamina** | Increases stamina by 10%. | third, then first |
| **Strength** | Increases strength by 10%. | third, then second |

After the fortune, his last option gives you [[item:19422]], a written fortune, if your bags have room.
<!-- /generated -->

In Classic's data, each fortune also puts a hidden aura on you, Sayge's Carnie Buff, and Sayge offers no fortune while you have a fortune or that aura. Its length is in a client table VMaNGOS does not ship.

## Grimoire's Sayge timer

What the add-on's code does:

- **What it watches.** Each time your buffs change, it looks for one of the eight fortunes on you, by spell or by name.
- **When it counts.** A fortune it has not counted yet starts the count. It asks the game for the character's played time without the answer showing in chat (a /played you type still shows), and notes the fortune against it, less however long the buff has already run. The count is four hours of played time, so time offline or on another character does not count, and a logout, a reload or a crash does not lose it.
- **A fortune seen late.** If the buff began 2 minutes or more before Grimoire saw it (the add-on was off, or loaded later), the count starts from the buff's own clock and is marked as estimated.
- **A second fortune early.** The same fortune seen again changes nothing. A fortune that began less than 2 minutes ago, when the one on record is more than 3 minutes of play old, starts a new count: Sayge gave another, whatever the count said. Once the four hours are up, the next fortune starts a new count.

What you see:

- **In chat**, when the count starts: the fortune's name and "The next one in 4h 00m of play on this character: Grimoire counts it." When the count runs out: "Sayge will read your fortune again: four hours played since the last one.", with the alarm clock's ring, once per fortune.
- **A small timer** at the top of the screen, a little left of the middle: the fortune's icon, "Sayge" and the play time left, which turns to "ready" in green. Drag it anywhere; right-click hides it until your next fortune.
- **Its tooltip:** the play time left, the rule it counts ("Sayge gives one fortune per four hours played on the same character"), the buff's own time left or "worn off", and your other characters' counts.
- **The minimap button's tooltip:** "Sayge's fortune: ready" or the play time left.
- **/grim sayge** (or /grim fortune, /grim dmf) prints this character's count and the others', and shows the timer again, turning its switch back on. That switch is "Sayge's fortune timer" in Options: turned off, the count goes on without the timer, the chat lines or the ring.
- **Your other characters.** Each character's count is saved every minute and at logout, and the others list it, soonest first, so you see which one can get a fortune now.

The add-on's test runs this code against a fake game: a fortune, an hour of play, ten hours offline that change nothing, the ring when the count runs out, the list of other characters and a fortune seen an hour late.

## Sources

The fortunes, Sayge's answers and the hidden aura come from the VMaNGOS world database (patch 1.12): his gossip menus, the scripts behind each answer, the spells and the conditions on his first option. The timer is Grimoire's add-on: Sayge.lua and UI/SaygeTimer.lua, with its test scripts/addon/test-sayge.mjs.
