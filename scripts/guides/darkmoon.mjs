#!/usr/bin/env node
// The table of content/guides/darkmoon-faire.md: Sayge's fortunes and the answers that give each, from VMaNGOS.
// Sayge's gossip (creature_template.gossip_menu_id) is walked option by option, in the order the game lists them,
// down to the gossip script that casts a fortune (command 15, cast spell); each fortune's effect is its 1.12 aura
// text (spell_template), worded by scripts/data/lib/spelltext.mjs.
//
//   node scripts/guides/darkmoon.mjs --vmangos mangos.sqlite [--data data]
import { spellText } from '../data/lib/spelltext.mjs';
import { isMain, itemLink, latest, main, table } from './lib.mjs';

export const guide = 'content/guides/darkmoon-faire.md';

const SAYGE = 14822;
const BUILD = 5875;
const CAST_SPELL = 15; // gossip_scripts command
const CREATE_ITEM = 24;
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];

export function blocks({ db }) {
  const options = db.prepare('SELECT * FROM gossip_menu_option WHERE menu_id = ? ORDER BY id');
  const casts = db.prepare('SELECT datalong FROM gossip_scripts WHERE id = ? AND command = ?');
  const spell = db.prepare('SELECT * FROM spell_template WHERE entry = ? AND build <= ? ORDER BY build DESC LIMIT 1');
  const fortunes = new Map(); // spell -> { name, effect, paths: [[answer, answer]] }
  let written = 0;
  // Every way down Sayge's menus to a spell, as the positions of the answers chosen on the way.
  const walk = (menu, path, seen) => {
    for (const o of options.all(menu)) {
      const here = [...path, o.id];
      for (const { datalong: id } of casts.all(o.action_script_id, CAST_SPELL)) {
        const sp = spell.get(id, BUILD);
        if (!sp) continue;
        if (sp.effect1 === CREATE_ITEM) written = sp.effectItemType1;
        else {
          if (!fortunes.has(id)) fortunes.set(id, { name: sp.name, effect: spellText(sp.auraDescription, sp, new Map()), paths: [] });
          fortunes.get(id).paths.push(here.slice(1)); // the first option only opens the questions
        }
      }
      if (o.action_menu_id && !seen.has(o.action_menu_id)) walk(o.action_menu_id, here, new Set([...seen, o.action_menu_id]));
    }
  };
  const menu = latest(db, 'creature_template').get(SAYGE).gossip_menu_id;
  walk(menu, [], new Set([menu]));
  const rows = [...fortunes.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => [
      `**${f.name.replace(/^Sayge's Dark Fortune of /, '')}**`,
      f.effect,
      f.paths
        .filter((p) => p.length === 2)
        .map(([a, b]) => `${ORDINAL[a]}, then ${ORDINAL[b]}`)
        .join('; or '),
    ]);
  const note = written ? `\n\nAfter the fortune, his last option gives you ${itemLink(written)}, a written fortune, if your bags have room.` : '';
  return { 'sayge-fortunes': table(['Fortune', 'What it does', 'Answer his first question, then his second'], rows) + note };
}

if (isMain(import.meta.url)) main({ guide, blocks });
