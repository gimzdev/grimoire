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
