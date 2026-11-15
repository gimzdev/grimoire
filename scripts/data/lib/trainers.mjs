// Classic's training prices, from VMaNGOS's trainer lists (npc_trainer and npc_trainer_template at patch 1.12, build
// 5875). A trainer lists a teaching spell that teaches the real one, so each price is moved to the spell it teaches.
// Forever's own new spells have no Classic price, and Forever may have changed some: the site says so.

/** The spell each teaching spell teaches (a trainer lists the teaching spell). */
function taught(db) {
  const teach = new Map();
  for (const r of db.prepare('SELECT entry, effect1, effectTriggerSpell1 FROM spell_template WHERE effect1 = 36 ORDER BY entry, build').all()) teach.set(r.entry, r.effectTriggerSpell1);
  return teach;
}

/** The lowest level a Classic trainer teaches each spell at, by the spell's own id, so a rank Forever moved can be marked. */
export function trainerLevels(db) {
  const teach = taught(db);
  const levels = new Map();
  for (const table of ['npc_trainer', 'npc_trainer_template']) {
    for (const r of db.prepare(`SELECT spell, reqlevel FROM ${table}`).all()) {
      const real = teach.get(r.spell) ?? r.spell;
      if (r.reqlevel && (!levels.has(real) || levels.get(real) > r.reqlevel)) levels.set(real, r.reqlevel);
    }
  }
  return levels;
}

/** Copper to learn each spell at a trainer, by the spell's own id. */
export function trainerCosts(db) {
  const teach = taught(db);
  const costs = new Map();
  for (const table of ['npc_trainer', 'npc_trainer_template']) {
    for (const r of db.prepare(`SELECT spell, spellcost FROM ${table} WHERE build_min <= 5875 AND build_max >= 5875`).all()) {
      const real = teach.get(r.spell) ?? r.spell;
      if (r.spellcost > 0 && (!costs.has(real) || costs.get(real) > r.spellcost)) costs.set(real, r.spellcost);
    }
  }
  return costs;
}

/** Puts each ability's Classic price on it (cost, in copper); abilities without one lose any old price. */
export function addCosts(abilities, costs) {
  let n = 0;
  for (const list of Object.values(abilities)) {
    for (const a of list) {
      const c = costs.get(a.id);
      if (c) {
        a.cost = c;
        n++;
      } else delete a.cost;
    }
  }
  return n;
}
