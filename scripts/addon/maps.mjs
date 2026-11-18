// The dungeon and raid maps of the add-on's Dungeons page, from data/maps.json (scripts/data/maps.mjs): each floor of each
// view drawn as a texture in addon/GrimoireForever/Media/Maps, and the table the page places the bosses with
// (Data/Maps.lua, read by UI/DungeonMap.lua and UI/Dungeons.lua). Called by scripts/addon/build.mjs, which writes the table
// and packs the textures.
//
//   node scripts/addon/maps.mjs [--png <dir>]   (just the textures; --png also writes each as a PNG over the page's
//                                                colours, at the size the page shows it, to look at)
//
// No game art: the floor plans are Grimoire's own drawing in the add-on's palette, from where VMaNGOS puts creatures and
// objects. Uses sharp (installed with Next.js) to draw each SVG, then writes it as an uncompressed 32-bit TGA, the format
// scripts/addon/media.mjs writes for the game.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// sharp is loaded when the maps are drawn: where it is missing the add-on is built without its maps instead of failing
let sharp = null;

// The biggest a map is shown, in UI units: the Dungeons page's right column less its list's padding, scroll bar and the
// map's own margins (MAX_W and MAX_H in UI/DungeonMap.lua, which must match). Each texture is the power of two at or a
// little under the size it is shown at, about one texel to a unit, never more than 512 on a side: the 44 floors come to
// about 15 MB.
export const MAX_W = 386;
export const MAX_H = 250;
const STRETCH = 1.2; // how far a texture may be stretched in game before the next size up is used

// The add-on's palette (UI/Widgets.lua, the site's src/app/globals.css): floors a soft dark slate a little lighter than
// the card they sit on, lit from above, with a faint light just inside the walls and a fine warm-white edge.
const FILL_TOP = '#2b3038';
const FILL_BOTTOM = '#21252b';
const GLOW = '#f4f1ea';
const EDGE = '#ebe6dc';
// The page's map well under the textures, for the PNG previews only: the card (white at 3.5% over the window's #13161b)
// darkened by a quarter.
const WELL = [21, 23, 27];

/** An uncompressed 32-bit TGA from RGBA pixels: rows stored bottom to top, the format's usual order (as media.mjs). */
function tga(width, height, rgba) {
  const header = Buffer.alloc(18);
  header[2] = 2; // true colour, no compression
  header.writeUInt16LE(width, 12);
  header.writeUInt16LE(height, 14);
  header[16] = 32; // bits per pixel
  header[17] = 8; // eight bits of alpha, origin at the bottom left
  const body = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = (height - 1 - y) * width * 4;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const o = row + x * 4;
      body[o] = rgba[i + 2];
      body[o + 1] = rgba[i + 1];
      body[o + 2] = rgba[i];
      body[o + 3] = rgba[i + 3];
    }
  }
  return Buffer.concat([header, body]);
}

/**
 * Gives fully transparent pixels the average colour of their visible neighbours, a few pixels deep, so the game's
 * filtering does not darken the edge where it meets the clear outside (as media.mjs's bleed).
 */
function bleed(px, w, h) {
  for (let pass = 0; pass < 3; pass++) {
    const copy = Buffer.from(px);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (copy[o + 3] !== 0 || copy[o] | copy[o + 1] | copy[o + 2]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const p = (ny * w + nx) * 4;
            if (copy[p + 3] === 0 && (copy[p] | copy[p + 1] | copy[p + 2]) === 0) continue;
            r += copy[p]; g += copy[p + 1]; b += copy[p + 2]; n++;
          }
        }
        if (n) {
          px[o] = Math.round(r / n);
          px[o + 1] = Math.round(g / n);
          px[o + 2] = Math.round(b / n);
        }
      }
    }
  }
}

/** A view's texture size, and the UI units a view unit is shown at on the page at most. */
export function textureSize(w, h) {
  const s = Math.min(MAX_W / w, MAX_H / h);
  const fit = (n) => [64, 128, 256, 512].find((p) => n <= p * STRETCH) ?? 512;
  return { W: fit(w * s), H: fit(h * s), s };
}

/**
 * One floor as an SVG of the texture's size. It is drawn in the view's own units and stretched to the texture, which the
 * game stretches back to the view's shape, so a line set in UI units (u) comes out the same width every way on the page.
 */
function floorSvg(view, d, W, H, s) {
  const u = 1 / s;
  const n = (v) => Math.round(v * 100) / 100;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${view.w} ${view.h}" preserveAspectRatio="none">` +
    '<defs>' +
    `<linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${FILL_TOP}"/><stop offset="1" stop-color="${FILL_BOTTOM}"/></linearGradient>` +
    `<clipPath id="in"><path d="${d}" clip-rule="evenodd"/></clipPath>` +
    `<filter id="soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="${n(2 * u)}"/></filter>` +
    '</defs>' +
    `<path d="${d}" fill="url(#fill)" fill-rule="evenodd"/>` +
    // the light inside the walls: a wide soft stroke, kept to the inside
    `<g clip-path="url(#in)"><path d="${d}" fill="none" stroke="${GLOW}" stroke-opacity="0.12" stroke-width="${n(6 * u)}" filter="url(#soft)"/></g>` +
    `<path d="${d}" fill="none" stroke="${EDGE}" stroke-opacity="0.6" stroke-width="${n(1.1 * u)}" stroke-linejoin="round"/>` +
    '</svg>'
  );
}

async function rasterize(svg, W, H) {
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== W || info.height !== H) throw new Error(`maps: drew ${info.width}x${info.height}, not ${W}x${H}`);
  return Buffer.from(data);
}

/** A PNG of a texture over the page's map well, at the shape and size the page shows it, to judge it by eye. */
async function preview(file, px, W, H, view, s) {
  const back = await sharp({ create: { width: W, height: H, channels: 4, background: { r: WELL[0], g: WELL[1], b: WELL[2], alpha: 1 } } })
    .composite([{ input: px, raw: { width: W, height: H, channels: 4 } }])
    .png()
    .toBuffer();
  await sharp(back)
    .resize(Math.round(view.w * s), Math.round(view.h * s), { fit: 'fill' })
    .png()
    .toFile(file);
}

// The entrance's mark: an arched doorway in fine lines, white for the game to tint.
const DOOR =
  '<path d="M4.6 13.2V7.6a3.4 3.4 0 0 1 6.8 0v5.6" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M2.8 13.2h10.4" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>';

/**
 * Draws every floor of every view as Media/Maps/<slug>-<view>-<floor>.tga (and the entrance mark, Door.tga), and takes
 * away textures no view uses any more. Returns { views: { [slug]: [{ ...view, tex: [file per floor] }] }, files, bytes }.
 */
export async function drawMaps({ maps, dir, png }) {
  if (!sharp) {
    try {
      sharp = (await import('sharp')).default;
    } catch {
      console.warn('maps: sharp is not installed (npm install puts it in with Next.js), so the add-on is built without its dungeon maps');
      return { views: {}, files: 0, bytes: 0 };
    }
  }
  mkdirSync(dir, { recursive: true });
  if (png) mkdirSync(png, { recursive: true });
  const keep = new Set();
  const views = {};
  let bytes = 0;
  const write = (name, buf) => {
    writeFileSync(path.join(dir, name), buf);
    keep.add(name);
    bytes += buf.length;
  };
  const door = await rasterize(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 16 16">${DOOR}</svg>`, 32, 32);
  for (let i = 0; i < door.length; i += 4) door[i] = door[i + 1] = door[i + 2] = 255;
  write('Door.tga', tga(32, 32, door));
  for (const [slug, m] of Object.entries(maps)) {
    views[slug] = [];
    for (const [vi, view] of m.views.entries()) {
      const { W, H, s } = textureSize(view.w, view.h);
      const tex = [];
      for (const [fi, floor] of view.floors.entries()) {
        const name = `${slug}-${vi + 1}-${fi + 1}`;
        const px = await rasterize(floorSvg(view, floor.d, W, H, s), W, H);
        if (png) await preview(path.join(png, `${name}.png`), Buffer.from(px), W, H, view, s);
        bleed(px, W, H);
        write(`${name}.tga`, tga(W, H, px));
        tex.push(name);
      }
      views[slug].push({ ...view, tex });
    }
  }
  for (const f of readdirSync(dir)) if (!keep.has(f)) rmSync(path.join(dir, f));
  return { views, files: keep.size, bytes };
}

/* ── Data/Maps.lua ───────────────────────────────────────────────────────── */

const luaStr = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\|/g, '||')}"`;
// A place on the map, as a share of the view's width or height: four decimals, a tenth of a unit on the biggest map.
const share = (v, of) => String(Math.round(Math.min(1, Math.max(0, v / of)) * 10000) / 10000);

/**
 * The table the Dungeons page reads, as Lua: for each dungeon, its views in order, each { name, aspect (width over
 * height), floors = { { tex, name } }, bosses = { { key, boss, npc, floor, display, at = { x, y, ... } } }, doors =
 * { { x, y, floor } } }. Places are shares of the view's width and height from its top left (0 to 1), floors count from
 * 1, and boss is the boss's place in its dungeon's list (Data/Dungeons.lua), found by its key in data/encounters.json.
 * Returns the Lua text and what it could not place.
 */
export function mapsLua(views, encounters, known) {
  const lines = ['local M = {}', 'ns.maps = M'];
  const missing = [];
  for (const [slug, list] of Object.entries(views)) {
    const e = encounters[slug];
    if (!e || !known.has(slug)) {
      missing.push(`${slug} (no dungeon)`);
      continue;
    }
    // A boss's place in the dungeon's list: Data/Dungeons.lua lists every wing's bosses in turn, as encounters.json does.
    const index = new Map(e.wings.flatMap((w) => w.bosses).map((b, i) => [b.key, i + 1]));
    const out = [];
    for (const v of list) {
      const floors = v.floors.map((f, i) => `{tex=${luaStr(v.tex[i])}${f.name ? `,name=${luaStr(f.name)}` : ''}}`);
      const bosses = [];
      for (const b of v.bosses) {
        const at = index.get(b.key);
        if (!at) {
          missing.push(`${slug}: ${b.key}`);
          continue;
        }
        const places = b.at.flatMap(([x, y]) => [share(x, v.w), share(y, v.h)]);
        bosses.push(`{key=${luaStr(b.key)},boss=${at},npc=${b.npc},floor=${b.f + 1}${b.dis?.[0] ? `,display=${b.dis[0]}` : ''},at={${places.join(',')}}}`);
      }
      // the same door once (a raid can have several teleports to the same spot)
      const seen = new Set();
      const doors = [];
      for (const [x, y, f] of v.doors) {
        const key = `${x},${y},${f}`;
        if (seen.has(key)) continue;
        seen.add(key);
        doors.push(`{${share(x, v.w)},${share(y, v.h)},${f + 1}}`);
      }
      const aspect = Math.round((v.w / v.h) * 10000) / 10000;
      out.push(`{${v.name ? `name=${luaStr(v.name)},` : ''}aspect=${aspect},floors={${floors.join(',')}},bosses={${bosses.join(',')}},doors={${doors.join(',')}}}`);
    }
    lines.push(`M[${luaStr(slug)}]={${out.join(',\n')}}`);
  }
  return { text: lines.join('\n'), missing };
}

/* ── On its own: the textures, and PNG previews ──────────────────────────── */

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const at = process.argv.indexOf('--png');
  const file = path.join(ROOT, 'data', 'maps.json');
  if (!existsSync(file)) throw new Error('data/maps.json is missing: node scripts/data/maps.mjs builds it');
  const { views, files, bytes } = await drawMaps({
    maps: JSON.parse(readFileSync(file, 'utf8')),
    dir: path.join(ROOT, 'addon', 'GrimoireForever', 'Media', 'Maps'),
    png: at > 0 ? path.resolve(process.argv[at + 1]) : null,
  });
  console.log(`Maps: ${Object.keys(views).length} dungeons, ${files} textures, ${(bytes / 1048576).toFixed(1)} MB`);
}
