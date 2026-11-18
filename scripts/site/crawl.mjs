#!/usr/bin/env node
// Crawls every address of the sitemap on the built site and holds each page to what a visitor and a search engine
// need. It starts the production server itself (next start, on a free port), so it needs a finished `next build`.
//
//   node scripts/site/crawl.mjs            every sitemap address, then every internal link those pages carry
//   node scripts/site/crawl.mjs --sample   one address in 25 of each kind (a quick look while working; CRAWL_SAMPLE=4
//                                          for one in 4)
//   CRAWL_ONLY='^/quests/' node scripts/site/crawl.mjs            only the sitemap addresses the pattern matches
//   CRAWL_LINKS=0 ...                                              without the second pass over the links (while working)
//   ORIGIN=http://localhost:3000 node scripts/site/crawl.mjs      crawl a server that is already running
//
// A page fails when: it does not answer 200; it has no h1 or more than one; it has no title, no description or no
// canonical address, or its canonical is not its own address; its title or its description is also another page's;
// its text shows a value that was never filled in ("Unknown", "undefined", "NaN", "[object Object]", "null"); it
// holds a table without a single row; or it links to an address of the site that does not answer 200.
// Exits 1 with the list when anything fails.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAMPLE = process.argv.includes('--sample') || Boolean(process.env.CRAWL_SAMPLE);
const JOBS = Number(process.env.CRAWL_JOBS) || 4;
const ONLY = process.env.CRAWL_ONLY ? new RegExp(process.env.CRAWL_ONLY) : null;
// every failure in a log file, the first twelve of each kind on a screen
const SHOW = Number(process.env.CRAWL_SHOW) || (process.stdout.isTTY ? 12 : Infinity);
/** Words a page shows when a value was never filled in. A name of the game that holds one of them is listed in ALLOWED. */
const UNFILLED = [/\bUnknown\b/, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /\bnull\b/];
/** The game's own text that holds one of those words, and nothing wider: the three places data/ has them (November 15,
 * 2026). The Argent Dawn's contract in 24 quests ("Contract is null and void if tampered with"), the end of quest 2584
 * ("rendering the other formulation null") and the item 1217, which the game calls "Unknown Reward". */
const ALLOWED = [/\bContract is null and void\b/g, /\bthe other formulation null\b/g, /\bUnknown Reward\b/g];

const fails = [];
const fail = (where, what) => fails.push([where, what]);

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

let server;
let origin = process.env.ORIGIN;
if (!origin) {
  const port = await freePort();
  origin = `http://localhost:${port}`;
  // (Node hands a child its three streams and nothing else, so a server started here never holds a lock this crawl was
  // started under, e.g. `flock`: checked with /proc/<pid>/fd.)
  server = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port)], { cwd: ROOT, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 120 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      up = (await fetch(`${origin}/robots.txt`)).ok;
    } catch {}
  }
  if (!up) {
    server.kill();
    console.log('the production server did not start: run `npx next build` first');
    process.exit(1);
  }
}
// The server keeps every page it builds on demand (quests, items, creatures) on disk: some 300 KB a page, 5 GB for the
// whole sitemap. The crawl has no use for them, so it clears them as it goes, when the server is its own.
const KEPT = path.join(ROOT, '.next', 'server', 'route-cache');
const sweep = () => {
  if (!server) return;
  try {
    rmSync(KEPT, { recursive: true, force: true });
  } catch {}
};
const stop = () => {
  server?.kill();
  sweep();
};
process.on('exit', stop);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130));

const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');
// a copy of its own: a piece cut out of a page would keep the whole page in memory, and 20,000 pages are 5 GB
const own = (s) => Buffer.from(s).toString();
const attr = (html, re) => own((html.match(re)?.[1] ?? '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"'));
const local = (url) => {
  const u = new URL(url, origin);
  return u.pathname + u.search;
};

const titles = new Map();
const descriptions = new Map();
const links = new Map(); // an internal address -> the first page that links to it
const seen = new Set();
let done = 0;

async function page(p, listed) {
  let res;
  let html = '';
  try {
    res = await fetch(origin + p, { redirect: 'manual' });
    html = await res.text();
  } catch (e) {
    return fail(p, `no answer (${e.message})`);
  }
  done++;
  if (res.status !== 200) return fail(p, listed ? `answers ${res.status}` : `answers ${res.status}, linked from ${links.get(p)}`);
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return;
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  for (const m of body.matchAll(/<a\b[^>]*\bhref="(\/[^"#]*)(?:#[^"]*)?"/g)) {
    const to = m[1].replace(/&amp;/g, '&');
    if (to.startsWith('/_next') || to.startsWith('/api/') || to.startsWith('//')) continue;
    if (!links.has(to)) links.set(own(to), p);
  }
  if (!listed) return;
  const h1 = (body.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) fail(p, `${h1} h1`);
  const title = attr(html, /<title>([^<]*)<\/title>/);
  const description = attr(html, /<meta name="description" content="([^"]*)"/);
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  if (!title) fail(p, 'no title');
  else titles.set(title, [...(titles.get(title) ?? []), p]);
  if (!description) fail(p, 'no description');
  else descriptions.set(description, [...(descriptions.get(description) ?? []), p]);
  if (!canonical) fail(p, 'no canonical address');
  else if (local(canonical).replace(/\/$/, '') !== p.replace(/\/$/, '')) fail(p, `its canonical address is ${local(canonical)}`);
  let shown = text(body.match(/<main[\s\S]*<\/main>/)?.[0] ?? body);
  for (const ok of ALLOWED) shown = shown.replace(ok, ' ');
  for (const re of UNFILLED) {
    const m = shown.match(re);
    if (m) fail(p, own(`shows "${m[0]}": …${shown.slice(Math.max(0, m.index - 50), m.index + 50).trim()}…`));
  }
  for (const t of body.match(/<table[\s\S]*?<\/table>/g) ?? []) if (!/<td[\s>]/.test(t)) fail(p, 'a table without a row');
}

async function run(list, listed) {
  let i = 0;
  await Promise.all(
    Array.from({ length: JOBS }, async () => {
      while (i < list.length) {
        const p = list[i++];
        if (seen.has(p)) continue;
        seen.add(p);
        await page(p, listed);
        if (done % 500 === 0) sweep();
        if (done % 2000 === 0) console.log(`  ${done} pages…`);
      }
    }),
  );
}

const t0 = Date.now();
const map = await (await fetch(`${origin}/sitemap.xml`)).text();
let listed = [...map.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => own(local(m[1].replace(/&amp;/g, '&'))));
if (!listed.length) fail('/sitemap.xml', 'lists no address');
if (new Set(listed).size !== listed.length) fail('/sitemap.xml', 'lists an address twice');
if (ONLY) listed = listed.filter((p) => ONLY.test(p));
if (SAMPLE) {
  const kind = new Map();
  listed = listed.filter((p) => {
    const k = p.replace(/\/[^/]*$/, '');
    const n = kind.get(k) ?? 0;
    kind.set(k, n + 1);
    return n % (Number(process.env.CRAWL_SAMPLE) || 25) === 0;
  });
}
console.log(`${listed.length} addresses${SAMPLE ? ' (a sample)' : ONLY ? ` (those matching ${ONLY})` : ''} from the sitemap, ${JOBS} at a time`);
await run(listed, true);
for (const [what, map2] of [['title', titles], ['description', descriptions]]) {
  for (const [value, pages] of map2) if (pages.length > 1) fail(pages[0], `shares its ${what} with ${pages.length - 1} more (${pages.slice(1, 4).join(', ')}${pages.length > 4 ? '…' : ''}): ${value.slice(0, 90)}`);
}
// the links those pages carry: every address of the site they point to answers
const rest = process.env.CRAWL_LINKS === '0' ? [] : [...links.keys()].filter((p) => !seen.has(p));
console.log(`${rest.length} more addresses linked from those pages`);
await run(rest, false);
for (const p of ['/robots.txt', '/feed.xml', '/manifest.webmanifest']) if (!(await fetch(origin + p)).ok) fail(p, 'does not answer');
stop();

const secs = Math.round((Date.now() - t0) / 1000);
if (fails.length) {
  const by = new Map();
  for (const [where, what] of fails) {
    const k = what.replace(/"[^"]*"|\d+/g, '·').replace(/\(.*$|: .*$/, '').slice(0, 60);
    by.set(k, [...(by.get(k) ?? []), `${where}: ${what}`]);
  }
  for (const [k, list] of by) {
    console.log(`\n${list.length} × ${k}`);
    for (const line of list.slice(0, SHOW)) console.log(`  ${line.slice(0, 260)}`);
    if (list.length > SHOW) console.log(`  … and ${list.length - SHOW} more`);
  }
  console.log(`\n${fails.length} failures on ${done} pages in ${secs} s`);
  process.exit(1);
}
console.log(`${done} pages in ${secs} s: every sitemap address answers 200 with one h1, its own title, description and canonical address, no unfilled value, no empty table and no dead internal link.`);
