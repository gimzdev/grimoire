/* Each dungeon's and raid's quests.
 *
 * Classic files some of a dungeon's quests under the dungeon, but many under the town that gives them, and a few under a
 * quest category of their own (questSorts: Gnomeregan's, Uldaman's...). So a quest counts for a dungeon when:
 * - the game files it there (its zone, or its questSorts for a dungeon or raid quest),
 * - its work is inside: a creature to kill or an object to use there, or an item that mostly drops there (from three in
 *   five of the creatures and objects that drop it),
 * - the creature or object that gives or takes it stands inside, or the item that starts it drops there,
 * - or, for a dungeon or raid quest the data cannot place, and for Forever's own quests (which come with their words
 *   only), its objective names the dungeon ("...in the Ruins of Lordaeron").
 * Holiday, world event, PvP and repeatable quests are left out.
 */

const EVENT_SORTS = new Set([-22, -364, -365, -366, -367, -368, -369]); // seasonal, Darkmoon, war effort, holidays...
const SHARE = 0.6;

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function dungeonQuests({ world, dungeons }) {
  const npcZone = (id) => world.npcs[id]?.[6] ?? 0;
  const objectZone = (id) => world.objects[id]?.[1] ?? 0;
  const itemZones = new Map();
  /** The zone most of an item's sources stand in, when three in five of them do; else 0. */
  const itemZone = (item) => {
    if (itemZones.has(item)) return itemZones.get(item);
    const sources = world.drops[item]?.s ?? [];
    const count = new Map();
    for (const [kind, id] of sources) {
      const z = kind === 'n' ? npcZone(id) : kind === 'o' ? objectZone(id) : 0;
      count.set(z, (count.get(z) ?? 0) + 1);
    }
    let best = 0;
    let n = 0;
    for (const [z, c] of count) if (z && c > n) [best, n] = [z, c];
    const zone = best && n / sources.length >= SHARE ? best : 0;
    itemZones.set(item, zone);
    return zone;
  };
  /** Every zone a quest's work, giver, taker or starting item is in. */
  const zonesOf = (q) => {
    const at = new Set();
    for (const [kind, id] of q.rq ?? []) at.add(kind === 'n' ? npcZone(id) : kind === 'o' ? objectZone(id) : kind === 'i' ? itemZone(id) : 0);
    for (const [kind, id] of [...(q.st ?? []), ...(q.en ?? [])]) at.add(kind === 'n' ? npcZone(id) : kind === 'o' ? objectZone(id) : kind === 'i' ? itemZone(id) : 0);
    at.delete(0);
    return at;
  };

  const listed = dungeons.filter((d) => d.kind === 'dungeon' || d.kind === 'raid');
  const byZone = new Map(listed.filter((d) => d.zoneId).map((d) => [d.zoneId, d]));
  // A dungeon's name as quests write it: "Ruins of Lordaeron", "Wailing Caverns" (without "The"; with or without its
  // apostrophes, straight or curly).
  const pattern = (name) =>
    name
      .replace(/^The\s+/i, '')
      .split(/\s+/)
      .map((w) => escape(w).replace(/['’]/g, "['’]?"))
      .join('\\s+');
  const names = listed.map((d) => ({ d, re: new RegExp(`\\b${pattern(d.name)}\\b`, 'i') }));
  const out = new Map(listed.map((d) => [d.slug, new Set()]));
  for (const q of world.quests) {
    if (q.ty === 41 || q.ty === 82 || q.ev || q.rep || EVENT_SORTS.has(q.z)) continue;
    let placed = false;
    for (const z of [q.z, ...zonesOf(q)]) {
      const d = byZone.get(z);
      if (d) {
        out.get(d.slug).add(q.i);
        placed = true;
      }
    }
    for (const d of listed) {
      if ((q.ty === 81 || q.ty === 62) && d.questSorts?.includes(q.z)) {
        out.get(d.slug).add(q.i);
        placed = true;
      }
    }
    // Words only: a dungeon or raid quest the data cannot place names its dungeon; one of Forever's own (no zone, no
    // giver) counts for one of Forever's new dungeons it names ("Gnomeregan" in a new quest is as likely the city).
    if (!placed && q.o && (q.ty === 81 || q.ty === 62 || !q.z)) {
      const dungeonQuest = q.ty === 81 || q.ty === 62;
      for (const { d, re } of names) if ((dungeonQuest || !d.zoneId) && re.test(q.o)) out.get(d.slug).add(q.i);
    }
  }
  const byId = new Map(world.quests.map((q) => [q.i, q]));
  const result = {};
  for (const [slug, ids] of out) {
    if (!ids.size) continue;
    result[slug] = [...ids]
      .map((i) => byId.get(i))
      .sort((a, b) => (a.l || 99) - (b.l || 99) || a.r - b.r || a.n.localeCompare(b.n) || a.i - b.i)
      .map((q) => q.i);
  }
  return result;
}
