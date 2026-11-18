// The bar every leveling route must meet (plan B3), measured on data/guide.json: routes-report.mjs prints it and
// check-routes.mjs enforces it.
//
//   zoneSteps    "Go to" zone steps (Z): a visit or a crossing on foot each
//   continents   changes of continent between one step and the next
//   grind        "kill to the next level" steps (L)
//   sails        changes of continent other than by the class's own teleport (a boat, a zeppelin, a Hearthstone)
//   hops         stays on a continent, between two changes of continent, that hand in fewer than three quests
//   grindRun     the longest run of levels in a row killed through for more than half
//   row          the levels ground in stretches of a level or more in a row (grind steps at levels that follow each
//                other, each longer than a third of its level, adding up to a level or more), and `stretches`: each one
//   grindMax     the longest of them, in percent of its level (the route's own record when it has one, else worked out
//                from the quests' experience before it: an estimate, marked "~")
//   thin         visits (the steps from one "Go to" zone step to the next) that take, do or hand in an ordinary quest and
//                hand in fewer than three (class quests aside, and a visit to the class trainer)
//   crossings    zones only crossed on foot on the way to another (a "Go to" with no step of work before the next one,
//                or a zone a "Go to" step names as on the way)
//   visits       stays: the steps from one "Go to" to the next (the route goes to a zone and works there; a turn-in
//                a few hundred yards over the border is part of the stay), counted when they hold a step of work (take,
//                do, hand in, kill to the next level)
//   newZones     Forever's zones the route has steps in
//   hours        the engine's own estimate
//   unresolved   steps whose quest, creature, object, place, flight path, ship, note or dungeon is not in the guide

import { grindRows, killXp, questXp } from './guide.mjs';

export const NEW_ZONES = { 16593: 'Zephras Isle', 16591: 'Riverglades', 16651: 'Shen’dralas', 616: 'Mount Hyjal' };
const POS = { A: 3, T: 3, C: 3, F: 3, L: 3, Z: 2, B: 2, P: 2, R: 2, N: 2, H: 2, S: 2, I: 2, D: 2 };
const levelOf = (s) => (s[0] === 'A' || s[0] === 'T' || s[0] === 'C' || s[0] === 'F' || s[0] === 'L' ? s[6] : s[5]);

/**
 * The bar's numbers for one route.
 * @param guide data/guide.json
 * @param route one of guide.routes
 * @param ctx { npcs: data/npcs.json, xpTable: Map(level -> experience to the next) or null, chain: the quests of a way
 *   through a standing (lib/guide.mjs standingChain), whose visits are not counted as short ones, or null }
 */
export function routeNumbers(guide, route, { npcs = {}, xpTable = null, chain = null } = {}) {
  const steps = route.steps;
  const areaOf = (s) => s[POS[s[0]]];
  const mapOf = (area) => guide.zones[area]?.map;
  const isClass = (q) => Boolean(guide.quests[q]?.c);
  const n = { zoneSteps: 0, crossings: 0, visits: 0, continents: 0, sails: 0, hops: 0, grind: 0, grindMax: 0, grindRun: 0, grindEstimated: false, thin: [], newZones: [], hours: route.hours, unresolved: [] };
  let stay = 0;
  let longAt = -9;
  let run = 0;

  /* Continent changes and Forever's zones */
  let lastMap;
  const seen = new Set();
  for (const s of steps) {
    if (s[0] === 'I' || s[0] === 'D') continue;
    const m = mapOf(areaOf(s));
    if (m !== undefined && lastMap !== undefined && m !== lastMap) {
      n.continents++;
      // sails: the changes of continent not made by the class's own teleport
      if (s[0] !== 'S') n.sails++;
      // hops: stays on a continent, between two changes, that hand in fewer than three quests
      if (stay < 3) n.hops++;
      stay = 0;
    }
    if (m !== undefined) lastMap = m;
    if (s[0] === 'T') stay++;
    const a = areaOf(s);
    if (NEW_ZONES[a] && !seen.has(a)) {
      seen.add(a);
      n.newZones.push(a);
    }
    if (s[0] === 'Z') n.zoneSteps++;
    if (s[0] === 'Z') n.crossings += (s[6] ?? []).length;
    if (s[0] === 'L') n.grind++;
    // grindRun: the longest run of levels in a row ground for more than half
    if (s[0] === 'L' && s[7] > 50) {
      run = s[1] - 1 === longAt + 1 ? run + 1 : 1;
      longAt = s[1] - 1;
      n.grindRun = Math.max(n.grindRun, run);
    }
  }
  {
    const rows = grindRows(steps.filter((s) => s[0] === 'L').map((s) => ({ level: s[1] - 1, share: s[7] })));
    n.row = rows.levels;
    n.stretches = rows.stretches;
  }
  /* Crossings written as steps of their own: a "Go to" followed by another with nothing but notes between */
  const placed = steps.filter((s) => s[0] !== 'I' && s[0] !== 'D');
  placed.forEach((s, k) => {
    if (s[0] === 'Z' && placed[k + 1]?.[0] === 'Z') n.crossings++;
  });

  /* Visits: the steps from one "Go to" zone step to the next (walking over a border to a turn-in close by is part of the
   * visit; the route did not go anywhere). A visit that takes, does or hands in an ordinary quest is a quest visit. */
  let visit = { zone: areaOf(steps[0]), level: 1, handed: 0, quest: false, trainer: false, chain: false, work: false };
  const close = () => {
    if (visit.work) n.visits++;
    if (visit.quest && !visit.trainer && !visit.chain && visit.handed < 3) n.thin.push({ zone: visit.zone, level: visit.level, handed: visit.handed });
  };
  for (const s of steps) {
    if (s[0] === 'Z') {
      close();
      visit = { zone: s[1], level: levelOf(s), handed: 0, quest: false, trainer: false, chain: false, work: false };
    }
    if (chain && (s[0] === 'A' || s[0] === 'T' || s[0] === 'C') && chain.has(s[1])) visit.chain = true;
    if (s[0] === 'A' || s[0] === 'T' || s[0] === 'C' || s[0] === 'L') visit.work = true;
    if (s[0] === 'R') visit.trainer = true;
    if ((s[0] === 'A' || s[0] === 'T' || s[0] === 'C') && !isClass(s[1])) visit.quest = true;
    if (s[0] === 'T' && !isClass(s[1])) visit.handed++;
  }
  close();

  /* The longest grind, as a share of its level */
  if (route.grind) n.grindMax = Math.max(0, ...route.grind);
  else if (xpTable && n.grind) {
    // Experience gained in the level before each L step: the quests handed in and the kills their objectives ask for.
    // Kills on the way are not in the guide, so this is the most the grind can be.
    n.grindEstimated = true;
    let level = 0;
    let xp = 0;
    for (const s of steps) {
      const lv = levelOf(s);
      if (lv !== level) {
        level = lv;
        xp = 0;
      }
      if (s[0] === 'T') {
        const q = guide.quests[s[1]];
        if (q?.x) xp += questXp(q.x, q.l, lv);
      } else if (s[0] === 'C') {
        const q = guide.quests[s[1]];
        for (const i of s[2]) {
          const o = q?.o?.[i];
          if (!o) continue;
          const mob = o[0] === 'n' ? o[1] : o[0] === 'i' ? (o[4] ?? []).find((id) => id > 0) : 0;
          const c = mob ? npcs[mob] : null;
          if (c) xp += (o[2] ?? 1) * killXp(lv, Math.round((c[2] + c[3]) / 2), c[4] === 1 || c[4] === 2) * 0.8;
        }
      } else if (s[0] === 'L') {
        const need = xpTable.get(lv);
        if (need) n.grindMax = Math.max(n.grindMax, Math.round((100 * Math.max(0, need - xp)) / need));
      }
    }
  }

  /* Every step resolves */
  const npc = (id) => (id > 0 ? guide.npcs[id] : id < 0 ? guide.objects[-id] : true);
  const place = (s) => {
    const i = POS[s[0]];
    const [a, x, y] = [s[i], s[i + 1], s[i + 2]];
    if (s[0] === 'I' || s[0] === 'D') return Number.isInteger(a);
    return Boolean(guide.zones[a]) && x >= 0 && x <= 100 && y >= 0 && y <= 100;
  };
  steps.forEach((s, k) => {
    let ok = place(s);
    switch (s[0]) {
      case 'A':
      case 'T':
        ok &&= Boolean(guide.quests[s[1]]) && Boolean(npc(s[2]));
        break;
      case 'C':
        ok &&= Boolean(guide.quests[s[1]]) && s[2].every((i) => guide.quests[s[1]].o[i]) && (!s[7] || Boolean(npc(s[7])));
        break;
      case 'Z':
        ok &&= Boolean(guide.zones[s[1]]);
        break;
      case 'F':
        ok &&= Boolean(guide.taxi[s[1]]) && Boolean(guide.taxi[s[2]]);
        break;
      case 'B':
        ok &&= Boolean(guide.transports[s[1]]);
        break;
      case 'P':
        ok &&= Boolean(guide.taxi[s[1]]);
        break;
      case 'R':
      case 'N':
        ok &&= Boolean(guide.npcs[s[1]]);
        break;
      case 'L':
        ok &&= !s[2] || Boolean(guide.npcs[s[2]]);
        break;
      case 'S':
        ok &&= Boolean(guide.teleports?.[s[1]]);
        break;
      case 'I':
        ok &&= Boolean(guide.info?.[s[1]]);
        break;
      case 'D':
        ok &&= Boolean(guide.dun?.[s[1]]) && s[6].every((q) => guide.starts?.[q]);
        break;
      case 'H':
        break;
      default:
        ok = false;
    }
    if (!ok) n.unresolved.push(k);
  });
  return n;
}

const median = (list) => {
  const v = [...list].sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : 0;
};

/** The table: a line per route and the median, as text. */
export function routeTable(guide, ctx) {
  const rows = guide.routes.map((r) => ({ id: r.id, steps: r.steps.length, quests: r.quests, ...routeNumbers(guide, r, ctx) }));
  const head = ['route', 'steps', 'quests', 'go-to', 'cont', 'kill', 'kill max %', 'thin visits', 'new zones', 'hours', 'unresolved', 'crossings', 'visits'];
  const line = (c) => `| ${c.join(' | ')} |`;
  const out = [line(head), line(head.map(() => '---'))];
  for (const r of rows)
    out.push(line([r.id, r.steps, r.quests, r.zoneSteps, r.continents, r.grind, `${r.grindEstimated ? '~' : ''}${r.grindMax}`, r.thin.length, r.newZones.length, r.hours, r.unresolved.length, r.crossings, r.visits]));
  const m = (f) => Math.round(median(rows.map(f)) * 10) / 10;
  out.push(line(['**median**', m((r) => r.steps), m((r) => r.quests), m((r) => r.zoneSteps), m((r) => r.continents), m((r) => r.grind), m((r) => r.grindMax), m((r) => r.thin.length), m((r) => r.newZones.length), m((r) => r.hours), m((r) => r.unresolved.length), m((r) => r.crossings), m((r) => r.visits)]));
  return { rows, text: out.join('\n') };
}
