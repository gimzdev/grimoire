#!/usr/bin/env node
// The tables of content/guides/hunter-pets.md:
//   pet-families: each pet family's own ability, its top rank's tooltip, from the hunter abilities in data/abilities.json
//                 (the game's tooltips: their "Pet:" line names the families that learn it);
//   pet-taming:   every beast that can be tamed and has a page on Grimoire, by level band and zone. Tameable and family
//                 come from VMaNGOS (creature_template: static_flags1 & 0x10 is CREATURE_STATIC_FLAG_TAMEABLE,
//                 pet_family the 1.12 family); name, levels, rank and zone from data/npcs.json. Open-world zones only.
//
//   node scripts/guides/hunter-pets.mjs --vmangos mangos.sqlite [--data data]
import { isMain, latest, levels, main, npcLink, table, zoneLink } from './lib.mjs';

export const guide = 'content/guides/hunter-pets.md';

// VMaNGOS's pet_family numbers, named as Forever's tooltips name the families (Classic's Owl is the Bird of Prey).
const FAMILY = { 1: 'Wolf', 2: 'Cat', 3: 'Spider', 4: 'Bear', 5: 'Boar', 6: 'Crocolisk', 7: 'Carrion Bird', 8: 'Crab', 9: 'Gorilla', 11: 'Raptor', 12: 'Tallstrider', 20: 'Scorpid', 21: 'Turtle', 24: 'Bat', 25: 'Hyena', 26: 'Bird of Prey', 27: 'Wind Serpent' };
// Dismember's tooltip spells the family "Crocilisk".
const SPELLING = { Crocilisk: 'Crocolisk' };
const RANK = { 1: 'elite', 2: 'rare elite', 4: 'rare' };
const BANDS = [1, 11, 21, 31, 41, 51].map((lo) => [lo, lo + 9]);

/** The families each pet ability names, from the first line of its tooltip ("Pet: Bat" or "Pet: every family but ..."). */
function petAbilities(abilities) {
  const top = new Map();
  for (const a of abilities.hunter) top.set(a.name, a); // ranks are in order: the last is the top rank
  const out = [];
  for (const a of top.values()) {
    const m = /Pet: ([^\n]+)\n([\s\S]*)$/.exec(a.desc);
    if (!m) continue;
    const head = a.desc.split('\n')[0];
    const but = /^every family but (.+)$/.exec(m[1]);
    const names = (but ? but[1] : m[1]).split(/, | and /).map((n) => SPELLING[n] ?? n);
    out.push({ name: a.name, every: Boolean(but), names, text: m[2].trim().replace(/\n+/g, ' '), cost: /^(\d+) Focus/.exec(head)?.[1], cooldown: /([\d.]+ (?:sec|min)) cooldown/.exec(head)?.[1] });
  }
  return out;
}

export function blocks({ db, data }) {
  const abilities = petAbilities(data('abilities.json'));
  const named = new Set(abilities.flatMap((a) => (a.every ? [] : a.names)));
  for (const f of Object.values(FAMILY)) if (!named.has(f)) throw new Error(`no tooltip names the ${f} family`);
  const learns = (family, a) => (a.every ? !a.names.includes(family) : a.names.includes(family));

  const families = [...named].sort().map((family) => {
    const own = abilities.filter((a) => !a.every && a.names.length === 1 && a.names[0] === family);
    const shared = abilities.filter((a) => (a.every || a.names.length > 1) && learns(family, a)).map((a) => `[[ability:hunter:${a.name}]]`);
    const what = own.map((a) => `[[ability:hunter:${a.name}]]: ${a.text}${a.cooldown ? ` ${a.cooldown} cooldown.` : ''}`).join(' ') || 'No ability of its own.';
    return [`**${family}**`, what, shared.join(', ')];
  });

  const npcs = data('npcs.json');
  const zones = new Map(data('zones.json').map((z) => [z.id, z]));
  const beasts = [];
  for (const t of latest(db, 'creature_template').values()) {
    const family = FAMILY[t.pet_family];
    const n = npcs[t.entry];
    if (!(t.static_flags1 & 0x10) || !family || !n || !n[6] || zones.get(n[6])?.inst) continue;
    beasts.push({ id: t.entry, name: n[0], lo: n[2], hi: n[3], rank: RANK[n[4]], zone: n[6], zoneName: zones.get(n[6])?.n ?? data('zone-names.json')[n[6]] ?? '', family });
  }
  // One row per zone and family in each band, its beasts by level.
  const taming = BANDS.map(([lo, hi]) => {
    const groups = new Map();
    for (const b of beasts.filter((x) => x.lo >= lo && x.lo <= hi)) {
      const k = `${b.zoneName}\t${b.family}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(b);
    }
    const rows = [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, list]) => {
        list.sort((a, b) => a.lo - b.lo || a.name.localeCompare(b.name));
        return [zoneLink(data, list[0].zone), list[0].family, list.map((b) => `${npcLink(b.id)} (${b.rank ? `${b.rank}, ` : ''}${levels(b.lo, b.hi)})`).join(', ')];
      });
    return `### Levels ${lo} to ${hi}\n\n${table(['Zone', 'Family', 'Beasts (level)'], rows)}`;
  });
  return {
    'pet-families': table(['Family', 'Its own ability (top rank)', 'Also learns'], families),
    'pet-taming': taming.join('\n\n'),
  };
}

if (isMain(import.meta.url)) main({ guide, blocks });
