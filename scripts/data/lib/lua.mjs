// Reads the data tables LibQuestDB ships as Lua source (MIT, https://www.curseforge.com/wow/addons/questdb).
// Each table is a list of `[id]="field\031field\031..."` rows; \031 separates fields and the strings use Lua's escapes.

import { readFileSync } from 'node:fs';

/** Decodes the body of a double-quoted Lua string (escapes \ddd, \n, \t, \", \\). */
export function luaString(body) {
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = body[++i];
    if (next >= '0' && next <= '9') {
      let digits = next;
      while (digits.length < 3 && body[i + 1] >= '0' && body[i + 1] <= '9') digits += body[++i];
      out += String.fromCharCode(Number(digits));
    } else if (next === 'n') out += '\n';
    else if (next === 't') out += '\t';
    else if (next === 'r') out += '\r';
    else out += next; // \" \\ \' and anything else stand for themselves
  }
  return out;
}

/** Every `[id]="..."` row of a LibQuestDB file, as a Map of id to its fields. */
export function readRows(file) {
  const text = readFileSync(file, 'utf8');
  const rows = new Map();
  const re = /^\[(-?\d+)\]="((?:[^"\\]|\\.)*)",?\s*$/gm;
  for (let m; (m = re.exec(text)); ) rows.set(Number(m[1]), luaString(m[2]).split('\x1f'));
  return rows;
}

/** A file that loads several tables (`lib:LoadAreas({...}) lib:LoadDungeons({...})`): Map of loader name to its rows. */
export function readSections(file) {
  const text = readFileSync(file, 'utf8');
  const out = new Map();
  const re = /^lib:(\w+)\(\{$/gm;
  const starts = [];
  for (let m; (m = re.exec(text)); ) starts.push({ name: m[1], at: m.index + m[0].length });
  starts.forEach((s, i) => {
    const body = text.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : text.length);
    const rows = new Map();
    const row = /^\[(-?\d+)\]="((?:[^"\\]|\\.)*)",?\s*$/gm;
    for (let m; (m = row.exec(body)); ) rows.set(Number(m[1]), luaString(m[2]).split('\x1f'));
    out.set(s.name, rows);
  });
  return out;
}

/** The comment lines at the top of a LibQuestDB file (they name its source and build). */
export function header(file) {
  const lines = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.startsWith('--')) break;
    lines.push(line.replace(/^--\s?/, '').trimEnd());
  }
  return lines;
}

/** The first zone of every spawn row: `[id]="areaId:x,y;...|areaId:..."` lists areas with the most points first. */
export function readSpawnZones(file) {
  const zones = new Map();
  for (const [id, [row]] of readRows(file)) {
    const first = Number.parseInt(String(row).split('|')[0], 10);
    if (Number.isFinite(first) && first > 0) zones.set(id, first);
  }
  return zones;
}

/* ── Lua table constructors (QuestieDB, GPLv3, https://github.com/Questie/QuestieDB) ── */

// QuestieDB keeps its data as Lua source: table constructors with numbers, strings, nil, booleans, nested tables, named
// constants (questKeys.name, raceIDs.NIGHT_ELF) and sums of them. A table reads as a Map of key to value, a list's entries
// under 1, 2, 3...; a nil leaves its slot empty.
const TOKEN = /\s+|--\[(=*)\[[\s\S]*?\]\1\]|--[^\n]*|\[(=*)\[([\s\S]*?)\]\2\]|"((?:[^"\\\n]|\\[\s\S])*)"|'((?:[^'\\\n]|\\[\s\S])*)'|0x[0-9a-fA-F]+|\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?|[A-Za-z_][A-Za-z_0-9]*|\.\.|==|~=|<=|>=|[{}[\]=,;+\-().#:*/<>]/y;

/**
 * Reads one Lua expression from `text` at `from` (a table constructor, mostly): { value, end }.
 * @param name resolves a dotted name (`questKeys.name`, `zoneIDs.ELWYNN_FOREST`) to its value; undefined when unknown.
 */
export function readLua(text, from, name = () => undefined) {
  let at = from;
  let tok = null;
  const next = () => {
    for (;;) {
      TOKEN.lastIndex = at;
      const m = TOKEN.exec(text);
      if (!m) {
        if (at >= text.length) return (tok = { t: 'eof' });
        throw new Error(`lua: cannot read ${JSON.stringify(text.slice(at, at + 30))}`);
      }
      at = TOKEN.lastIndex;
      const s = m[0];
      if (/^\s/.test(s) || s.startsWith('--')) continue;
      if (m[3] !== undefined) return (tok = { t: 'str', v: m[3].replace(/^\n/, '') });
      if (m[4] !== undefined) return (tok = { t: 'str', v: luaString(m[4]) });
      if (m[5] !== undefined) return (tok = { t: 'str', v: luaString(m[5]) });
      if (/^(0x|\d|\.\d)/.test(s)) return (tok = { t: 'num', v: Number(s) });
      if (/^[A-Za-z_]/.test(s)) return (tok = { t: 'name', v: s });
      return (tok = { t: s });
    }
  };
  const expect = (t) => {
    if (tok.t !== t) throw new Error(`lua: expected ${t}, found ${tok.t} ${tok.v ?? ''} at ${at}`);
    next();
  };
  function table() {
    expect('{');
    const t = new Map();
    let n = 0;
    while (tok.t !== '}') {
      if (tok.t === '[') {
        next();
        const k = expr();
        expect(']');
        expect('=');
        const v = expr();
        if (v !== undefined && v !== null && k !== undefined) t.set(k, v);
      } else if (tok.t === 'name' && /^\s*=(?!=)/.test(text.slice(at))) {
        const k = tok.v;
        next();
        expect('=');
        const v = expr();
        if (v !== undefined && v !== null) t.set(k, v);
      } else {
        const v = expr();
        n++;
        if (v !== undefined && v !== null) t.set(n, v);
      }
      if (tok.t === ',' || tok.t === ';') next();
      else if (tok.t !== '}') throw new Error(`lua: expected , or } at ${at}`);
    }
    next();
    return t;
  }
  function term() {
    switch (tok.t) {
      case '{':
        return table();
      case 'num': {
        const v = tok.v;
        next();
        return v;
      }
      case 'str': {
        let v = tok.v;
        next();
        while (tok.t === '..') {
          next();
          v += String(term() ?? '');
        }
        return v;
      }
      case '-': {
        next();
        const v = term();
        return v === undefined ? undefined : -v;
      }
      case '#':
        next();
        term();
        return undefined;
      case '(': {
        next();
        const v = expr();
        expect(')');
        return v;
      }
      case 'name': {
        const w = tok.v;
        next();
        if (w === 'nil') return null;
        if (w === 'true') return true;
        if (w === 'false') return false;
        if (w === 'not') {
          term();
          return undefined;
        }
        if (w === 'function') throw new Error(`lua: a function in the data at ${at}`);
        let path = w;
        while (tok.t === '.' || tok.t === ':') {
          next();
          path += `.${tok.v}`;
          next();
        }
        if (tok.t === '(') {
          // a call (l10n("..."), a client function): its value is not data
          next();
          while (tok.t !== ')') {
            expr();
            if (tok.t === ',') next();
          }
          next();
          return undefined;
        }
        return name(path);
      }
      default:
        throw new Error(`lua: unexpected ${tok.t} at ${at}`);
    }
  }
  // Sums and differences of constants are data (raceIDs.NIGHT_ELF + raceIDs.SKYBORNE_ALLIANCE); a value that depends on
  // the client or the character (`isHorde and 1 or 2`) is not, and reads as unknown.
  const BINARY = new Set(['+', '-', '*', '/', '..', '==', '~=', '<', '>', '<=', '>=']);
  function expr() {
    let v = term();
    while (BINARY.has(tok.t) || (tok.t === 'name' && (tok.v === 'and' || tok.v === 'or'))) {
      const op = tok.t === 'name' ? tok.v : tok.t;
      next();
      const w = term();
      v = v === undefined || w === undefined ? undefined : op === '+' ? v + w : op === '-' ? v - w : undefined;
    }
    return v;
  }
  next();
  const value = expr();
  return { value, end: at };
}

/** The positional entries of a Lua table (1, 2, 3... up to the last), an empty slot as undefined. */
export function luaList(t) {
  if (!(t instanceof Map)) return [];
  let max = 0;
  for (const k of t.keys()) if (Number.isInteger(k) && k > max) max = k;
  return Array.from({ length: max }, (_, i) => t.get(i + 1));
}
