#!/usr/bin/env node
// Uploads the add-on's zip to CurseForge as a release of its project, with this version's changelog. grimoire.sh runs it
// for --deploy --addon when CURSEFORGE_TOKEN is set; it can also run on its own:
//
//   CURSEFORGE_TOKEN=... node scripts/addon/curseforge.mjs addon/dist/GrimoireForever-<version>.zip <project id> [--beta] [--dry]
//
// --beta uploads it as a beta: what changes the add-on's Lua goes out that way until it has been tried in game; CurseForge
// offers a beta only to players who asked for betas.
//
// CurseForge's upload API (https://support.curseforge.com/en/support/solutions/articles/9000197321-curseforge-upload-api):
// a token from https://legacy.curseforge.com/account/api-tokens, the game versions from /api/game/versions and the file
// to /api/projects/<id>/upload-file. The game version is Forever's: the one named after the .toc's interface (16001 is
// 1.60.1), among the versions of World of Warcraft: Forever (type 88568), else the newest of that type.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://wow.curseforge.com/api';
const FOREVER_TYPE = 88568;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ADDON = path.join(ROOT, 'addon', 'GrimoireForever');

const [zipPath, project] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dry = process.argv.includes('--dry');
const beta = process.argv.includes('--beta');
const token = process.env.CURSEFORGE_TOKEN;
const fail = (m) => {
  console.error(`CurseForge: ${m}`);
  process.exit(1);
};
if (!zipPath || !project) fail('usage: node scripts/addon/curseforge.mjs <zip> <project id> [--beta] [--dry]');
if (!token) fail('CURSEFORGE_TOKEN is not set.');

const toc = readFileSync(path.join(ADDON, 'GrimoireForever.toc'), 'utf8');
const version = /^## Version:\s*(\S+)/m.exec(toc)?.[1] ?? 'unknown';
const iface = Number(/^## Interface:\s*(\d+)/m.exec(toc)?.[1] ?? 0);
const gameName = iface ? `${Math.floor(iface / 10000)}.${Math.floor(iface / 100) % 100}.${iface % 100}` : null;

// this version's entry of CHANGELOG.md, without its heading
const log = readFileSync(path.join(ADDON, 'CHANGELOG.md'), 'utf8');
const start = log.search(new RegExp(`^## ${version.replace(/\./g, '\\.')}\\s*$`, 'm'));
let changelog = `Grimoire ${version}.`;
if (start >= 0) {
  const body = log.slice(start).split('\n').slice(1);
  const end = body.findIndex((l) => /^## /.test(l));
  changelog = (end < 0 ? body : body.slice(0, end)).join('\n').trim() || changelog;
}

const headers = { 'X-Api-Token': token };
const call = async (url, init) => {
  try {
    return await fetch(url, init);
  } catch (e) {
    return fail(`could not reach CurseForge (${e.cause?.code ?? e.message}).`);
  }
};
const res = await call(`${API}/game/versions`, { headers });
if (!res.ok) fail(`could not read the game versions (HTTP ${res.status}). Is the token right?`);
const versions = await res.json();
const forever = versions.filter((v) => v.gameVersionTypeID === FOREVER_TYPE);
const pick = forever.find((v) => v.name === gameName) ?? forever.sort((a, b) => b.id - a.id)[0] ?? versions.find((v) => v.name === gameName);
if (!pick) fail(`no CurseForge game version for Forever${gameName ? ` (${gameName})` : ''}.`);

const name = path.basename(zipPath);
const metadata = { changelog, changelogType: 'markdown', displayName: name.replace(/\.zip$/, '') + (beta ? ' beta' : ''), gameVersions: [pick.id], releaseType: beta ? 'beta' : 'release' };
console.log(`CurseForge: ${name} as a ${beta ? 'beta' : 'release'} for ${pick.name} (game version ${pick.id}) to project ${project}${dry ? ' (dry run, nothing sent)' : ''}`);
if (dry) process.exit(0);

const form = new FormData();
form.append('metadata', JSON.stringify(metadata));
form.append('file', new Blob([readFileSync(zipPath)], { type: 'application/zip' }), name);
const up = await call(`${API}/projects/${encodeURIComponent(project)}/upload-file`, { method: 'POST', headers, body: form });
const text = await up.text();
if (!up.ok) fail(`the upload was refused (HTTP ${up.status}): ${text.slice(0, 300)}`);
let id = '';
try {
  id = JSON.parse(text).id ?? '';
} catch {
  /* CurseForge answered without JSON: the upload still went through */
}
console.log(`CurseForge: uploaded${id ? ` as file ${id}` : ''}. It shows on the project once CurseForge has checked it.`);
