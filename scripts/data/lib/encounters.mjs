// The bosses of every Classic dungeon and raid Grimoire lists, in the order of a normal run, with their abilities and
// loot, and the notable items each dungeon's regular mobs drop. Everything comes from the VMaNGOS world database
// (GPL-2.0-or-later) and, for bosses whose fight is written in C++, from the spells their VMaNGOS script casts
// (static/boss-scripts.json, made by scripts/data/boss-scripts.mjs). The order of the bosses and the wings are
// Grimoire's own (static/encounters.json); every name and id there is checked against VMaNGOS here.
//
// Spell durations and radii live in client tables VMaNGOS does not ship. The ones used here are read off
// talentsforever.com's export of the Forever client (CC BY 4.0): for every trainer spell it marks as unchanged since
// Classic, the client's own tooltip says how long the duration its VMaNGOS record points at lasts. A duration the
// export does not show is left out of the text rather than guessed.

import { inPatch, round, JUNK } from './world.mjs';

const CLIENT_BUILD = 5875;
const SCHOOL = ['Physical', 'Holy', 'Fire', 'Nature', 'Frost', 'Shadow', 'Arcane'];

/* ── Durations and radii from the Forever client's own tooltips ─────────────────────────────────────────────────── */

function clientTables(tf, spells) {
  const votes = { d: new Map(), a: new Map() };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const v of Object.values(tf.spell_desc ?? {})) {
    if (!v?.id || !v.d || v.cs !== 'same') continue;
    const sp = spells.get(v.id);
    const t = sp?.description?.replace(/\r/g, '');
    if (!t || !/\$(?:\d+)?[dDaA]/.test(t)) continue;
    const parts = [];
    const caps = [];
    let last = 0;
    const re = /\$(?:\/\d+;)?(\d+)?([a-zA-Z])(\d?)(?:([^:;$]*):([^;$]*);)?/g;
    let m;
    while ((m = re.exec(t))) {
      parts.push(esc(t.slice(last, m.index)));
      const kind = m[2];
      if ((kind === 'd' || kind === 'D') && !m[1]) {
        parts.push('([0-9.]+ (?:sec|min|hour|hours|day|days))');
        caps.push(['d', sp.durationIndex]);
      } else if ((kind === 'a' || kind === 'A') && !m[1]) {
        parts.push('([0-9.]+)');
        caps.push(['a', sp[`effectRadiusIndex${m[3] || 1}`]]);
      } else parts.push('.+?');
      last = re.lastIndex;
    }
    parts.push(esc(t.slice(last)));
    let rx;
    try {
      rx = new RegExp(`^${parts.join('').replace(/\s+/g, '\\s+')}$`);
    } catch {
      continue;
    }
    const hit = rx.exec(v.d.trim());
    if (!hit) continue;
    caps.forEach(([kind, index], i) => {
      if (!index) return;
      const m2 = votes[kind];
      if (!m2.has(index)) m2.set(index, new Map());
      m2.get(index).set(hit[i + 1], (m2.get(index).get(hit[i + 1]) ?? 0) + 1);
    });
  }
  // An index counts when every unchanged spell that uses it says the same.
  const pick = (m) => new Map([...m].filter(([, values]) => values.size === 1).map(([index, values]) => [index, [...values.keys()][0]]));
  return { duration: pick(votes.d), radius: pick(votes.a) };
}

const seconds = (text) => {
  const m = /^([0-9.]+) (sec|min|hour|hours|day|days)$/.exec(text ?? '');
  if (!m) return undefined;
  return Number(m[1]) * { sec: 1, min: 60, hour: 3600, hours: 3600, day: 86400, days: 86400 }[m[2]];
};

/* ── Spell text ─────────────────────────────────────────────────────────────────────────────────────────────── */

const fmt = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10));

/**
 * What an effect of a spell is worth when a creature of `level` casts it, the way the 1.12 server works it out
 * (SpellCaster::CalculateSpellEffectValue in VMaNGOS): base points and dice, grown by level within the spell's level
 * range, and for spells flagged to scale with creature level, by the creature's melee damage at its level over that
 * at the spell's level. Returns [min, max] as positive numbers.
 */
function makeEffectValue(meleeDamage) {
  return (sp, n, casterLevel) => {
    let level = casterLevel;
    if (sp.maxLevel > 0 && level > sp.maxLevel) level = sp.maxLevel;
    else if (level < sp.baseLevel) level = sp.baseLevel;
    level -= sp.spellLevel;
    const baseDice = sp[`effectBaseDice${n}`] ?? 0;
    let base = (sp[`effectBasePoints${n}`] ?? 0) + level * (sp[`effectRealPointsPerLevel${n}`] ?? 0);
    const rp = Math.trunc((sp[`effectDieSides${n}`] ?? 0) + level * (sp[`effectDicePerLevel${n}`] ?? 0));
    let lo;
    let hi;
    if (rp === 0 || rp === 1) lo = hi = base + baseDice;
    else {
      lo = base + Math.min(baseDice, rp);
      hi = base + Math.max(baseDice, rp);
    }
    const effect = sp[`effect${n}`];
    const aura = sp[`effectApplyAuraName${n}`];
    if (sp.attributes & 0x00080000 && sp.spellLevel && effect !== 31 && effect !== 98 && !(effect === 6 && aura === 33)) {
      const at = meleeDamage(casterLevel);
      const of = meleeDamage(sp.spellLevel);
      if (at && of) {
        lo *= at / of;
        hi *= at / of;
      }
    }
    lo = Math.abs(Math.trunc(lo));
    hi = Math.abs(Math.trunc(hi));
    return [Math.min(lo, hi), Math.max(lo, hi)];
  };
}

const range = ([lo, hi]) => (lo === hi ? fmt(lo) : `${fmt(lo)} to ${fmt(hi)}`);

/**
 * Whether an effect's value is the real one. Scripts cast some spells with their own amount (Baron Geddon's Inferno
 * grows each tick); the record then holds 0 or 1, which says nothing, so no number is printed for it.
 */
const known = (sp, n, v) => {
  if (v[1] <= 0) return false;
  const effect = sp[`effect${n}`];
  const aura = sp[`effectApplyAuraName${n}`];
  const damage = [2, 7, 9].includes(effect) || ((effect === 6 || effect === 27 || effect === 35) && [3, 15, 53].includes(aura));
  return !(damage && v[1] <= 1);
};

/** Auras whose amount is a percentage (attack, cast and movement speed, damage done and taken in percent, chances,
 *  threat, healing and stats in percent), as VMaNGOS applies them. */
const PERCENT_AURAS = new Set([9, 10, 31, 32, 33, 47, 49, 51, 52, 54, 55, 57, 65, 79, 87, 101, 118, 129, 130, 133, 136, 137, 138, 140, 142, 166]);

/** Phrases that only carry a value the client tables would give: dropped when the value is not known. */
const UNKNOWN_PHRASES = [
  /,? (?:for|lasting|over|within|every|after) (?:up to )?\$(?:\d+)?[dDaA]\d?(?: (?:yards?|yds?|sec|seconds))?/g,
  /\s*Lasts \$(?:\d+)?[dD]\d?\.?/g,
  /\s*\(\$(?:\d+)?[dD]\d?\)/g,
];

/**
 * A spell's own description in the words the client prints, for a caster of `level`. Tokens that need a client table
 * use the durations and radii read above; a phrase whose value is unknown goes, and a description that still holds a
 * token after that is not used at all.
 */
function makeDescribe({ spells, value, tables }) {
  const durationOf = (sp) => tables.duration.get(sp?.durationIndex);
  const token = (kind, n, sp, level) => {
    if (!sp) return undefined;
    n = n || 1;
    switch (kind) {
      case 's':
      case 'S': {
        const r = tokenRecord(sp, n);
        const v = value(r, n, level);
        return known(r, n, v) ? range(v) : '';
      }
      case 'm': {
        const r = tokenRecord(sp, n);
        const v = value(r, n, level);
        return known(r, n, v) ? fmt(v[0]) : '';
      }
      case 'M': {
        const r = tokenRecord(sp, n);
        const v = value(r, n, level);
        return known(r, n, v) ? fmt(v[1]) : '';
      }
      case 't':
      case 'T': {
        const a = sp[`effectAmplitude${n}`];
        return a ? fmt(a / 1000) : undefined;
      }
      case 'o':
      case 'O': {
        const d = seconds(durationOf(sp));
        const a = sp[`effectAmplitude${n}`];
        if (!d || !a) return undefined;
        const ticks = Math.floor((d * 1000) / a);
        const v = value(sp, n, level);
        if (!known(sp, n, v)) return '';
        return range([v[0] * ticks, v[1] * ticks]);
      }
      case 'd':
      case 'D':
        return durationOf(sp);
      case 'a':
      case 'A': {
        const r = tables.radius.get(sp[`effectRadiusIndex${n}`]);
        return r;
      }
      case 'h':
      case 'H':
        return sp.procChance && sp.procChance < 101 ? fmt(sp.procChance) : undefined;
      case 'x':
      case 'X':
        return sp[`effectChainTarget${n}`] ? fmt(sp[`effectChainTarget${n}`]) : undefined;
      case 'u':
      case 'U':
        return sp.stackAmount ? fmt(sp.stackAmount) : undefined;
      case 'n':
      case 'N':
        return sp.procCharges ? fmt(sp.procCharges) : undefined;
      default:
        return undefined;
    }
  };
  return (sp, level) => {
    let s = (sp.description || '').replace(/\r/g, '').trim();
    if (!s) return '';
    s = s.replace(/\$[gG]([^:;]*):([^;]*);/g, '$1');
    // "$o1 damage over $d" when the duration is unknown: the same fact per tick, which the record does know.
    s = s.replace(/\$([oO])(\d?)( [^.$]*?) over \$(\d+)?[dD]/g, (all, o, n, words, other) => {
      if (other || durationOf(sp)) return all;
      const a = sp[`effectAmplitude${n || 1}`];
      return a ? `${range(value(sp, Number(n) || 1, level))}${words} every ${fmt(a / 1000)} sec` : all;
    });
    s = s.replace(/\$\/(\d+);(\d*)([smMtbxo])(\d?)/g, (all, div, other, kind, n) => {
      const v = token(kind, Number(n) || 1, other ? spells.get(Number(other)) : sp, level);
      if (v === undefined) return all;
      const parts = v.split(' to ').map((x) => fmt(Number(x) / Number(div)));
      return parts.join(' to ');
    });
    s = s.replace(/\$(\d+)([sSmMtTdDoOaAhHxXuUnN])(\d?)/g, (all, other, kind, n) => token(kind, Number(n) || 1, spells.get(Number(other)), level) ?? all);
    s = s.replace(/\$([sSmMtTdDoOaAhHxXuUnN])(\d?)/g, (all, kind, n, at, whole) => {
      const v = token(kind, Number(n) || 1, sp, level);
      // Creature texts often leave out the "%" of a percentage ("the Physical damage it deals by $s1" for +500% on
      // Patchwerk's Berserk): an amount of an aura that works in percent gets it.
      const i = Number(n) || 1;
      if (v && /[sSmM]/.test(kind) && PERCENT_AURAS.has(tokenRecord(sp, i)[`effectApplyAuraName${i}`]) && !/^\s*(%|percent)/.test(whole.slice(at + all.length))) return `${v}%`;
      return v ?? all;
    });
    s = s.replace(/(\d+) \$[lL]([^:;]*):([^;]*);/g, (all, num, one, many) => `${num} ${Number(num) === 1 ? one : many}`);
    s = s.replace(/\$[lL]([^:;]*):([^;]*);/g, '$2');
    for (const re of UNKNOWN_PHRASES) s = s.replace(re, '');
    // A duration taken out leaves the dot that followed its "sec" ("into a serpent for $d., increasing" becomes
    // "into a serpent., increasing"): a dot that ends no sentence goes, unless it is the "sec." or "yd." of a number.
    s = s.replace(/(?<!\b(?:sec|min|yd|yds|hr|hrs))\.(?=\s*,)/g, '').replace(/(?<!\b(?:sec|min|yd|yds|hr|hrs))\.\s+(?=[a-z])/g, ' ');
    s = s.replace(/ by (?=[ .,]| for\b)/g, ' ').replace(/\(\)/g, '');
    s = s.replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
    if (/\$/.test(s) || !s) return '';
    return s;
  };
}

/* ── What an effect does, for spells without a description ──────────────────────────────────────────────────────── */

// Effects and auras worth a line. Anything else (dummy and script effects, visuals, credits) says nothing to a player.
const EFFECT_WORDS = new Set([1, 2, 5, 6, 7, 8, 9, 10, 17, 19, 27, 28, 29, 30, 31, 35, 38, 41, 42, 56, 58, 62, 63, 64, 67, 68, 70, 73, 74, 85, 87, 88, 89, 90, 91, 96, 98, 100, 108, 112, 114, 121, 124, 125]);
const AURA_WORDS = new Set([2, 3, 5, 6, 7, 8, 9, 12, 13, 14, 15, 18, 22, 23, 24, 25, 26, 27, 28, 29, 31, 33, 39, 42, 43, 47, 49, 51, 52, 53, 54, 56, 57, 60, 64, 65, 67, 69, 72, 74, 79, 81, 84, 85, 87, 89, 97, 99, 101, 117, 118, 129, 133, 137, 138, 162]);
const POWER = ['mana', 'rage', 'focus', 'energy', 'happiness'];

const SCHOOL_MASK = (mask) => {
  if ((mask & 127) === 127) return 'all damage';
  if ((mask & 126) === 126) return 'all spells';
  const names = SCHOOL.filter((_, i) => mask & (1 << i));
  return names.length ? `${names.join(', ').replace(/, ([^,]*)$/, ' and $1')} ${mask === 1 ? 'damage' : 'spells'}` : 'some spells';
};
/** The school a damage-taken aura is about, as a word before "damage": "" for all, "spell " for all magic, "Fire ". */
const schoolWord = (mask) => {
  if (!mask || (mask & 127) === 127) return '';
  if ((mask & 126) === 126 && !(mask & 1)) return 'spell ';
  const names = SCHOOL.filter((_, i) => mask & (1 << i));
  return names.length ? `${names.join(' and ')} ` : '';
};
/** "Defias Blackguard" -> "Defias Blackguards", for "summons 2 ...". */
const plural = (name) => (/man$/.test(name) ? name.replace(/man$/, 'men') : /(s|x|z|ch|sh)$/.test(name) ? `${name}es` : /[^aeiou]y$/.test(name) ? `${name.slice(0, -1)}ies` : `${name}s`);

function makeGenerate({ value, tables, creatureName, spells, scriptTargets }) {
  const areaText = (sp, n) => {
    const a = sp[`effectImplicitTargetA${n}`];
    const b = sp[`effectImplicitTargetB${n}`];
    const r = tables.radius.get(sp[`effectRadiusIndex${n}`]);
    if (a === 24 || b === 24 || a === 54 || b === 54) return ' in a cone in front of the caster';
    if ([15, 16, 28].includes(a) || [15, 16, 28].includes(b)) return r ? ` to enemies within ${r} yards` : ' to nearby enemies';
    if (sp[`effectChainTarget${n}`] > 1) return ` to up to ${sp[`effectChainTarget${n}`]} targets`;
    return '';
  };
  const durationText = (sp) => {
    const d = tables.duration.get(sp.durationIndex);
    return d ? ` for ${d}` : '';
  };
  const phrase = (sp, n, level, depth) => {
    const effect = sp[`effect${n}`];
    const aura = sp[`effectApplyAuraName${n}`];
    // aimed by script at creatures the database does not name (Golemagg's Attract Rager): it reaches nobody we can tell
    if ([7, 8, 38].includes(sp[`effectImplicitTargetA${n}`]) || [7, 8, 38].includes(sp[`effectImplicitTargetB${n}`])) if (!scriptTargets(sp.entry).length) return '';
    const val = value(sp, n, level);
    const ok = known(sp, n, val);
    const v = () => range(val);
    // "1157 to 1343 " or nothing, for sentences that read right either way
    const num = () => (ok ? `${range(val)} ` : '');
    const school = SCHOOL[sp.school] ?? '';
    const misc = sp[`effectMiscValue${n}`];
    switch (effect) {
      case 1:
        return sp[`effectImplicitTargetA${n}`] === 1 ? 'kills itself' : 'kills the target';
      case 2:
        return `deals ${num()}${school} damage${areaText(sp, n)}`;
      case 5:
        return sp[`effectImplicitTargetA${n}`] === 1 ? 'teleports itself' : 'teleports the target';
      case 7:
        return `deals ${num()}${school} damage${areaText(sp, n)}`;
      case 8:
        return ok ? `drains ${v()} mana` : 'drains mana';
      case 9: {
        const chain = sp[`effectChainTarget${n}`];
        return ok ? `drains ${v()} health${chain > 1 ? ` from up to ${chain} targets` : ''}` : 'drains health';
      }
      case 10:
        return ok ? `heals for ${v()}` : 'heals';
      case 17:
      case 58:
      case 121:
        return value(sp, n, level)[1] > 0 ? `strikes for weapon damage plus ${v()}${areaText(sp, n)}` : `strikes for weapon damage${areaText(sp, n)}`;
      case 19:
        return ok ? `gives the caster ${v()} extra attack${v() === '1' ? '' : 's'}` : 'gives the caster extra attacks';
      case 28:
      case 41:
      case 42:
      case 56:
      case 73:
      case 112: {
        const name = creatureName(misc);
        const count = effect === 42 || effect === 41 ? value(sp, n, level)[0] : 1;
        if (!name) return 'summons a creature';
        return count > 1 && count < 20 ? `summons ${count} ${plural(name)}` : `summons ${name}`;
      }
      case 30:
        return misc === 0 ? `restores ${v()} mana` : '';
      case 29:
        return 'leaps to the target';
      case 31:
        return ok ? `strikes for ${v()}% weapon damage${areaText(sp, n)}` : `strikes for weapon damage${areaText(sp, n)}`;
      case 38:
        return 'dispels magic';
      case 62:
        return ok ? `burns ${v()} mana` : 'burns mana';
      case 63: {
        // threat for the creatures the spell is aimed at (Mark of Arlokk sets her Zulian Prowlers on its target)
        const who = scriptTargets(sp.entry).map((id) => creatureName(id)).filter(Boolean);
        return who.length ? `sets nearby ${who.map(plural).join(' and ')} on the target` : ok ? `adds ${v()} threat` : '';
      }
      case 100:
        return 'makes the target drunk';
      case 124:
        return 'pulls the target to the caster';
      case 67:
        return 'heals to full health';
      case 68:
        return 'interrupts spellcasting';
      case 70:
      case 85:
        return 'pulls the target to the caster';
      case 74:
      case 87:
      case 88:
      case 89:
      case 90:
        return creatureName(misc) ? `places ${creatureName(misc)}` : 'places a totem';
      case 91:
      case 114:
        return 'taunts';
      case 96:
        return 'charges an enemy';
      case 98:
        return 'knocks back';
      case 108:
        return 'removes effects';
      case 125:
        return value(sp, n, level)[0] ? `${sp[`effectBasePoints${n}`] < 0 ? 'reduces' : 'increases'} the target's threat by ${fmt(value(sp, n, level)[0])}%` : '';
      case 64: {
        const t = spells.get(sp[`effectTriggerSpell${n}`]);
        return t && depth < 2 ? whole(t, level, depth + 1) : '';
      }
      case 6:
      case 27:
      case 35: {
        // A crowd-control aura the caster puts on itself (Arugal roots himself after a Shadow Port) says nothing.
        if (sp[`effectImplicitTargetA${n}`] === 1 && [5, 7, 12, 25, 26, 27, 60].includes(aura)) return '';
        // A drawback the caster takes itself (Anub'Rekhan slows while his Locust Swarm runs) says whose it is.
        const own = sp[`effectImplicitTargetA${n}`] === 1 && sp[`effectBasePoints${n}`] < 0;
        const its = own ? "the caster's " : '';
        switch (aura) {
          case 2:
          case 6:
            return `takes control of the target${durationText(sp)}`;
          case 3:
            return `deals ${num()}${school} damage every ${fmt((sp[`effectAmplitude${n}`] || 3000) / 1000)} sec${durationText(sp)}${areaText(sp, n)}`;
          case 5:
            return `confuses${durationText(sp)}`;
          case 7:
            return `fears${durationText(sp)}`;
          case 8:
            return `heals ${num()}every ${fmt((sp[`effectAmplitude${n}`] || 3000) / 1000)} sec${durationText(sp)}`;
          case 9:
          case 138: {
            const bp = sp[`effectBasePoints${n}`];
            return bp < 0 ? `slows ${its}attack speed by ${v()}%${durationText(sp)}` : `increases attack speed by ${v()}%${durationText(sp)}`;
          }
          case 12:
            return `stuns${durationText(sp)}`;
          case 15:
            return `deals ${num()}${school} damage to attackers`;
          case 18:
            return 'becomes invisible';
          case 22: {
            const bp = sp[`effectBasePoints${n}`];
            const what = misc === 1 ? 'armor' : misc === 126 || misc === 127 ? 'resistances' : 'resistance';
            return `${bp < 0 ? 'reduces' : 'increases'} ${its}${what} by ${v()}${durationText(sp)}`;
          }
          case 42: {
            const t = spells.get(sp[`effectTriggerSpell${n}`]);
            const inner = t && depth < 2 ? whole(t, level, depth + 1) : '';
            const chance = sp.procChance > 0 && sp.procChance < 100 ? `${sp.procChance}% chance ` : '';
            return inner ? `${chance}${procWhen(sp.procFlags)}: ${inner}` : '';
          }
          case 23: {
            // "every 2 sec for 20 sec: deals ...", or "after 10 sec: ..." when it fires once, as the aura ends
            const t = spells.get(sp[`effectTriggerSpell${n}`]);
            const inner = t && depth < 2 ? whole(t, level, depth + 1) : '';
            if (!inner) return '';
            const amp = (sp[`effectAmplitude${n}`] || 1000) / 1000;
            const lasts = seconds(tables.duration.get(sp.durationIndex));
            return lasts && amp >= lasts ? `after ${fmt(amp)} sec: ${inner}` : `every ${fmt(amp)} sec${durationText(sp)}: ${inner}`;
          }
          case 25:
            return `pacifies${durationText(sp)}`;
          case 26:
            return `roots${durationText(sp)}`;
          case 27:
            return `silences${durationText(sp)}`;
          case 28:
            return 'reflects spells';
          case 31:
            return `increases movement speed by ${v()}%`;
          case 33:
            return `slows ${its}movement by ${v()}%${durationText(sp)}`;
          case 39:
            return `becomes immune to ${SCHOOL_MASK(misc)}${durationText(sp)}`;
          case 47:
            return `increases parry chance by ${v()}%${durationText(sp)}`;
          case 49:
            return `increases dodge chance by ${v()}%${durationText(sp)}`;
          case 51:
            return `increases block chance by ${v()}%${durationText(sp)}`;
          case 52:
            return `increases critical strike chance by ${v()}%${durationText(sp)}`;
          case 53:
            return `drains ${v()} health every ${fmt((sp[`effectAmplitude${n}`] || 3000) / 1000)} sec${durationText(sp)}`;
          case 24: {
            // resources: the caster's own (Moam's Energize), or the players' around it (Vaelastrasz's Essence of the Red)
            const enemies = [15, 16, 28].includes(sp[`effectImplicitTargetB${n}`]) || [15, 16, 28].includes(sp[`effectImplicitTargetA${n}`]);
            const self = sp[`effectImplicitTargetA${n}`] === 1;
            const lead = self ? 'gains' : enemies ? 'gives everyone nearby' : 'gives';
            return ok ? `${lead} ${v()} ${POWER[misc] ?? 'power'} every ${fmt((sp[`effectAmplitude${n}`] || 1000) / 1000)} sec${durationText(sp)}` : '';
          }
          case 54: {
            const bp = sp[`effectBasePoints${n}`];
            return `${bp < 0 ? 'reduces' : 'increases'} ${its}chance to hit by ${v()}%${durationText(sp)}`;
          }
          case 162:
            return `burns ${v()} mana every ${fmt((sp[`effectAmplitude${n}`] || 3000) / 1000)} sec${durationText(sp)}${areaText(sp, n)}`;
          case 64:
            return `drains ${v()} mana every ${fmt((sp[`effectAmplitude${n}`] || 3000) / 1000)} sec${durationText(sp)}`;
          case 74:
            return `reflects ${SCHOOL_MASK(misc)}`;
          case 81:
            return `shares ${v()}% of the damage it takes`;
          case 84:
            return `regenerates ${v()} health every 5 sec`;
          case 99: {
            const bp = sp[`effectBasePoints${n}`];
            return `${bp < 0 ? 'reduces' : 'increases'} attack power by ${v()}${durationText(sp)}`;
          }
          case 101: {
            const bp = sp[`effectBasePoints${n}`];
            return `${bp < 0 ? 'reduces' : 'increases'} ${misc === 1 ? 'armor' : 'resistances'} by ${v()}%${durationText(sp)}`;
          }
          case 118: {
            const bp = sp[`effectBasePoints${n}`];
            return `${bp < 0 ? 'reduces' : 'increases'} healing taken by ${v()}%${durationText(sp)}`;
          }
          case 133: {
            const bp = sp[`effectBasePoints${n}`];
            return `${bp < 0 ? 'reduces' : 'increases'} maximum health by ${v()}%${durationText(sp)}`;
          }
          case 137: {
            const bp = sp[`effectBasePoints${n}`];
            return `${bp < 0 ? 'reduces' : 'increases'} all stats by ${v()}%${durationText(sp)}`;
          }
          case 13:
          case 79: {
            const bp = sp[`effectBasePoints${n}`];
            return `${bp < 0 ? 'reduces' : 'increases'} ${its}damage done by ${v()}${aura === 79 ? '%' : ''}${durationText(sp)}`;
          }
          case 14:
          case 87: {
            const bp = sp[`effectBasePoints${n}`];
            return `${bp < 0 ? 'reduces' : 'increases'} ${its}${schoolWord(misc)}damage taken by ${v()}${aura === 87 ? '%' : ''}${durationText(sp)}`;
          }
          case 56:
            return sp[`effectImplicitTargetA${n}`] === 1 ? '' : 'transforms the target';
          case 60:
            return `pacifies and silences${durationText(sp)}`;
          case 65: {
            const bp = sp[`effectBasePoints${n}`];
            return bp < 0 ? `slows ${its}casting by ${v()}%${durationText(sp)}` : `speeds up casting by ${v()}%${durationText(sp)}`;
          }
          case 67:
            return `disarms${durationText(sp)}`;
          case 69:
            return `absorbs ${v()} damage`;
          case 72:
            return `raises the cost of spells by ${v()}%${durationText(sp)}`;
          case 97:
            return `absorbs ${v()} damage with mana`;
          case 129:
            return `increases movement speed by ${v()}%`;
          default:
            return '';
        }
      }
      default:
        return '';
    }
  };
  // A phrase built around an amount the record does not hold ("by 0%") says nothing.
  const one = (sp, n, level, depth) => {
    const p = phrase(sp, n, level, depth);
    return p && /\bby 0%?(?=\W|$)/.test(p) ? '' : p;
  };
  const joinPhrases = (list) => {
    let out = [...new Set(list.filter(Boolean))];
    // "gives everyone nearby 500 mana every 1 sec" and "... 50 energy every 1 sec": one phrase
    const gives = out.map((p) => /^gives everyone nearby (\d+ \w+) (every .*)$/.exec(p));
    const tails = [...new Set(gives.filter(Boolean).map((m) => m[2]))];
    for (const tail of tails) {
      const parts = gives.filter((m) => m && m[2] === tail);
      if (parts.length < 2) continue;
      const amounts = parts.map((m) => m[1]);
      const merged = `gives everyone nearby ${amounts.slice(0, -1).join(', ')} and ${amounts[amounts.length - 1]} ${tail}`;
      out = out.filter((p) => !parts.some((m) => m[0] === p));
      out.push(merged);
    }
    // What happens "every 2 sec: ..." is a sentence of its own, after the rest, so the rest does not read as part of it.
    const timed = out.filter((p) => /^(every|after) [^:]*: /.test(p));
    const plain = out.filter((p) => !timed.includes(p));
    if (!plain.length || !timed.length) return out.join(', ');
    return [plain.join(', '), ...timed.map((p) => `${p[0].toUpperCase()}${p.slice(1)}`)].join('. ');
  };
  function whole(sp, level, depth = 0) {
    return joinPhrases([1, 2, 3].map((n) => one(sp, n, level, depth)));
  }
  const sentence = (s) => (s ? `${s[0].toUpperCase()}${s.slice(1)}.` : '');
  const gen = (sp, level) => sentence(whole(sp, level));
  // one effect alone (what the client's text leaves out), and phrases put together as whole() does
  gen.phrase = (sp, n, level) => one(sp, n, level, 0);
  gen.sentence = (list) => sentence(joinPhrases(list));
  return gen;
}

/** When a proc aura fires, from its proc flags (1.12: done and taken melee, ranged and spell hits). */
const PROC_DONE = 0x4 | 0x10 | 0x40 | 0x100 | 0x1000 | 0x10000 | 0x40000;
const PROC_TAKEN = 0x8 | 0x20 | 0x80 | 0x200 | 0x2000 | 0x20000 | 0x80000 | 0x100000;
function procWhen(flags) {
  const done = flags & PROC_DONE;
  const taken = flags & PROC_TAKEN;
  if (taken && !done) return taken & ~(0x8 | 0x20) ? 'when hit' : 'when struck in melee';
  if (done && !taken) return done & ~(0x4 | 0x10) ? 'on hit' : 'on a melee hit';
  return done && taken ? 'when it hits or is hit' : 'on hit';
}

/** Whether a spell is something a player meets in the fight, rather than a dummy, a visual or a script hook. */
const NOISE_NAME = /\(DND\)|\bDND\b|\bdummy\b|\btest\b|visual|cosmetic|\bcredit\b|despawn|spawn effect|self stun|stun self|root self|self root|kill self|suicide|hate to zero|\bclear all\b|\bremove all\b|teleport visual|^zzold|\bOLD\b|\[PH\]|^Quest -|\btrigger\b|^(Shoot|Throw|Attack|Auto Shot|Dual Wield|Battle Stance|Defensive Stance|Berserker Stance|Sneak|Stealth)$/i;

function meaningful(sp, spells, depth = 0) {
  for (let n = 1; n <= 3; n++) {
    const e = sp[`effect${n}`];
    if (!e) continue;
    // A look the caster takes, or a stun or root it puts on itself while a script does the work, is no ability.
    if ((e === 6 || e === 27 || e === 35) && sp[`effectImplicitTargetA${n}`] === 1 && [5, 7, 12, 25, 26, 27, 56, 60].includes(sp[`effectApplyAuraName${n}`])) continue;
    if ((e === 6 || e === 27 || e === 35) && AURA_WORDS.has(sp[`effectApplyAuraName${n}`])) {
      if (sp[`effectApplyAuraName${n}`] === 23 || sp[`effectApplyAuraName${n}`] === 42) {
        const t = spells.get(sp[`effectTriggerSpell${n}`]);
        if (t && depth < 2 && meaningful(t, spells, depth + 1)) return true;
        continue;
      }
      return true;
    }
    if (e === 64) {
      const t = spells.get(sp[`effectTriggerSpell${n}`]);
      if (t && depth < 2 && meaningful(t, spells, depth + 1)) return true;
      continue;
    }
    if (EFFECT_WORDS.has(e) && e !== 6 && e !== 27 && e !== 35) return true;
  }
  return false;
}

/** Names of script hooks that run an encounter rather than hit the players. */
const INTERNAL = /\b(Transform|Emerge|Submerge|Dies|Spawn|Selection|Activate|Full Strength|Power Down|Shrinks|Aggro|Channeling|Resurrection|Summon Ragnaros)\b/i;

/** Whether an effect is aimed at the players: an enemy, enemies around or in front, or a script's pick of them. */
function atEnemies(sp, n) {
  const a = sp[`effectImplicitTargetA${n}`];
  const b = sp[`effectImplicitTargetB${n}`];
  if ([2, 6, 15, 16, 24, 28, 36, 54].includes(a)) return true;
  if (a === 22 && [15, 16, 24, 54].includes(b)) return true;
  return sp[`effect${n}`] === 77 && (a === 1 || (a === 22 && b === 7));
}

/**
 * NPC spells often say "inflicting Fire damage" without the amount. When exactly one effect of the spell does that
 * damage (a direct hit, or a damage-over-time aura for "... every 3 sec"), its amount goes into the sentence.
 */
function withNumbers(text, sp, level, value, spells) {
  const direct = [1, 2, 3].filter((n) => [2, 7].includes(sp[`effect${n}`]));
  const aura = (id) => [1, 2, 3].filter((n) => [6, 27, 35].includes(sp[`effect${n}`]) && sp[`effectApplyAuraName${n}`] === id);
  const periodic = aura(3);
  const amount = (n) => {
    const v = value(sp, n, level);
    return known(sp, n, v) ? range(v) : null;
  };
  const every = (n) => fmt((sp[`effectAmplitude${n}`] || 1000) / 1000);
  const one = (list) => (list.length === 1 ? amount(list[0]) : null);
  const SCHOOL = '(Physical|Holy|Fire|Nature|Frost|Shadow|Arcane)';
  let t = text.replace(/\b(inflicts|inflicting|causing|causes|deals|dealing|doing|does)( additional)? ((?:Physical|Holy|Fire|Nature|Frost|Shadow|Arcane) )?damage\b([^.]*)/gi, (all, verb, add, school, rest) => {
    // "every" or "over" in the same clause makes it the damage over time: in "inflicting Nature damage, then
    // additional damage every 2 sec" the first is the hit
    const over = /\b(every|over)\b/.test(rest.split(/,|;|\bthen\b|\band\b/)[0]);
    // a damage-over-time spell whose text names no period (Mind Flay: "Inflicts Shadow damage to an enemy and reduces
    // its movement speed"): the tick and how often it comes
    if (!over && !direct.length && periodic.length === 1) {
      const v = amount(periodic[0]);
      return v ? `${verb}${add ?? ''} ${v} ${school ?? ''}damage every ${every(periodic[0])} sec${rest}` : all;
    }
    const list = over ? periodic : direct;
    if (list.length !== 1) return all;
    return `${verb}${add ?? ''} ${range(value(sp, list[0], level))} ${school ?? ''}damage${rest}`;
  });
  // "..., then additional damage every 2 sec" (Poison Bolt Volley)
  t = t.replace(/\b(then|and) additional damage (every|over)\b/g, (all, joint, when) => {
    const v = one(periodic);
    return v ? `${joint} additional ${v} damage ${when}` : all;
  });
  // Missiles "inflicting Arcane damage each second": the hit of the spell the aura casts each time
  t = t.replace(new RegExp(`\\binflicting ${SCHOOL} damage each second\\b`, 'g'), (all, school) => {
    const n = aura(23);
    const trig = n.length === 1 ? spells?.get(sp[`effectTriggerSpell${n[0]}`]) : null;
    const hits = trig ? [1, 2, 3].filter((k) => [2, 7].includes(trig[`effect${k}`])) : [];
    if (hits.length !== 1) return all;
    const v = value(trig, hits[0], level);
    return known(trig, hits[0], v) ? `inflicting ${range(v)} ${school} damage each second` : all;
  });
  // a weapon swing "inflicting damage" (Arcing Smash)
  if ([1, 2, 3].some((n) => [17, 31, 58, 121].includes(sp[`effect${n}`]))) t = t.replace(/\binflicting damage\b/g, 'inflicting weapon damage');
  // "Blasts nearby enemies for Frost damage" (Chill Nova)
  t = t.replace(new RegExp(`\\bfor ${SCHOOL} damage\\b`, 'g'), (all, school) => {
    const v = one(direct);
    return v ? `for ${v} ${school} damage` : all;
  });
  // Chain Lightning's text has each next target take more; the server multiplies each jump by the record's factor
  // (Spell::DoAllEffectOnTarget in VMaNGOS): 0.7 is 30% less per target.
  t = t.replace(new RegExp(`\\binflicting greater ${SCHOOL} damage to each successive target\\b`, 'g'), (all, school) => {
    const n = direct.find((k) => sp[`effectChainTarget${k}`] > 1 && sp[`effectImplicitTargetA${k}`] === 6);
    const v = n && amount(n);
    if (!v) return all;
    const m = Math.round((sp[`dmgMultiplier${n}`] ?? 1) * 100);
    const next = m === 100 ? 'as much to each next one' : `${Math.abs(100 - m)}% ${m < 100 ? 'less' : 'more'} to each next one`;
    return `inflicting ${v} ${school} damage to the first and ${next}`;
  });
  // Wards that "absorb a fixed amount of Fire damage", heals "for a fixed amount" or "every 3 sec" without one
  t = t.replace(new RegExp(`\\ba fixed amount of ${SCHOOL} damage\\b`, 'g'), (all, school) => {
    const v = one(aura(69));
    return v ? `${v} ${school} damage` : all;
  });
  t = t.replace(/\b(Heals (?:an ally|the caster|its target)) for a fixed amount\b/g, (all, lead) => {
    const v = one([1, 2, 3].filter((n) => sp[`effect${n}`] === 10));
    return v ? `${lead} for ${v}` : all;
  });
  t = t.replace(/\bheals additional damage every\b/g, (all) => {
    const v = one(aura(8));
    return v ? `heals ${v} more every` : all;
  });
  t = t.replace(/\b(Heals (?:an ally|the caster|its target)) every\b/g, (all, lead) => {
    const v = one(aura(8));
    return v ? `${lead} for ${v} every` : all;
  });
  return t;
}

/** Sentences of player spell text that say nothing about a creature's use of it. */
const PLAYER_RULES = /yields experience or honor|must channel to maintain|^You will automatically stop attacking|^Target must be facing you|^(Causes|Generates) a high amount of threat|^That is unless it explodes|can only be placed when out of combat|Players may only have one|\bper (paladin|warlock|priest|mage|druid|shaman|hunter|rogue|warrior)\b|^Once protected|cannot be made invulnerable|^Only (one|1) (target|curse|aura|sting|seal|blessing|judgement|totem|elemental shield|trap)\b|^Only works on|^Cannot be used|^Requires\b|^Must be\b|^Usable\b|while in (Cat|Bear|Dire Bear|Travel|Aquatic) Form|^Generates? \d+ rage|^Slime nearby targets$/i;

function tidy(text) {
  if (!text) return '';
  let t = text.replace(/ plus 0\b/g, '').replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim();
  // A sentence ends at a stop followed by a capital: "every 3 sec. to an enemy" and "sec., then" go on.
  const sentences = t.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const kept = [];
  let length = 0;
  for (const raw of sentences) {
    const one = raw.trim();
    if (!one || PLAYER_RULES.test(one)) continue;
    if (kept.length && length + one.length > 220) break;
    kept.push(one);
    length += one.length + 1;
  }
  t = kept.join(' ').trim();
  // what is left of a text whose point was a player rule ("Lasts 20 sec.") says nothing
  if (/^Lasts [^.]*\.?$/.test(t)) return '';
  // Player spell text read for a creature: the caster, not "the paladin"; it, not you.
  t = t
    .replace(/,? but (causes|generates) a high amount of threat/gi, '')
    .replace(/\b(the) (paladin|priest|druid|shaman|mage|warlock|warrior|rogue|hunter)('s)?\b/gi, (all, the, cls, poss) => `${the} caster${poss ?? ''}`)
    .replace(/\ball party members\b/g, 'its allies nearby')
    .replace(/\bnearby party members\b/g, 'nearby allies')
    .replace(/\bany creature that strikes a nearby party member\b/g, 'anyone who strikes it or an ally nearby')
    .replace(/\ba nearby party member\b/g, 'a nearby ally')
    .replace(/\bparty member\b/g, 'ally')
    .replace(/\bparty members\b/g, 'allies')
    .replace(/\bthe engineer using the weapon\b/g, 'the caster')
    .replace(/^Place a\b/, 'Places a')
    .replace(/^Heal your target\b/, 'Heals its target')
    .replace(/^Instantly counterattack any\b/, 'Counterattacks any')
    // a player's spell text opens with the verb itself ("Smite an enemy", "Instantly counterattack"): the creature does it
    .replace(/^(Instantly )?(Smite|Rake|Increase|Reduce|Scream|Strike|Hurl|Throw|Shoot|Deal|Inflict|Cause|Burn|Drain|Stun|Charge|counterattack)\b(?=\s)/, (all, inst, verb) => `${inst ?? ''}${verb}s`)
    .replace(/\byour\b/g, 'its')
    .replace(/\bYour\b/g, 'Its')
    .replace(/\byou\b/g, 'it')
    // a number the record does not hold leaves "weapon damage plus every 2 sec": the "plus" goes with it
    .replace(/\bplus (?=[^\d\s])/g, '');
  if (t && !/[.!?]$/.test(t)) t += '.';
  return t;
}

/** Whether a boss counts among a dungeon's bosses: rare spawns, world-event bosses, quest summons and the ones players
 *  call up with something in the instance (the Blacksmithing Plans' smiths) do not. */
const counted = (b) => !b.f?.some((f) => f === 'rare' || f === 'event' || f === 'quest' || f === 'summon');

/* ── The server's patches to spells ────────────────────────────────────────────────────────────────────────────── */

// spell_mod and spell_effect_mod columns, as the spell_template columns they overwrite
const SPELL_MOD = {
  procChance: 'procChance', procFlags: 'procFlags', procCharges: 'procCharges', DurationIndex: 'durationIndex', Category: 'category',
  CastingTimeIndex: 'castingTimeIndex', StackAmount: 'stackAmount', SpellIconID: 'spellIconId', activeIconID: 'activeIconId', manaCost: 'manaCost',
  Attributes: 'attributes', AttributesEx: 'attributesEx', AttributesEx2: 'attributesEx2', AttributesEx3: 'attributesEx3', AttributesEx4: 'attributesEx4',
  InterruptFlags: 'interruptFlags', AuraInterruptFlags: 'auraInterruptFlags', ChannelInterruptFlags: 'channelInterruptFlags', Dispel: 'dispel',
  Stances: 'stances', StancesNot: 'stancesNot', SpellVisual: 'spellVisual1', ManaCostPercentage: 'manaCostPercentage',
  StartRecoveryCategory: 'startRecoveryCategory', StartRecoveryTime: 'startRecoveryTime', MaxTargetLevel: 'maxTargetLevel',
  MaxAffectedTargets: 'maxAffectedTargets', DmgClass: 'dmgClass', rangeIndex: 'rangeIndex', RecoveryTime: 'recoveryTime',
  CategoryRecoveryTime: 'categoryRecoveryTime', SpellFamilyName: 'spellFamilyName', Mechanic: 'mechanic',
};
// [column, field, how a value counts as given]: uint (0 and up), int (anything but -1)
const EFFECT_MOD = [
  ['Effect', 'effect', 'uint'], ['EffectApplyAuraName', 'effectApplyAuraName', 'uint'], ['EffectMechanic', 'effectMechanic', 'uint'],
  ['EffectImplicitTargetA', 'effectImplicitTargetA', 'uint'], ['EffectImplicitTargetB', 'effectImplicitTargetB', 'uint'],
  ['EffectRadiusIndex', 'effectRadiusIndex', 'uint'], ['EffectItemType', 'effectItemType', 'uint'], ['EffectMiscValue', 'effectMiscValue', 'int'],
  ['EffectTriggerSpell', 'effectTriggerSpell', 'uint'], ['EffectDieSides', 'effectDieSides', 'int'], ['EffectBaseDice', 'effectBaseDice', 'uint'],
  ['EffectBasePoints', 'effectBasePoints', 'int'], ['EffectAmplitude', 'effectAmplitude', 'uint'], ['EffectChainTarget', 'effectChainTarget', 'uint'],
  ['EffectDicePerLevel', 'effectDicePerLevel', 'int'], ['EffectRealPointsPerLevel', 'effectRealPointsPerLevel', 'int'],
  ['EffectPointsPerComboPoint', 'effectPointsPerComboPoint', 'int'], ['EffectMultipleValue', 'effectMultipleValue', 'int'],
];

/**
 * The spells as the VMaNGOS server runs them. At startup it writes spell_mod and then spell_effect_mod over the
 * client's records (SpellModMgr::LoadSpellMods, for every patch): -1 leaves a value as it is (for most unsigned
 * columns any value below 0 does), Custom and SpellFamilyFlags only count when not 0. Returns a lookup like the
 * client's map, with patched copies of the spells concerned; on a copy, __added lists the effects (1 to 3) the patch
 * gave a new kind, aura or triggered spell, which the client's text cannot tell (Onyxia's Fireball also sets its
 * targets aflame). The client's own records stay as they are, for the items.
 */
function patchedSpells(db, spells) {
  const copies = new Map();
  const copy = (id) => {
    if (!copies.has(id)) {
      const sp = spells.get(id);
      if (!sp) return null;
      copies.set(id, { ...sp, __orig: sp, __added: [] });
    }
    return copies.get(id);
  };
  const given = (v, how) => v !== null && v !== undefined && (how === 'uint' ? v >= 0 : v !== -1);
  for (const r of db.prepare('SELECT * FROM spell_mod').all()) {
    const sp = copy(r.Id);
    if (!sp) continue;
    for (const [col, field] of Object.entries(SPELL_MOD)) if (given(r[col], 'uint')) sp[field] = r[col];
    if (sp.stackAmount !== sp.__orig.stackAmount) sp.__stack = true;
    if (r.Custom) sp.customFlags = r.Custom;
    if (r.SpellFamilyFlags) sp.spellFamilyFlags = r.SpellFamilyFlags;
    if (given(r.EquippedItemClass, 'int')) sp.equippedItemClass = r.EquippedItemClass;
  }
  for (const r of db.prepare('SELECT * FROM spell_effect_mod ORDER BY Id, EffectIndex').all()) {
    const sp = copy(r.Id);
    const n = r.EffectIndex + 1;
    if (!sp || n < 1 || n > 3) continue;
    for (const [col, field, how] of EFFECT_MOD) if (given(r[col], how)) sp[`${field}${n}`] = r[col];
  }
  // What the patch adds: effects of a kind (with the spell they trigger) the client's record does not have. Effects
  // only put in another order (Hand of Ragnaros) add nothing; an effect left at 0 does nothing on the server (Spell::
  // EffectNULL), whatever aura the patch names for it (Chromaggus's Frenzy).
  const kind = (r, n) => `${r[`effect${n}`]}/${r[`effectApplyAuraName${n}`]}/${r[`effectTriggerSpell${n}`]}`;
  for (const sp of copies.values()) {
    const before = [1, 2, 3].filter((n) => sp.__orig[`effect${n}`]).map((n) => kind(sp.__orig, n));
    for (const n of [1, 2, 3]) {
      if (!sp[`effect${n}`]) continue;
      const i = before.indexOf(kind(sp, n));
      if (i >= 0) before.splice(i, 1);
      else sp.__added.push(n);
    }
  }
  return { get: (id) => copies.get(id) ?? spells.get(id), patched: copies };
}

/** The record a description token reads an effect's numbers from: the client's when the patch changed that effect's
 *  kind (the token then still means what the client's text means), else the patched one. */
const tokenRecord = (sp, n) => {
  const o = sp?.__orig;
  if (!o) return sp;
  return o[`effect${n}`] !== sp[`effect${n}`] || o[`effectApplyAuraName${n}`] !== sp[`effectApplyAuraName${n}`] ? o : sp;
};

/* ── The builder ──────────────────────────────────────────────────────────────────────────────────────────────── */

export function buildEncounters({ db, world, dungeons, staticEncounters, bossScripts, tf }) {
  const { creatures, spells, loot, itemTemplates, objectTemplates } = world;
  const problems = [];
  const report = { bosses: 0, withAbilities: 0, abilities: 0, bySource: { list: 0, eventai: 0, script: 0, aura: 0 }, noAbilities: [], summoned: [], trash: 0 };

  // Durations and radii come from the client's tooltips, so from the client's own records.
  const tables = clientTables(tf, spells);
  // The bosses' spells as the server runs them: VMaNGOS patches some at startup (spell_mod, spell_effect_mod). Items
  // keep the client's records, which is what their tooltips in game show.
  const live = patchedSpells(db, spells);
  const melee = new Map(db.prepare('SELECT level, melee_damage FROM creature_classlevelstats WHERE class = 1').all().map((r) => [r.level, r.melee_damage]));
  const value = makeEffectValue((level) => melee.get(level));
  const describe = makeDescribe({ spells: live, value, tables });
  const creatureName = (id) => creatures.get(id)?.name;
  // The creatures a spell aimed by script may hit (spell_script_target, creature rows): Golemagg's Trust, his Core Ragers.
  const scriptTargetRows = new Map();
  for (const r of db.prepare('SELECT entry, type, targetEntry, build_min, build_max FROM spell_script_target').all()) {
    if (r.type !== 1 || r.build_min > CLIENT_BUILD || r.build_max < CLIENT_BUILD) continue;
    if (!scriptTargetRows.has(r.entry)) scriptTargetRows.set(r.entry, []);
    scriptTargetRows.get(r.entry).push(r.targetEntry);
  }
  const scriptTargets = (id) => scriptTargetRows.get(id) ?? [];
  const generate = makeGenerate({ value, tables, creatureName, spells: live, scriptTargets });

  /* Spawns, and the world events some spawns belong to */
  const eventOf = new Map(db.prepare('SELECT guid, event FROM game_event_creature').all().filter((r) => r.event > 0).map((r) => [r.guid, r.event]));
  const eventName = new Map(db.prepare('SELECT entry, description FROM game_event').all().map((r) => [r.entry, r.description]));
  const spawnsByNpc = new Map();
  for (const r of db.prepare('SELECT guid, id, id2, id3, id4, id5, map, spawn_flags, patch_min, patch_max FROM creature').all()) {
    if (!inPatch(r)) continue;
    for (const id of [r.id, r.id2, r.id3, r.id4, r.id5]) {
      if (!id) continue;
      if (!spawnsByNpc.has(id)) spawnsByNpc.set(id, []);
      spawnsByNpc.get(id).push(r);
    }
  }
  /** spawned, summoned (the server makes it by script) or event (a world event places it). */
  const howHere = (npc, map) => {
    const rows = (spawnsByNpc.get(npc) ?? []).filter((r) => r.map === map && !(r.spawn_flags & 2));
    if (!rows.length) return { how: 'summoned' };
    const events = rows.map((r) => eventOf.get(r.guid));
    if (events.every(Boolean)) return { how: 'event', event: eventName.get(events[0])?.replace(/\s*-\s*Boss in instance activation$/i, '') };
    return { how: 'spawned' };
  };

  /* Grimoire's corrections (static/encounters.json): a spell list VMaNGOS points at by mistake, spells the server
     casts that neither the database nor the extraction of the C++ scripts can see, and for the creatures of one boss
     what a spell does, when and in which school, where the server code says it and no record does */
  const listFix = new Map();
  const extraSpells = new Map();
  const NO_FIXES = { texts: new Map(), hide: new Set(), schools: new Map(), when: new Map() };
  const fixesOf = new Map(); // npc -> the corrections of its boss entry
  const byId = (o) => new Map(Object.entries(o ?? {}).map(([id, v]) => [Number(id), v]));
  for (const [slug, def] of Object.entries(staticEncounters)) {
    if (slug === '_') continue;
    for (const w of def.wings) for (const b of w.bosses) {
      for (const [npc, list] of Object.entries(b.spellList ?? {})) listFix.set(Number(npc), list);
      for (const [npc, ids] of Object.entries(b.spells ?? {})) extraSpells.set(Number(npc), ids);
      // texts: what a spell does where the numbers live in a script (the Horsemen's marks); hide: spells such a text
      // tells instead, or only a visual; schools: the school of what a spell does where the spell has another (Sand
      // Trap); when: the phase of the fight the script casts it in (Onyxia in the air)
      const fixes = { texts: byId(b.texts), hide: new Set(b.hide ?? []), schools: byId(b.schools), when: byId(b.when) };
      for (const npc of b.npc) fixesOf.set(npc, fixes);
    }
  }

  /* EventAI and spell lists */
  const listRows = new Map(db.prepare('SELECT * FROM creature_spells').all().map((r) => [r.entry, r]));
  const aiEvents = new Map();
  for (const r of db.prepare('SELECT * FROM creature_ai_events ORDER BY id').all()) {
    if (!aiEvents.has(r.creature_id)) aiEvents.set(r.creature_id, []);
    aiEvents.get(r.creature_id).push(r);
  }
  const scriptRows = (table) => {
    const m = new Map();
    for (const r of db.prepare(`SELECT * FROM ${table} ORDER BY id, delay, priority`).all()) {
      if (!m.has(r.id)) m.set(r.id, []);
      m.get(r.id).push(r);
    }
    return m;
  };
  const aiScripts = scriptRows('creature_ai_scripts');
  const genericScripts = scriptRows('generic_scripts');
  // Actions only a world event allows (Thalnos calls Scorn during the Scourge Invasion) are not part of the fight.
  const conditionRows = new Map(db.prepare('SELECT * FROM conditions').all().map((r) => [r.condition_entry, r]));
  const eventOnly = (id, depth = 0) => {
    const c = conditionRows.get(id);
    if (!c || depth > 4) return false;
    if (c.type === 12 || c.type === 26) return !(c.flags & 1);
    const parts = [c.value1, c.value2, c.value3, c.value4].filter(Boolean);
    if (c.flags & 1) return false;
    if (c.type === -1) return parts.some((x) => eventOnly(x, depth + 1)); // AND: one part needs the event
    if (c.type === -2) return parts.length > 0 && parts.every((x) => eventOnly(x, depth + 1)); // OR: every way needs it
    return false;
  };

  const hp = (ev) => {
    const flags = ev.event_flags;
    const max = ev.event_param1;
    if (max >= 100 || max <= 0) return '';
    return flags & 1 ? `below ${max}% health` : `at ${max}% health`;
  };
  const triggerOf = (ev) => {
    switch (ev.event_type) {
      case 2:
        return hp(ev);
      case 3:
        return ev.event_param1 > 0 && ev.event_param1 < 100 ? `below ${ev.event_param1}% mana` : '';
      case 4:
        return 'on pull';
      case 6:
        return 'on death';
      case 12:
        return ev.event_param1 > 0 && ev.event_param1 < 100 ? `on a target below ${ev.event_param1}% health` : '';
      case 13:
        return 'to interrupt spellcasting';
      case 14:
      case 15:
      case 16:
        return 'on its allies';
      default:
        return '';
    }
  };
  const SKIP_EVENTS = new Set([5, 7, 8, 19, 20, 21, 22, 29, 30, 31]);

  /** The abilities one creature uses, in a first pass: { id, t (when), via }. Summons and flights come as behaviours. */
  function rawAbilities(npc) {
    const c = creatures.get(npc);
    const out = [];
    const behaviours = [];
    if (!c) return { out, behaviours };
    // The AI the server gives the creature (CreatureAISelector): a C++ script when one is registered for its script
    // name, else its ai_name. Under a script the creature's EventAI rows never run, and its spell list only when the
    // script keeps the update of BasicAI (static/boss-scripts.json says which do).
    const script = bossScripts.scripts?.[c.script_name];
    const eventAI = !script && c.ai_name === 'EventAI';
    const lists = new Set((script ? script.lists : c.ai_name !== 'NullAI') ? [listFix.get(npc) ?? c.spell_list_id].filter(Boolean) : []);
    const SLOTS = ['datalong', 'datalong2', 'datalong3', 'datalong4'];
    const handle = (cmd, ev, depth) => {
      if (cmd.condition_id && eventOnly(cmd.condition_id)) return;
      switch (cmd.command) {
        case 15: // cast
          if (cmd.datalong) out.push({ id: cmd.datalong, t: triggerOf(ev), via: 'eventai' });
          break;
        case 55: // switch to other spell lists
          for (const k of SLOTS) if (cmd[k]) lists.add(cmd[k]);
          break;
        case 39: // run generic scripts
          if (depth < 2) for (const k of SLOTS) for (const g of genericScripts.get(cmd[k]) ?? []) handle(g, ev, depth + 1);
          break;
        case 10: // summon a creature
          if (cmd.datalong && creatures.get(cmd.datalong)) behaviours.push({ kind: 'summon', npc: cmd.datalong, t: triggerOf(ev) });
          break;
        case 47: // flee
          behaviours.push({ kind: 'flee', t: triggerOf(ev) });
          break;
        default:
          break;
      }
    };
    for (const ev of eventAI ? (aiEvents.get(npc) ?? []) : []) {
      if (SKIP_EVENTS.has(ev.event_type) || (ev.condition_id && eventOnly(ev.condition_id))) continue;
      for (const k of ['action1_script', 'action2_script', 'action3_script']) for (const cmd of aiScripts.get(ev[k]) ?? []) handle(cmd, ev, 0);
    }
    // What the creature wears until the pull and drops on aggro (the ghosts' invisibility and immunity, a channeling
    // pose) is no ability of the fight.
    const offOnAggro = new Set();
    for (const ev of eventAI ? (aiEvents.get(npc) ?? []) : []) {
      if (ev.event_type !== 4) continue;
      for (const k of ['action1_script', 'action2_script', 'action3_script']) for (const cmd of aiScripts.get(ev[k]) ?? []) if (cmd.command === 14 && cmd.datalong) offOnAggro.add(cmd.datalong);
    }
    for (let i = out.length - 1; i >= 0; i--) if (offOnAggro.has(out[i].id) && out[i].t !== 'on pull') out.splice(i, 1);
    for (const id of lists) {
      const row = listRows.get(id);
      if (!row) continue;
      for (let i = 1; i <= 8; i++) if (row[`spellId_${i}`]) out.push({ id: row[`spellId_${i}`], t: '', via: 'list' });
    }
    for (const id of script?.spells ?? []) out.push({ id, t: script.onDeath?.includes(id) ? 'on death' : '', via: 'script' });
    for (const id of extraSpells.get(npc) ?? []) out.push({ id, t: '', via: 'script' });
    for (const id of script?.summons ?? []) if (creatures.get(id)) behaviours.push({ kind: 'summon', npc: id, t: '' });
    for (const id of String(c.auras ?? '').split(/\s+/).map(Number).filter(Boolean)) out.push({ id, t: 'passive', via: 'aura' });
    return { out, behaviours };
  }

  /**
   * The school a player meets: a physical-school aura that only procs or ticks another spell (Ragnaros's Elemental
   * Fire, Baron Geddon's Inferno) hits with that spell's school. One that also does something of its own (Magmadar's
   * Frenzy speeds up his attacks) keeps its own; a drawback the caster takes itself does not count.
   */
  const schoolOf = (sp, depth = 0) => {
    if (sp.school !== 0 || depth > 1) return sp.school;
    let via = 0;
    for (let n = 1; n <= 3; n++) {
      const effect = sp[`effect${n}`];
      if (!effect) continue;
      if ([42, 23].includes(sp[`effectApplyAuraName${n}`]) || effect === 64) {
        const t = live.get(sp[`effectTriggerSpell${n}`]);
        if (!via && t && schoolOf(t, depth + 1) !== 0) via = schoolOf(t, depth + 1);
      } else {
        // a drawback on the caster: it kills, roots, stuns or slows itself
        const self = sp[`effectImplicitTargetA${n}`] === 1;
        const drawback = effect === 1 || sp[`effectBasePoints${n}`] < 0 || [5, 7, 12, 25, 26, 27, 33, 56, 60].includes(sp[`effectApplyAuraName${n}`]);
        if (!(self && drawback)) return 0;
      }
    }
    return via;
  };

  // Whom a spell is for when not for the players or its caster. Spells aimed by script (spell_script_target) name the
  // creatures: Golemagg's Trust is for his Core Ragers, Majordomo's shields for his Flamewakers. Others aimed at
  // friendly units only give 'allies'. Anything with an effect on the caster, an enemy or a place gives null.
  const FRIEND = new Set([3, 5, 20, 21, 27, 29, 30, 31, 33, 34, 35, 37, 45, 56, 57, 58, 59, 61]);
  const SCRIPTED = new Set([7, 8, 38]);
  const alliesOf = (sp, depth = 0) => {
    const ids = new Set();
    let any = false;
    for (let n = 1; n <= 3; n++) {
      const e = sp[`effect${n}`];
      if (!e) continue;
      const a = sp[`effectImplicitTargetA${n}`];
      const b = sp[`effectImplicitTargetB${n}`];
      if (e === 64 || ((e === 6 || e === 27 || e === 35) && [23, 42].includes(sp[`effectApplyAuraName${n}`]))) {
        const t = depth < 2 && live.get(sp[`effectTriggerSpell${n}`]);
        const r = t && alliesOf(t, depth + 1);
        if (!r) return null;
        if (Array.isArray(r)) for (const id of r) ids.add(id);
        any = true;
        continue;
      }
      if (SCRIPTED.has(a) || SCRIPTED.has(b)) {
        const t = scriptTargets(sp.entry);
        if (!t.length) return null;
        for (const id of t) ids.add(id);
        any = true;
        continue;
      }
      if (FRIEND.has(a) || FRIEND.has(b)) {
        any = true;
        continue;
      }
      return null;
    }
    if (!any) return null;
    return ids.size ? [...ids] : 'allies';
  };

  /** Whether a spell hurts whoever it lands on: damage, a kill, or a debuff (more damage taken, a stun, a slow). */
  const harmful = (sp, depth = 0) =>
    [1, 2, 3].some((n) => {
      const e = sp[`effect${n}`];
      const aura = sp[`effectApplyAuraName${n}`];
      const bp = sp[`effectBasePoints${n}`];
      if ([1, 2, 7, 9].includes(e)) return true;
      if (e === 64 || [23, 42].includes(aura)) {
        const t = depth < 2 && live.get(sp[`effectTriggerSpell${n}`]);
        return t ? harmful(t, depth + 1) : false;
      }
      if (![6, 27, 35].includes(e)) return false;
      if ([3, 5, 7, 12, 25, 26, 27, 53, 60].includes(aura)) return true;
      if ([14, 87].includes(aura)) return bp > 0;
      if ([9, 13, 33, 65, 79, 99, 118, 133, 137, 138].includes(aura)) return bp < 0;
      return false;
    });

  /** "Strikes at an enemy, inflicting increased melee damage." and "strikes for weapon damage plus 130": one sentence. */
  const WEAPON = /^strikes for weapon damage( plus \d+(?: to \d+)?)?(.*)$/;
  const mergeWeapon = (own, extra) => {
    const w = extra.map((x) => WEAPON.exec(x)).find(Boolean);
    if (!w) return null;
    const plus = w[1] ?? '';
    const area = w[2] ?? '';
    let merged = null;
    const melee = /,? inflicting (?:increased melee|additional|normal|Physical) damage/;
    const school = /,? inflicting (Holy|Fire|Nature|Frost|Shadow|Arcane) damage/;
    const inflicts = /\bInflicts (?:increased melee|additional|normal|Physical) damage(?: to nearby enemies)?/;
    if (melee.test(own)) merged = own.replace(melee, ` for weapon damage${plus}`).replace(/\.$/, area ? `. Hits${area.replace(/^ to\b/, '')}.` : '.');
    else if (school.test(own)) merged = own.replace(school, (all, sch) => `, inflicting weapon damage${plus} as ${sch} damage`);
    else if (inflicts.test(own)) merged = own.replace(inflicts, `Inflicts weapon damage${plus}${area || ' to nearby enemies'}`);
    if (!merged) return null;
    const rest = extra.filter((x) => !WEAPON.test(x));
    return rest.length ? `${merged} ${rest.join(', ').replace(/^./, (c) => c.toUpperCase())}.` : merged;
  };

  /** A creature's abilities as shown: real spells only, one per name and school, with their text at its level. */
  function abilitiesOf(npc, level) {
    const { out, behaviours } = rawAbilities(npc);
    const fixes = fixesOf.get(npc) ?? NO_FIXES;
    const kept = new Map(); // name|school -> ability
    for (const a of out) {
      const sp = live.get(a.id);
      if (!sp || !sp.name || NOISE_NAME.test(sp.name) || fixes.hide.has(sp.entry)) continue;
      const effects = [1, 2, 3].filter((n) => sp[`effect${n}`]);
      // a mount (Mandokir rides his raptor in) and a hop of the caster to its next spot are no abilities
      if (effects.some((n) => sp[`effectApplyAuraName${n}`] === 78)) continue;
      if (effects.length && effects.every((n) => sp[`effect${n}`] === 5 && sp[`effectImplicitTargetA${n}`] === 1)) continue;
      const fixed = fixes.texts.get(sp.entry);
      const own = fixed ?? tidy(withNumbers(describe(sp, level), sp, level, value, live));
      const useful = meaningful(sp, live);
      // A mechanic the server script runs (Hakkar's Blood Siphon, Gluth's Decimate) has no effect a record can show,
      // but it is cast at the players: its name stays even without a line about it.
      const scripted = a.via !== 'aura' && !INTERNAL.test(sp.name) && [1, 2, 3].some((n) => [3, 61, 77].includes(sp[`effect${n}`]) && atEnemies(sp, n));
      // A spell with a text of its own stays (Banshee Curse, Ignite Mana); one without needs an effect a player meets.
      if (!useful && !own && !scripted) continue;
      // What a boss does to its own creatures as it dies and that only harms them (Razuvious's Hopeless on his
      // Understudies) is not part of the fight; a last buff for the others (the Bug Trio's Vengeance) is.
      const allies = alliesOf(sp);
      if (allies && a.t === 'on death' && harmful(sp)) continue;
      const gen = generate(sp, level);
      // Player spell text in the second person ("You are protected ...") reads wrong for a creature: say what it does.
      let text = /^(You|Your)\b/.test(own) && gen ? gen : own || gen;
      if (text === own && own && !fixed) {
        // a patched-in effect the client's text already points at ("Heals a friendly target for $s1" on Holy Light,
        // whose script effect the patch makes a heal) is told by it
        const told = new Set([...String(sp.description ?? '').matchAll(/\$(?:\d+)?[sSmMoOtTxX]([1-3])/g)].map((m) => Number(m[1])));
        const added = new Set((sp.__added ?? []).filter((n) => !told.has(n)));
        // Blizzard's sentence without a single number: add the phrases of its effects that have one. For a proc ("Adds
        // a chance to do two additional attacks") the generated line says it all: how likely, on what, and how much.
        if (!/\d/.test(own)) {
          const proc = [1, 2, 3].some((n) => sp[`effectApplyAuraName${n}`] === 42);
          const extra = [1, 2, 3].filter((n) => !added.has(n)).map((n) => generate.phrase(sp, n, level)).filter((x) => x && /[1-9]/.test(x));
          if (proc && gen && /\d/.test(gen)) text = gen;
          else if (extra.length) text = mergeWeapon(own, extra) ?? `${own} ${generate.sentence(extra)}`;
        }
        // What a server patch added to the spell is not in the client's text: it is told after it.
        const more = [];
        for (const n of added) {
          const aura = sp[`effectApplyAuraName${n}`];
          const trig = sp[`effect${n}`] === 64 || [23, 42].includes(aura) ? live.get(sp[`effectTriggerSpell${n}`]) : null;
          const said = trig ? (fixes.texts.get(trig.entry) ?? tidy(withNumbers(describe(trig, level), trig, level, value, live))) : '';
          if (trig && said) {
            const every = fmt((sp[`effectAmplitude${n}`] || 1000) / 1000);
            const chance = sp.procChance > 0 && sp.procChance < 100 ? `${sp.procChance}% chance ` : '';
            const lead = aura === 23 ? `Every ${every} sec it casts` : aura === 42 ? `${chance}${procWhen(sp.procFlags)}`.replace(/^./, (c) => c.toUpperCase()) + ', it casts' : 'It also casts';
            more.push(`${lead} ${trig.name}: ${said}`);
          } else {
            const p = generate.phrase(sp, n, level);
            if (p) more.push(generate.sentence([p]));
          }
        }
        if (more.length) text = `${text} ${more.join(' ')}`;
      }
      // How far an aura stacks, where the client's text cannot say it: when the server patch changed it (Firemaw's
      // Flame Buffet, up to 99) or when the text is Grimoire's own (Mortal Wound).
      const aura = effects.some((n) => [6, 27, 35].includes(sp[`effect${n}`]) && sp[`effectApplyAuraName${n}`]);
      if (text && sp.stackAmount > 1 && aura && (sp.__stack || (!own && text === gen)) && !/\bstack|\bapplied up to|\bup to \d+ times/i.test(text)) text = `${text} Stacks up to ${sp.stackAmount} times.`;
      // Nothing to say: left out (a passive aura behind a buff listed already, an effect aimed at nobody we can name),
      // unless it is a mechanic the script throws at the players (see scripted above).
      if (!text && (a.via === 'aura' || !scripted)) continue;
      const key = sp.name.replace(/ (I|II|III|IV|V|VI)$/, '');
      const was = kept.get(key);
      // One entry per name: the spell with its own description wins, then the highest rank. A timed cast gives the
      // "when" text to whichever stays.
      const better = (x, y) => (x.own !== y.own ? x.own : x.lv !== y.lv ? x.lv > y.lv : !!x.t && !y.t);
      const on = Array.isArray(allies) ? allies.filter((id) => id !== npc) : [];
      const mine = { id: sp.entry, n: sp.name, s: fixes.schools.get(sp.entry) ?? schoolOf(sp), d: text, t: fixes.when.get(sp.entry) ?? a.t, on: on.length ? on : undefined, lv: sp.spellLevel, via: a.via, own: Boolean(own) };
      // Variants of one spell for each school (Chromaggus's Elemental Shield makes him weak to one school at a time):
      // one entry that names the schools.
      const tpl = (x) => x.replace(/\b(Holy|Fire|Nature|Frost|Shadow|Arcane)\b/g, '{S}');
      const school = (x) => /\b(Holy|Fire|Nature|Frost|Shadow|Arcane)\b/.exec(x)?.[1];
      if (was && text && was.d && text !== was.d && tpl(text) === tpl(was.d) && school(text) && school(was.d)) {
        was.schools = [...new Set([...(was.schools ?? [school(was.d)]), school(text)])];
        continue;
      }
      if (was && !better(mine, was)) {
        if (!was.t && a.t) was.t = a.t;
        continue;
      }
      if (was && !mine.t) mine.t = was.t;
      kept.set(key, mine);
    }
    const list = [...kept.values()];
    for (const a of list) {
      if (a.schools?.length > 1) {
        const names = a.schools.slice(0, -1).join(', ') + ' or ' + a.schools[a.schools.length - 1];
        a.d = a.d.replace(/\b(?:Holy|Fire|Nature|Frost|Shadow|Arcane)\b([^.]*)\./, (m, rest) => `${names}${rest}, one school at a time.`);
      }
      report.bySource[a.via] = (report.bySource[a.via] ?? 0) + 1;
    }
    return {
      abilities: list.map(({ id, n, s, d, t, on }) => ({ id, n, s, ...(d ? { d } : {}), ...(t ? { t } : {}), ...(on ? { on } : {}) })),
      behaviours,
    };
  }

  /* Loot */
  const itemInfo = (id) => itemTemplates.get(id);
  // How widely an item drops: creatures (all maps) whose own table gives it. World drops reach hundreds.
  const droppers = new Map(); // item -> Set(npc)
  const npcMaps = new Map(); // npc -> Set(map)
  for (const [npc, rows] of spawnsByNpc) npcMaps.set(npc, new Set(rows.map((r) => r.map)));
  const lootOfTable = (table, entry) => (entry ? loot.resolve(table, entry) : new Map());
  for (const c of creatures.values()) {
    if (!c.loot_id || !spawnsByNpc.has(c.entry)) continue;
    for (const item of lootOfTable('creature_loot_template', c.loot_id).keys()) {
      if (!droppers.has(item)) droppers.set(item, new Set());
      droppers.get(item).add(c.entry);
    }
  }
  const mapsOfItem = (item) => {
    const s = new Set();
    for (const npc of droppers.get(item) ?? []) for (const m of npcMaps.get(npc) ?? []) s.add(m);
    return s;
  };
  /** An item many creatures across the world drop: a world drop, not the boss's own. */
  const worldDrop = (item) => (droppers.get(item)?.size ?? 0) > 40 && mapsOfItem(item).size > 3;

  const eventLoot = new Set(); // "table:entry:item" of rows only a world event gives
  for (const table of ['creature_loot_template', 'gameobject_loot_template']) {
    for (const r of db.prepare(`SELECT entry, item, condition_id FROM ${table} WHERE condition_id > 0`).all()) if (eventOnly(r.condition_id)) eventLoot.add(`${table}:${r.entry}:${r.item}`);
  }
  const lootRow = (item, v) => {
    const it = itemInfo(item);
    if (!it || !it.name || JUNK.test(it.name)) return null;
    const pct = round(v.pct * 100, v.pct < 0.0001 ? 4 : 2);
    if (pct <= 0) return null;
    const recipe = it.class === 9;
    const quest = v.quest || it.class === 12;
    const starts = it.start_quest > 0;
    if (it.quality < 2 && !quest && !recipe && !starts) return null;
    // A world drop counts as the boss's own only when the boss gives it often (Razorclaw's Oak Mallet, 33%).
    if (worldDrop(item) && !quest && v.pct < 0.05) return null;
    return [item, pct, (quest ? 1 : 0) | (recipe ? 2 : 0) | (starts ? 4 : 0)];
  };
  // A boss's own drops (1% and up) first, best quality first; then the rare extras it shares with the dungeon's
  // trash; quest items last.
  const sortLoot = (rows) =>
    rows.sort((a, b) => {
      const qa = itemInfo(a[0]).quality;
      const qb = itemInfo(b[0]).quality;
      return (a[2] & 1) - (b[2] & 1) || (b[1] >= 1) - (a[1] >= 1) || qb - qa || b[1] - a[1] || a[0] - b[0];
    });
  const npcLoot = (npc) => {
    const c = creatures.get(npc);
    const rows = [];
    for (const [item, v] of lootOfTable('creature_loot_template', c?.loot_id)) {
      if (eventLoot.has(`creature_loot_template:${c.loot_id}:${item}`)) continue;
      const r = lootRow(item, v);
      if (r) rows.push(r);
    }
    return rows;
  };
  const chestLoot = (object) => {
    const o = objectTemplates.get(object);
    const rows = [];
    if (!o || o.type !== 3) return rows;
    for (const [item, v] of lootOfTable('gameobject_loot_template', o.data1)) {
      if (eventLoot.has(`gameobject_loot_template:${o.data1}:${item}`)) continue;
      const r = lootRow(item, v);
      if (r) rows.push(r);
    }
    return rows;
  };

  /* Each dungeon */
  const out = {};
  const names = new Map(); // every creature the encounters name, for pages that have no record of it
  const bossNpcs = new Set();
  for (const [slug, def] of Object.entries(staticEncounters)) {
    if (slug === '_') continue;
    for (const w of def.wings) for (const b of w.bosses) for (const id of b.npc) bossNpcs.add(id);
  }
  for (const [slug, def] of Object.entries(staticEncounters)) {
    if (slug === '_') continue;
    const map = def.map;
    const listed = dungeons.find((d) => d.slug === slug);
    if (!listed && !slug.startsWith('zone-')) problems.push(`${slug}: not in dungeons.json`);
    const wings = [];
    const keys = new Set();
    for (const w of def.wings) {
      const bosses = [];
      for (const b of w.bosses) {
        const npcs = [];
        for (const id of b.npc) {
          const c = creatures.get(id);
          if (!c) {
            problems.push(`${slug}: ${b.n}: creature ${id} is not in VMaNGOS`);
            continue;
          }
          const where = howHere(id, map);
          npcs.push({ id, n: c.name, lv: [c.level_min, c.level_max], r: c.rank, ty: c.type, how: where.how, ...(where.event ? { ev: where.event } : {}) });
        }
        if (!npcs.length) continue;
        // The name shown must be the creature's own, unless the entry names a group.
        if (b.npc.length === 1 && npcs[0].n !== b.n) problems.push(`${slug}: "${b.n}" is ${npcs[0].n} in VMaNGOS (${b.npc[0]})`);
        const flags = [...(b.f ?? [])];
        if (npcs.every((n) => n.how === 'event')) flags.push('event');
        // "summon" (players call it up with something in the instance) already says it is summoned
        else if (!flags.includes('summon') && npcs.slice(0, b.f?.includes('oneOf') ? npcs.length : 1).every((n) => n.how === 'summoned')) flags.push('summoned');
        if (flags.includes('summoned')) report.summoned.push(`${slug}: ${b.n}`);
        // Abilities: each creature's at its own level; one entry per spell across the encounter.
        const abilities = [];
        const seen = new Set();
        const behaviours = [];
        for (const n of npcs) {
          const got = abilitiesOf(n.id, n.lv[1]);
          for (const a of got.abilities) {
            if (seen.has(a.id)) continue;
            seen.add(a.id);
            abilities.push(npcs.length > 1 ? { ...a, by: n.id } : a);
          }
          for (const x of got.behaviours) behaviours.push({ ...x, by: n.id });
        }
        // Loot: every creature of the encounter, or its chest.
        let rows = [];
        const byItem = new Map();
        const addRows = (list, from) => {
          for (const r of list) {
            const was = byItem.get(r[0]);
            if (!was || was.row[1] < r[1]) byItem.set(r[0], { row: r, from });
          }
        };
        for (const n of npcs) addRows(npcLoot(n.id), n.id);
        if (b.chest) addRows(chestLoot(b.chest), -b.chest);
        rows = sortLoot([...byItem.values()].map((x) => (npcs.length > 1 || b.chest ? [...x.row, x.from] : x.row)));
        // Adds the players fight: hostile to both factions and selectable, not a trigger, a helper that carries a
        // spell (Sapphiron's Blizzard, Heigan's Plague Wave) or someone who comes to talk (Morridune).
        const hostile = (id) => {
          const c = creatures.get(id);
          if (!c || /\b(trigger|dummy|bunny|invisible)\b|\(DND\)/i.test(c.name)) return false;
          if ((c.static_flags1 & (0x200 | 0x20)) || (c.flags_extra & 0x80) || c.display_id1 === 11686) return false;
          return (world.reaction ? world.reaction(c.faction) : (world.npcs[id]?.[5] ?? '')) === 'hh';
        };
        const uniqSummons = [];
        for (const x of behaviours) {
          if (x.kind !== 'summon' || bossNpcs.has(x.npc) || !hostile(x.npc)) continue;
          const was = uniqSummons.find((u) => u.npc === x.npc && u.t === x.t);
          if (was) was.c = (was.c ?? 1) + 1;
          else uniqSummons.push({ npc: x.npc, n: creatureName(x.npc), ...(x.t ? { t: x.t } : {}), ...(npcs.length > 1 ? { by: x.by } : {}) });
        }
        const flees = npcs.length === 1 ? behaviours.filter((x) => x.kind === 'flee' && x.t) : [];
        report.bosses++;
        report.abilities += abilities.length;
        if (abilities.length) report.withAbilities++;
        else report.noAbilities.push(`${slug}: ${b.n}`);
        // The boss's anchor on the site: its name in lower case, unique within the dungeon.
        let key = b.n.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        while (keys.has(key)) key += '-2';
        keys.add(key);
        for (const n of npcs) names.set(n.id, n.n);
        for (const x of uniqSummons) names.set(x.npc, x.n);
        for (const a of abilities) for (const id of a.on ?? []) names.set(id, creatureName(id));
        bosses.push({
          key,
          n: b.n,
          npcs,
          ...(flags.length ? { f: flags } : {}),
          ...(b.note ? { note: b.note } : {}),
          ...(b.chest ? { chest: { id: b.chest, n: objectTemplates.get(b.chest)?.name } } : {}),
          abilities,
          ...(uniqSummons.length ? { summons: uniqSummons } : {}),
          ...(flees.length ? { flees: flees[0].t } : {}),
          loot: rows,
        });
      }
      wings.push({ ...(w.name ? { name: w.name } : {}), bosses });
    }

    /* Notable drops from the dungeon's regular mobs */
    const trashNpcs = [...spawnsByNpc.entries()].filter(([npc, rows]) => !bossNpcs.has(npc) && rows.some((r) => r.map === map && !(r.spawn_flags & 2)) && creatures.get(npc)?.loot_id).map(([npc]) => npc);
    const best = new Map(); // item -> { pct, by: [[npc, pct]] }
    for (const npc of trashNpcs) {
      const c = creatures.get(npc);
      if (!c || JUNK.test(c.name)) continue;
      for (const [item, v] of lootOfTable('creature_loot_template', c.loot_id)) {
        const it = itemInfo(item);
        if (!it || it.quality < 2 || v.quest || it.class === 12 || JUNK.test(it.name) || eventLoot.has(`creature_loot_template:${c.loot_id}:${item}`)) continue;
        // The dungeon's own: three quarters of the creatures that drop it anywhere stand in this dungeon.
        const all = droppers.get(item);
        if (!all) continue;
        const here = [...all].filter((n) => npcMaps.get(n)?.has(map)).length;
        if (here / all.size < 0.75) continue;
        const pct = round(v.pct * 100, v.pct < 0.0001 ? 4 : 2);
        if (pct <= 0) continue;
        if (!best.has(item)) best.set(item, { pct: 0, by: [] });
        const e = best.get(item);
        e.by.push([npc, pct]);
        if (pct > e.pct) e.pct = pct;
      }
    }
    const trash = [...best.entries()]
      .map(([item, e]) => ({ i: item, q: itemInfo(item).quality, p: e.pct, by: e.by.sort((a, b) => b[1] - a[1] || a[0] - b[0]) }))
      .sort((a, b) => b.q - a.q || b.p - a.p || a.i - b.i)
      .slice(0, 25)
      .map(({ i, p, by }) => ({ i, p, by: by.slice(0, 4), ...(by.length > 4 ? { more: by.length - 4 } : {}) }));
    for (const t of trash) for (const [npc] of t.by) names.set(npc, creatures.get(npc)?.name);
    report.trash += trash.length;

    const all = wings.flatMap((w) => w.bosses);
    out[slug] = {
      map,
      // the bosses of a normal run: not rare spawns, world-event bosses, quest summons or what players call up
      bosses: all.filter(counted).length,
      rares: all.filter((b) => b.f?.includes('rare')).length,
      // each wing is a run of its own (Scarlet Monastery, Dire Maul, Lower and Upper Blackrock Spire)
      ...(def.runs ? { runs: true } : {}),
      wings,
      trash,
    };
  }
  return { encounters: out, names: Object.fromEntries([...names].sort((a, b) => a[0] - b[0])), problems, report, tables };
}
