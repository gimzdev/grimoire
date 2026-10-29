#!/usr/bin/env node
// Reads the C++ creature scripts of the VMaNGOS core (GPL-2.0-or-later, https://github.com/vmangos/core) and writes
// static/boss-scripts.json: for every creature script, the spells its AI casts itself. The data build uses it for the
// bosses whose fight lives in C++ rather than in the database, so it needs no checkout of the core.
//
//   node scripts/data/boss-scripts.mjs --core path/to/vmangos-core
//
// A spell counts when the AI casts it on its own creature's behalf: DoCastSpellIfCan, DoCast, DoCastAOE, and
// m_creature->CastSpell / AddAura / CastCustomSpell. Spells it only looks for (SpellHit, HasAura, RemoveAura) and spells
// other units cast do not. Names resolve through the enums and constants of the file and the headers it includes.
//
// Creatures the AI summons the same way (m_creature->SummonCreature, DoSpawnCreature) are listed too, and the spells
// it casts only in JustDied (onDeath).
//
// Every script with an AI is listed, spells or not: a C++ AI takes over its creature, so the creature's EventAI rows
// never run. `lists` says whether the creature's spell list (creature_spells) still does: it does when the AI keeps
// the update of BasicAI, which ScriptedAI derives from, or calls it or UpdateSpellsList itself.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const core = argv[argv.indexOf('--core') + 1];
if (!core || argv.indexOf('--core') < 0 || !existsSync(path.join(core, 'src', 'scripts'))) throw new Error('Pass --core with a checkout of https://github.com/vmangos/core.');
const OUT = path.join(here, 'static', 'boss-scripts.json');
const SCRIPTS = path.join(core, 'src', 'scripts');

const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(cpp|h)$/.test(f)) files.push(p);
  }
};
walk(SCRIPTS);

/** Comments out: line comments and block comments, keeping line breaks. */
const uncomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '');

// The core builds for one client at a time; Grimoire wants the 1.12.1 branch of every `#if SUPPORTED_CLIENT_BUILD`.
const BUILD = [1, 12, 1];
const cmpVersion = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
function condition(line) {
  const m = /^#\s*if\s+SUPPORTED_CLIENT_BUILD\s*(>=|<=|>|<|==|!=)\s*CLIENT_BUILD_(\d+)_(\d+)_(\d+)\s*$/.exec(line.trim());
  if (m) {
    const c = cmpVersion(BUILD, [Number(m[2]), Number(m[3]), Number(m[4])]);
    return { '>=': c >= 0, '<=': c <= 0, '>': c > 0, '<': c < 0, '==': c === 0, '!=': c !== 0 }[m[1]];
  }
  if (/^#\s*ifndef\b/.test(line.trim())) return true;
  if (/^#\s*if\s+1\s*$/.test(line.trim())) return true;
  return false; // #ifdef DEBUG_ON and the like: not defined in a release build
}
/** Keeps the lines a 1.12.1 release build compiles. */
function preprocess(src) {
  const out = [];
  const stack = []; // { taking, taken }
  const active = () => stack.every((f) => f.taking);
  for (const line of src.split('\n')) {
    const t = line.trim();
    if (/^#\s*if/.test(t)) {
      const on = condition(t);
      stack.push({ taking: on, taken: on });
      out.push('');
    } else if (/^#\s*elif\b/.test(t)) {
      const top = stack[stack.length - 1];
      if (top) {
        const on = !top.taken && condition(t.replace(/^#\s*elif/, '#if'));
        top.taking = on;
        top.taken = top.taken || on;
      }
      out.push('');
    } else if (/^#\s*else\b/.test(t)) {
      const top = stack[stack.length - 1];
      if (top) {
        top.taking = !top.taken;
        top.taken = true;
      }
      out.push('');
    } else if (/^#\s*endif\b/.test(t)) {
      stack.pop();
      out.push('');
    } else out.push(active() ? line : '');
  }
  return out.join('\n');
}
const strip = (src) => preprocess(uncomment(src));

const text = new Map(files.map((f) => [f, strip(readFileSync(f, 'utf8'))]));

/**
 * Spell constants of a source, NAME -> number: members of an enum whose name says spells (eSpells) and any constant
 * named SPELL_... or Spell..., from enums, const/constexpr values and #defines. Other numbers (texts, NPCs, timers) stay out.
 */
const spellName = (name) => /^(SPELL_|Spell[A-Z_])/.test(name) && !/^SPELL_(CAST_OK|FAILED_|SCHOOL_|AURA_|EFFECT_|ATTR)/.test(name);
const npcName = (name) => /^(NPC_|MOB_|ENTRY_)/.test(name);
/** Creature constants of a source, NAME -> number, named NPC_..., MOB_... or ENTRY_... */
function constantsOf(src, pick = spellName, enumWord = /spell/i) {
  const out = new Map();
  for (const m of src.matchAll(/enum\b\s*(?:class\s+)?([A-Za-z_]\w*)?[^{;]*\{([^}]*)\}/g)) {
    const named = enumWord.test(m[1] ?? '');
    for (const part of m[2].split(',')) {
      const k = /^\s*([A-Za-z_]\w*)\s*=\s*(-?\d+)\s*$/.exec(part.trim() ? part : '');
      if (k && (named || pick(k[1]))) out.set(k[1], Number(k[2]));
    }
  }
  for (const m of src.matchAll(/(?:const|constexpr)\s+(?:static\s+)?(?:u?int(?:32|16|8)?(?:_t)?|uint32)\s+([A-Za-z_]\w*)\s*=\s*(\d+)\s*;/g)) if (pick(m[1])) out.set(m[1], Number(m[2]));
  for (const m of src.matchAll(/#define\s+([A-Za-z_]\w*)\s+(\d+)\b/g)) if (pick(m[1])) out.set(m[1], Number(m[2]));
  return out;
}

/** The constants a file can see: its own and those of the headers it includes (searched next to it, then anywhere). */
const byBase = new Map();
for (const f of files) {
  const b = path.basename(f);
  if (!byBase.has(b)) byBase.set(b, []);
  byBase.get(b).push(f);
}
function visibleConstants(file, pick = spellName, enumWord = /spell/i, seen = new Set()) {
  if (seen.has(file)) return new Map();
  seen.add(file);
  const src = text.get(file);
  const out = new Map();
  for (const m of src.matchAll(/#include\s+"([^"]+)"/g)) {
    const near = path.join(path.dirname(file), m[1]);
    const hit = existsSync(near) ? near : byBase.get(path.basename(m[1]))?.[0];
    if (hit && text.has(hit)) for (const [k, v] of visibleConstants(hit, pick, enumWord, seen)) out.set(k, v);
  }
  for (const [k, v] of constantsOf(src, pick, enumWord)) out.set(k, v);
  return out;
}

/** The body of `struct Name ... { ... };` in src, braces matched, or null. Also returns the base class names. */
function structBody(src, name) {
  const re = new RegExp(`(?:struct|class)\\s+${name}\\b\\s*(?::([^{]*))?\\{`, 'g');
  const m = re.exec(src);
  if (!m) return null;
  let depth = 0;
  let i = m.index + m[0].length - 1;
  const start = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  const bases = (m[1] ?? '').split(',').map((b) => b.replace(/\b(public|private|protected|virtual)\b/g, '').trim()).filter(Boolean);
  return { body: src.slice(start, i + 1), bases };
}

/** Out-of-line member functions: `void Name::Fn(...) { ... }` for a struct defined elsewhere in the same file. */
function memberBodies(src, name) {
  const out = [];
  const re = new RegExp(`\\b${name}::(~?[A-Za-z_]\\w*)\\s*\\([^)]*\\)[^{;]*\\{`, 'g');
  let m;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    const start = i;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) break;
    }
    out.push({ name: m[1], body: src.slice(start, i + 1) });
  }
  return out;
}

/**
 * The member functions written inside a struct body ({ ... }): name, header and body of each. Enums, nested structs
 * and data initializers have no parameter list and are skipped.
 */
function methodsOf(body) {
  const out = [];
  let depth = 0;
  let headerStart = 1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{' && depth === 1) {
      let d = 0;
      let j = i;
      for (; j < body.length; j++) {
        if (body[j] === '{') d++;
        else if (body[j] === '}' && --d === 0) break;
      }
      const header = body.slice(headerStart, i).trim();
      const m = /(~?[A-Za-z_]\w*)\s*\(([\s\S]*)\)\s*(?:const\s*)?(?:override\s*)?(?:final\s*)?(?::[\s\S]*)?$/.exec(header);
      if (m && !/=\s*$/.test(header)) out.push({ name: m[1], header, body: body.slice(i, j + 1) });
      i = j;
      headerStart = j + 1;
    } else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === ';' && depth === 1) headerStart = i + 1;
  }
  return out;
}

// What the server calls on an AI by itself: the virtual hooks of the core's AI classes. A member function counts when
// it is one of them or one of them calls it, directly or through other members; code nothing calls (Loatheb's
// leftover eye stalk routine) does not.
const HOOKS = new Set();
for (const f of ['CreatureAI.h', 'ScriptedAI.h', 'BasicAI.h', 'ScriptedEscortAI.h', 'ScriptedFollowerAI.h']) {
  const p = path.join(core, 'src', 'game', 'AI', f);
  if (existsSync(p)) for (const m of readFileSync(p, 'utf8').matchAll(/virtual\s+[A-Za-z_:<>*&\s]+?\b([A-Za-z_]\w*)\s*\(/g)) HOOKS.add(m[1]);
}
if (!HOOKS.has('UpdateAI')) throw new Error('No AI hooks found in the core headers.');

const CAST = /(?:^|[^\w>.])(DoCastSpellIfCan|DoCastAOE|DoCast|DoCastSpell)\s*\(|m_creature\s*->\s*(CastSpell|AddAura|CastCustomSpell)\s*\(/g;

/** The arguments of the call whose "(" is at open, split at its top-level commas; null when it does not close. */
function argsAt(text, open) {
  const out = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (--depth === 0) {
        out.push(text.slice(start, i).trim());
        return out;
      }
    } else if (ch === ',' && depth === 1) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  return null;
}

const WORDS = /\b(?:[A-Za-z_]\w*::)?([A-Za-z_]\w*)\b/g;
const NOT_SPELL = /^(m_creature|me|true|false|nullptr|NULL|this|CF_\w+|TRIGGERED_\w+|GetVictim|GetGUID|GetObjectGuid|SelectAttackingTarget|ATTACKING_TARGET_\w+|SELECT_FLAG_\w+|static_cast|uint32|int32|float|bool)$/;

/**
 * Spell ids an AI body casts as its own creature. A cast names its spell with a SPELL_ constant or a number, or with a
 * variable set from them elsewhere in the AI: `uint32 Reflect = rand() % 2 ? SPELL_MAGIC_REFLECTION :
 * SPELL_DAMAGE_SHIELD`, a member filled from an array of spells (Chromaggus's breaths), a spell entry looked up by
 * constant (Patchwerk's Hateful Strike), or a constructor argument a derived AI passes (each Horseman's mark).
 */
function castsIn(body, consts, resolve, named) {
  const ids = new Set();
  const unresolved = new Set();
  for (const m of body.matchAll(CAST)) {
    const open = m.index + m[0].length - 1;
    const args = argsAt(body, open);
    if (!args) continue;
    const fn = m[1] ?? m[2];
    // where the spell goes: first for DoCastAOE and AddAura, second for the rest (fourth in CastSpell(x, y, z, ...))
    const spots = fn === 'DoCastAOE' || fn === 'AddAura' ? [0] : fn === 'CastSpell' && args.length >= 5 ? [1, 3] : [1];
    for (const k of spots) {
      const arg = args[k];
      if (!arg) continue;
      let found = false;
      for (const w of arg.matchAll(WORDS)) {
        // a spell constant, or any named number of the file passed as the spell (AURA_IMMOLATE, SPELL_ATTRACK_RAGER)
        const id = consts.get(w[1]) ?? named.get(w[1]);
        if (id !== undefined) {
          ids.add(id);
          found = true;
        } else if (spellName(w[1]) && /^SPELL_/.test(w[1])) {
          unresolved.add(w[1]);
          found = true;
        }
      }
      if (/^\d{2,6}$/.test(arg)) {
        ids.add(Number(arg));
        found = true;
      }
      if (found) continue;
      let hit = false;
      for (const w of arg.matchAll(WORDS)) {
        if (NOT_SPELL.test(w[1]) || /^\d/.test(w[1])) continue;
        for (const id of resolve(w[1])) {
          ids.add(id);
          hit = true;
        }
      }
      // a spell named some other way (a field of a data table, a value worked out at run time): listed, for a person
      // to look at and, if it matters, to add in static/encounters.json
      if (!hit && /^[A-Za-z_]/.test(arg)) unresolved.add(arg.replace(/\s+/g, ' '));
    }
  }
  return { ids, unresolved };
}

/**
 * Finds the spells a variable can hold: the SPELL_ constants on the right of its assignments and member initializers
 * in the AI (own is the text of the AI and its script bases), through arrays of spells (in the whole file) and one
 * more variable, and through a constructor parameter bound by a derived AI's initializer list.
 */
function makeResolver(own, file, consts) {
  const memo = new Map();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const constsIn = (text) => [...text.matchAll(WORDS)].filter((w) => consts.has(w[1])).map((w) => consts.get(w[1]));
  // the spells in an array or vector of them: `name[4] = { ... }`, `name = { ... }`, `name{ ... }`, or a vector made
  // from another array (`champs(ChampionSpells, ChampionSpells + n)`)
  const arrayOf = (name, depth = 0) => {
    const out = [];
    for (const m of file.matchAll(new RegExp(`\\b${esc(name)}\\s*(?:\\[[^\\]]*\\])*\\s*=?\\s*\\{([^}]*)\\}`, 'g'))) {
      out.push(...constsIn(m[1]));
      // a list of plain spell ids (Viscidus's glob summons)
      const items = m[1].split(',').map((x) => x.trim()).filter(Boolean);
      if (items.length && items.every((x) => /^\d{3,6}$/.test(x))) out.push(...items.map(Number));
    }
    if (depth < 1) for (const m of file.matchAll(new RegExp(`\\b${esc(name)}\\s*\\(\\s*([A-Za-z_]\\w*)\\s*,`, 'g'))) out.push(...arrayOf(m[1], depth + 1));
    return out;
  };
  const resolve = (name, depth = 0) => {
    if (memo.has(name)) return memo.get(name);
    memo.set(name, []);
    const out = new Set(arrayOf(name));
    const rhs = [];
    for (const m of own.matchAll(new RegExp(`\\b${esc(name)}\\s*=(?!=)\\s*([^;]+);`, 'g'))) rhs.push(m[1]);
    for (const m of own.matchAll(new RegExp(`[:,]\\s*${esc(name)}\\s*\\(([^()]*(?:\\([^()]*\\)[^()]*)*)\\)`, 'g'))) rhs.push(m[1]);
    for (const r of rhs) {
      const direct = constsIn(r);
      for (const id of direct) out.add(id);
      for (const a of r.matchAll(/\b([A-Za-z_]\w*)\s*\[/g)) for (const id of arrayOf(a[1])) out.add(id);
      if (!direct.length && depth < 2) for (const w of r.matchAll(WORDS)) if (w[1] !== name && !NOT_SPELL.test(w[1])) for (const id of resolve(w[1], depth + 1)) out.add(id);
    }
    // A constructor parameter: what the derived AI passes for it.
    for (const c of own.matchAll(new RegExp(`\\b([A-Za-z_]\\w*)\\s*\\(([^()]*\\b${esc(name)}\\b[^()]*)\\)\\s*:`, 'g'))) {
      const index = c[2].split(',').findIndex((p) => new RegExp(`\\b${esc(name)}\\s*$`).test(p.trim()));
      if (index < 0) continue;
      for (const call of own.matchAll(new RegExp(`[:,]\\s*${esc(c[1])}\\s*\\(`, 'g'))) {
        const args = argsAt(own, call.index + call[0].length - 1);
        if (args?.[index]) for (const id of constsIn(args[index])) out.add(id);
      }
    }
    const list = [...out];
    memo.set(name, list);
    return list;
  };
  return (name) => resolve(name);
}

/** Creatures an AI body summons as its own creature: m_creature->SummonCreature(...) and DoSpawnCreature(...). */
const SUMMON = /(?:\b(?:m_creature|me)\s*->\s*SummonCreature|(?:^|[^\w>.])DoSpawnCreature)\s*\(\s*([A-Za-z_]\w*|\d+)\b/g;
function summonsIn(body, npcs) {
  const ids = new Set();
  for (const m of body.matchAll(SUMMON)) {
    const id = /^\d+$/.test(m[1]) ? Number(m[1]) : npcs.get(m[1]);
    if (id > 0) ids.add(id);
  }
  return ids;
}

const scripts = {};
for (const [file, src] of text) {
  if (!file.endsWith('.cpp')) continue;
  const consts = visibleConstants(file);
  const npcConsts = visibleConstants(file, npcName, /^$/);
  const named = visibleConstants(file, () => true, /^$/);
  for (const m of src.matchAll(/->\s*Name\s*=\s*"([^"]+)"\s*;([\s\S]{0,400}?)RegisterSelf/g)) {
    const name = m[1];
    const fn = /->\s*GetAI\s*=\s*&?\s*([A-Za-z_]\w*)/.exec(m[2])?.[1];
    if (!fn) continue;
    const getAi = new RegExp(`CreatureAI\\s*\\*\\s*${fn}\\s*\\([^)]*\\)\\s*\\{([^}]*)\\}`).exec(src);
    const struct = getAi && /new\s+([A-Za-z_]\w*)\s*\(/.exec(getAi[1])?.[1];
    if (!struct) continue;
    const ids = new Set();
    const unresolved = new Set();
    const summons = new Set();
    const seen = new Set();
    const methods = []; // { struct, name, header, body } across the AI and the script bases it derives from
    const texts = []; // the struct bodies and out-of-line members of the AI and its bases, for the variables
    const collect = (structName, depth) => {
      if (depth > 3 || seen.has(structName)) return;
      seen.add(structName);
      // The struct may live in this file or in another file of the same folder (a shared base AI).
      const here = structBody(src, structName);
      const where = here ? src : [...text].find(([f, s]) => path.dirname(f) === path.dirname(file) && structBody(s, structName))?.[1];
      const found = here ?? (where ? structBody(where, structName) : null);
      if (!found) return;
      texts.push(found.body);
      for (const x of methodsOf(found.body)) methods.push({ struct: structName, ...x });
      for (const x of memberBodies(where ?? src, structName)) {
        methods.push({ struct: structName, header: '', ...x });
        texts.push(x.body);
      }
      for (const base of found.bases) if (!/^(ScriptedAI|CreatureAI|BossAI|ScriptedPetAI|npc_escortAI|CombatAI|ScriptedInstance|FollowerAI|CreatureEventAI|GuardAI|NullCreatureAI)$/.test(base)) collect(base, depth + 1);
    };
    collect(struct, 0);
    // The members that run: the hooks and constructors, those other code of the file calls on the AI (an instance
    // or a trigger starting the fight), then whatever these call.
    const outside = (name) => new RegExp(`(?:->|\\.)\\s*${name}\\s*\\(`).test(src);
    const live = new Set(methods.filter((x) => HOOKS.has(x.name) || seen.has(x.name.replace(/^~/, '')) || /\boverride\b/.test(x.header) || outside(x.name)).map((x) => x.name));
    for (let grew = true; grew; ) {
      grew = false;
      for (const x of methods) {
        if (!live.has(x.name)) continue;
        for (const y of methods) if (!live.has(y.name) && new RegExp(`\\b${y.name}\\s*\\(`).test(x.body)) {
          live.add(y.name);
          grew = true;
        }
      }
    }
    let overrides = false; // the AI has its own UpdateAI (or UpdateEscortAI, for an escort)
    let keepsBase = false; // ... that still calls the base update or UpdateSpellsList
    const resolve = makeResolver(texts.join('\n'), src, consts);
    const castFrom = new Map(); // spell -> the members that cast it
    for (const x of methods) {
      if (!live.has(x.name)) continue;
      const r = castsIn(x.body, consts, resolve, named);
      for (const id of r.ids) {
        ids.add(id);
        if (!castFrom.has(id)) castFrom.set(id, new Set());
        castFrom.get(id).add(x.name);
      }
      for (const u of r.unresolved) unresolved.add(u);
      for (const id of summonsIn(x.body, npcConsts)) summons.add(id);
      if (/^Update(Escort)?AI$/.test(x.name)) overrides = true;
      if (/\b(ScriptedAI|BasicAI|npc_escortAI|FollowerAI)::Update(Escort|Follower)?AI\s*\(|\bUpdateSpellsList\s*\(/.test(x.body)) keepsBase = true;
    }
    // spells cast only as the creature dies (Razuvious's Hopeless)
    const onDeath = [...castFrom].filter(([, from]) => [...from].every((f) => f === 'JustDied')).map(([id]) => id);
    scripts[name] = {
      file: path.relative(core, file).split(path.sep).join('/'),
      ai: struct,
      spells: [...ids].sort((a, b) => a - b),
      ...(onDeath.length ? { onDeath: onDeath.sort((a, b) => a - b) } : {}),
      ...(summons.size ? { summons: [...summons].sort((a, b) => a - b) } : {}),
      lists: !overrides || keepsBase,
      ...(unresolved.size ? { unresolved: [...unresolved].sort() } : {}),
    };
  }
}

let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', core, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  // not a git checkout
}
const out = {
  _: 'For each VMaNGOS C++ creature script with an AI, by script name: the spells it casts and the creatures it summons as its own creature, and whether the creature spell list still runs under it. Extracted by scripts/data/boss-scripts.mjs from the VMaNGOS core (GPL-2.0-or-later, https://github.com/vmangos/core); facts only, no code.',
  core: commit,
  scripts: Object.fromEntries(Object.entries(scripts).sort(([a], [b]) => a.localeCompare(b))),
};
writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
const all = Object.values(scripts);
console.log(`static/boss-scripts.json: ${all.length} creature scripts with an AI (${all.filter((x) => x.spells.length).length} cast spells, ${all.filter((x) => x.summons).length} summon creatures, ${all.filter((x) => x.lists).length} keep the spell list), core ${commit.slice(0, 10)}.`);
const bad = Object.entries(scripts).filter(([, s]) => s.unresolved);
if (bad.length) console.log(`Spells not resolved to an id in ${bad.length} scripts (left out; see "unresolved"): ${bad.slice(0, 12).map(([n, s]) => `${n} (${s.unresolved.join(', ')})`).join('; ')}${bad.length > 12 ? ' ...' : ''}`);
