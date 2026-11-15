// What the guide generators in scripts/guides share: their inputs (the VMaNGOS world database and the tree's data/),
// the site's link syntax, and the markers a generated block sits between in a guide:
//
//   <!-- generated: name -->
//   ...written by the generator, never by hand...
//   <!-- /generated -->
//
// Each generator exports `guide` (its file in content/guides) and `blocks({ db, data })`, which returns the text of
// every block by name; run on its own it writes them, and scripts/data/check-guide-tables.mjs compares them with the file.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { latest, openVmangos } from '../data/lib/world.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export { latest };

/** The tree's data/, read once per file. */
export function readData(dir = path.join(ROOT, 'data')) {
  const cache = new Map();
  return (file) => {
    if (!cache.has(file)) cache.set(file, JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
    return cache.get(file);
  };
}

// A block's text holds no marker, so a match cannot run on into the next block.
const BLOCK = (name) => new RegExp(`(<!-- generated: ${name} -->\\n)(?:(?!<!--)[\\s\\S])*(<!-- /generated -->)`);

/** The guide's text with each named block replaced; a block the guide does not have is an error. */
export function fill(text, blocks) {
  let out = text;
  for (const [name, body] of Object.entries(blocks)) {
    if (!BLOCK(name).test(out)) throw new Error(`no "<!-- generated: ${name} -->" block in the guide`);
    out = out.replace(BLOCK(name), (_, open, close) => `${open}${body.trim()}\n${close}`);
  }
  return out;
}

/** Runs a generator from the command line: node scripts/guides/<name>.mjs --vmangos mangos.sqlite [--data data] */
export function main(gen) {
  const arg = (k, d) => {
    const i = process.argv.indexOf(k);
    return i > 0 ? process.argv[i + 1] : d;
  };
  const db = openVmangos(path.resolve(arg('--vmangos', 'mangos.sqlite')));
  const data = readData(path.resolve(arg('--data', path.join(ROOT, 'data'))));
  const file = path.join(ROOT, gen.guide);
  const before = readFileSync(file, 'utf8');
  const blocks = gen.blocks({ db, data });
  const after = fill(before, blocks);
  if (after !== before) writeFileSync(file, after);
  console.log(`${gen.guide}: ${Object.keys(blocks).length} blocks, ${after === before ? 'unchanged' : 'written'}`);
}

/** True when the module is the script node was started with. */
export const isMain = (url) => process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(url);

/* ── The site's link syntax (src/lib/markdown.tsx) ─────────────────────── */

export const npcLink = (id) => `[[npc:${id}]]`;
export const itemLink = (id) => `[[item:${id}]]`;

/** A zone's name, linked to its page when the site has one. */
export function zoneLink(data, id) {
  const zone = data('zones.json').find((z) => z.id === id);
  if (zone) return `[${zone.n}](/world/${id})`;
  return data('zone-names.json')[id] ?? `Zone ${id}`;
}

export const levels = (lo, hi) => (lo === hi ? String(lo) : `${lo} to ${hi}`);

/** A Markdown table; cells are text already in the site's syntax. */
export function table(head, rows) {
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}
