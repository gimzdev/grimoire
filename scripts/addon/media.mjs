// Draws the add-on's textures (addon/GrimoireForever/Media/*.tga) from SVG: Grimoire's own shapes, icons and emblem,
// in the site's style. No game art.
//
//   node scripts/addon/media.mjs
//
// Uses sharp (installed with Next.js) to draw each SVG, then writes it as an uncompressed 32-bit TGA, which the game
// reads. The fonts in Media/ are not made here: they are copied unchanged from their projects (credits and licences in
// addon/GrimoireForever/NOTICE.md, under Fonts and pictures).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'addon', 'GrimoireForever', 'Media');
mkdirSync(OUT, { recursive: true });

/** An uncompressed 32-bit TGA from RGBA pixels: rows stored bottom to top, the format's usual order. */
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
      const i = row + x * 4;
      const o = (y * width + x) * 4;
      body[o] = rgba[i + 2];
      body[o + 1] = rgba[i + 1];
      body[o + 2] = rgba[i];
      body[o + 3] = rgba[i + 3];
    }
  }
  return Buffer.concat([header, body]);
}

/**
 * Draws an SVG body into a size x size texture. white: the texture is a shape to tint, so every pixel is white and
 * only alpha carries the shape (no dark fringe when the game scales it). maskAlpha: a mask, whose alpha copies its
 * brightness. Otherwise colours bleed into the transparent pixels next to them, for the same reason as white.
 */
async function draw(name, size, body, { viewBox = `0 0 ${size} ${size}`, white = true, maskAlpha = false } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">${body}</svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== size || info.height !== size) throw new Error(`${name}: drew ${info.width}x${info.height}`);
  const px = Buffer.from(data);
  if (maskAlpha) {
    // A mask: alpha follows the drawing's brightness, so it is the same shape read either way.
    for (let i = 0; i < px.length; i += 4) px[i + 3] = px[i];
  } else if (white) {
    for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255;
  } else {
    bleed(px, size);
  }
  writeFileSync(path.join(OUT, `${name}.tga`), tga(size, size, px));
  return name;
}

/** Gives fully transparent pixels the average colour of their visible neighbours, a few pixels deep. */
function bleed(px, size) {
  for (let pass = 0; pass < 4; pass++) {
    const copy = Buffer.from(px);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const o = (y * size + x) * 4;
        if (copy[o + 3] !== 0) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            const p = (ny * size + nx) * 4;
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

const made = [];

// Discs: quarter of one is a rounded corner. Three sizes, so a small corner is not drawn from a big texture.
for (const size of [16, 32, 64]) {
  made.push(await draw(`Disc${size}`, size, `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/>`));
}

// Rings: a corner's outline for a radius of r interface units, one unit thick at that radius. The texture's radius
// (8, 16 or 32 pixels) is picked to sit close to the drawn size.
const ringTextureRadius = (r) => (r <= 5 ? 8 : r <= 10 ? 16 : 32);
for (let r = 4; r <= 16; r++) {
  const R = ringTextureRadius(r);
  const stroke = R / r;
  const size = R * 2;
  made.push(await draw(`Ring${r}`, size, `<circle cx="${R}" cy="${R}" r="${R - stroke / 2}" fill="none" stroke="#fff" stroke-width="${stroke}"/>`));
}

// An icon's rounded square (about the site's 6 px corner on a 40 px icon): the shape to tint for its edge, and the mask
// that rounds the icon itself, white inside and black outside so it masks the same by colour or by alpha.
const iconSquare = '<rect x="0" y="0" width="64" height="64" rx="10" fill="#fff"/>';
made.push(await draw('IconShape', 64, iconSquare));
made.push(await draw('IconMask', 64, `<rect width="64" height="64" fill="#000"/>${iconSquare}`, { white: false, maskAlpha: true }));

// The site's marks: check, chevron, close and search, drawn from the same paths.
made.push(await draw('Check', 32, '<path d="m3.5 8.5 3 3 6-7" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', { viewBox: '0 0 16 16' }));
made.push(await draw('Chevron', 32, '<path d="m3 4.5 3 3 3-3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', { viewBox: '0 0 12 12' }));
made.push(await draw('Close', 32, '<path d="m3 3 6 6m0-6-6 6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>', { viewBox: '0 0 12 12' }));
made.push(await draw('Search', 32, '<circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="#fff" stroke-width="1.8"/><path d="m13 13 4.5 4.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>', { viewBox: '0 0 20 20' }));

// A soft shadow for under the window, cut into nine pieces in game: the box's edge sits 16 pixels in.
made.push(
  await draw(
    'Shadow',
    64,
    '<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter></defs><rect x="16" y="16" width="32" height="32" rx="8" fill="#fff" filter="url(#b)"/>',
  ),
);

// A soft round glow, tinted in game: the light behind the character on the Home page.
made.push(
  await draw(
    'Glow',
    128,
    '<defs><radialGradient id="r"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="64" cy="64" r="64" fill="url(#r)"/>',
  ),
);

// The leveling guide's arrow, pointing up (ahead): turned in game toward the next place and tinted by how far off it is.
// A navigation arrowhead, straight flanks to a sharp tip and a deep notch in its tail, its corners just rounded; its
// right half a shade darker, as if lit from the left, so the tint keeps a fold down the middle. It stays inside the
// texture's inscribed circle, so no turn cuts a corner off.
const arrowShape = 'M32 5 L51 52 L32 41.5 L13 52 Z';
const arrowStroke = 'stroke-width="3.2" stroke-linejoin="round"';
made.push(
  await draw(
    'Arrow',
    128,
    `<defs><clipPath id="r"><rect x="32" y="0" width="32" height="64"/></clipPath></defs>` +
      `<path d="${arrowShape}" fill="#fff" stroke="#fff" ${arrowStroke}/>` +
      `<path d="${arrowShape}" fill="#b8b8b8" stroke="#b8b8b8" ${arrowStroke} clip-path="url(#r)"/>`,
    { viewBox: '0 0 64 64', white: false },
  ),
);

// The guide's compass: a thin ring, about a unit and a quarter wide at 60 units across, tinted with the arrow's colour.
made.push(await draw('Dial', 128, '<circle cx="64" cy="64" r="62.4" fill="none" stroke="#fff" stroke-width="2.6"/>'));

// A globe in thin lines: the compass's sign that there is nowhere to point from (another continent, an instance).
made.push(
  await draw(
    'Globe',
    64,
    '<g fill="none" stroke="#fff" stroke-linecap="round"><circle cx="16" cy="16" r="12.2" stroke-width="1.6"/>' +
      '<ellipse cx="16" cy="16" rx="5.6" ry="12.2" stroke-width="1.4"/><path d="M4 16h24" stroke-width="1.4"/>' +
      '<path d="M6.2 9.6c6.4 1.9 13.2 1.9 19.6 0M6.2 22.4c6.4-1.9 13.2-1.9 19.6 0" stroke-width="1.3"/></g>',
    { viewBox: '0 0 32 32' },
  ),
);

// The guide window's sizing corner: a short arc around the centre of the card's rounded corner (the texture's top left),
// 11 units out at 2 pixels a unit, so it follows the corner's curve.
made.push(await draw('Grip', 32, '<path d="M21.67 3.82 A22 22 0 0 1 3.82 21.67" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round"/>'));

// A round mask, white inside and black outside like IconMask: a game icon shown as a coin (the Hearthstone in the dial).
made.push(await draw('DiscMask', 64, '<rect width="64" height="64" fill="#000"/><circle cx="32" cy="32" r="31.5" fill="#fff"/>', { white: false, maskAlpha: true }));

// Grimoire's emblem: the gold rune stone with the G cut into it, as on the site (src/components/logo.tsx).
made.push(
  await draw(
    'Emblem',
    128,
    '<defs><linearGradient id="g" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#ffdb8a"/><stop offset="0.55" stop-color="#f2b640"/><stop offset="1" stop-color="#d48f22"/></linearGradient></defs>' +
      '<rect x="12" y="12" width="40" height="40" rx="7.5" transform="rotate(45 32 32)" fill="url(#g)"/>' +
      '<path d="M41.5 24 L32 14.5 L18.5 28 L18.5 36 L32 49.5 L45.5 36 L45.5 31 L34.5 31" fill="none" stroke="#0b0c0f" stroke-width="5.4" stroke-linejoin="miter" stroke-linecap="square"/>',
    { viewBox: '0 0 64 64', white: false },
  ),
);

console.log(`Media: ${made.length} textures in ${path.relative(ROOT, OUT)}`);
