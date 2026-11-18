// Checks the numbers in content/guides against the game data, so a guide cannot drift from the live tooltips.
//
// For every sentence (or table row) with a [[talent:class:Name]] or [[ability:class:Name]] link:
//   - each percentage and number in it must appear in the current text of a spell or talent the sentence links or names
//     (any rank), or in the class's other spells it names in plain words;
//   - a level quoted right after a link, "[[talent:priest:Mind Flay]] (20)" or "[[ability:priest:Divine Spirit]] at 30",
//     must be a level at which one of the class's leveling builds takes that talent, or at which a rank of that ability is
//     trained.
// Dates, levels ("level 40", "at 60"), ranks ("rank 10"), counts of points ("5 points", "3/3", "the 31-point talent"), the
// value a number had before a change ("was 150%") and numbers inside link addresses are not facts about a tooltip and are
// skipped. A number after "about" is Grimoire's own arithmetic from the tooltip, labelled as such, and is skipped too.

const WORD_NUM = /(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(%?)/g;
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const SKIP_BEFORE = /(?:\b(?:levels?|rank|ranks|at|from|to|and|by|until|since|before|after|points?|tier|row|of|about|was|were)\s*|[-–/])$/i;
const SKIP_AFTER = /^(?:-point|\s*(?:\w+\s+)?points?\b|\s*(?:ranks?|levels?|players?|yards?|yds|targets?|stacks?|times|seconds?|sec|minutes?|min|hours?|hrs?|days?|weeks?|gold|silver|copper|charges?|combo|enemies|members|bosses|quests|talents|builds|routes|dungeons|zones|new|of\s+(?:its|the|your|their)|\/\d))/i;

const sentencesOf = (line) => (line.trim().startsWith('|') ? [line] : line.split(/(?<=[.!?])\s+(?=[A-Z[*(])/));

/**
 * @param guides [{ file, text }]
 * @param data { talents, abilities, builds } as in data/ (builds: data/builds.json, decoded orders are not needed:
 *             levelsOf gives the levels a class's leveling builds take each talent at)
 * @param levelsOf (cls, talentName) => Set of levels
 * @returns problems, one line each
 */
export function lintGuides(guides, data, levelsOf) {
  const problems = [];
  const talentText = new Map();
  for (const [cls, c] of Object.entries(data.talents))
    for (const tree of c.trees) for (const t of tree.talents) talentText.set(`${cls}:${t.name}`, t.desc.join('\n'));
  const abilityText = new Map();
  const abilityLevels = new Map();
  for (const [cls, list] of Object.entries(data.abilities))
    for (const a of list) {
      const k = `${cls}:${a.name}`;
      abilityText.set(k, `${abilityText.get(k) ?? ''}\n${a.desc ?? ''}`);
      if (!abilityLevels.has(k)) abilityLevels.set(k, new Set());
      if (a.level) abilityLevels.get(k).add(a.level);
    }
  const has = (text, num) => {
    const plain = num.replace(/,/g, '');
    const re = new RegExp(`(?<![\\d.])(?:${plain.replace('.', '\\.')}|${num.replace('.', '\\.').replace(/,/g, ',?')})(?![\\d])`);
    return re.test(text) || re.test(text.replace(/,/g, ''));
  };

  for (const { file, text } of guides) {
    const body = text.replace(/^---[\s\S]*?\n---\n/, '');
    const offset = text.length - body.length;
    const lineAt = (i) => text.slice(0, offset + i).split('\n').length;
    let pos = 0;
    for (const line of body.split('\n')) {
      const start = pos;
      pos += line.length + 1;
      if (!line.includes('[[talent:') && !line.includes('[[ability:')) continue;
      for (const s of sentencesOf(line)) {
        const links = [...s.matchAll(/\[\[(talent|ability):([a-z-]+):([^\]]+)\]\]/g)];
        if (!links.length) continue;
        const where = `${file}:${lineAt(start)}`;
        // levels quoted after a link
        for (const m of s.matchAll(/\[\[(talent|ability):([a-z-]+):([^\]]+)\]\]\*{0,2}(?:’s|'s)?\s*(?:\((\d{1,2})(?:\s*(?:to|-|–)\s*(\d{1,2}))?\)|at (\d{1,2})\b)/g)) {
          const [, kind, cls, name] = m;
          const lv = Number(m[4] ?? m[6]);
          if (!(lv >= 1 && lv <= 60)) continue;
          if (kind === 'ability') {
            const known = abilityLevels.get(`${cls}:${name}`);
            if (known && !known.has(lv)) problems.push(`${where}: ${name} is trained at ${[...known].sort((a, b) => a - b).join(', ')}, the guide says ${lv}`);
          } else {
            const known = levelsOf(cls, name);
            if (known.size && !known.has(lv)) problems.push(`${where}: no ${cls} leveling build takes ${name} at ${lv} (they take it at ${[...known].sort((a, b) => a - b).slice(0, 6).join(', ')})`);
          }
        }
        // the texts this sentence can quote: linked spells and talents, and the class's spells it names in words
        const classes = new Set(links.map((l) => l[2]));
        const texts = [];
        for (const [, kind, cls, name] of links) {
          // a talent that teaches a spell has both texts: the talent's ranks and the trained spell's ranks
          const t = [talentText.get(`${cls}:${name}`), abilityText.get(`${cls}:${name}`)].filter((x) => x !== undefined);
          if (!t.length) problems.push(`${where}: ${kind} ${cls}:${name} is not in the data`);
          else texts.push(...t);
        }
        const plain = s.replace(/\[\[[^\]]+\]\]/g, ' ');
        for (const cls of classes) {
          for (const [k, t] of [...talentText, ...abilityText]) {
            if (!k.startsWith(`${cls}:`)) continue;
            const name = k.slice(cls.length + 1);
            if (name.length > 3 && plain.includes(name)) texts.push(t);
          }
        }
        const all = texts.join('\n');
        // the numbers to check
        const cleaned = s
          .replace(/\[\[[^\]]+\]\]\*{0,2}(?:’s|'s)?\s*(?:\(\d{1,2}(?:\s*(?:to|-|–)\s*\d{1,2})?\)|at \d{1,2}\b)/g, ' ')
          .replace(/\[\[[^\]]+\]\]/g, ' ')
          .replace(/\]\([^)]*\)/g, ']')
          .replace(new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2}\\b|\\b\\d{1,2}\\s+(?:${MONTHS})\\b|\\b20\\d\\d\\b`, 'g'), ' ')
          .replace(/\b\d+\/\d+\b/g, ' ')
          .replace(/\(\d{1,2}(?:\s*(?:to|-|–|and)\s*\d{1,2})*(?:,\s*\d{1,2})*\)/g, ' ');
        for (const m of cleaned.matchAll(WORD_NUM)) {
          const [whole, num, pct] = m;
          const before = cleaned.slice(Math.max(0, m.index - 12), m.index);
          const after = cleaned.slice(m.index + whole.length, m.index + whole.length + 32);
          if (/\babout\s*$|\bwas\s*$|\bwere\s*$/i.test(before)) continue;
          if (!pct && (SKIP_BEFORE.test(before) || SKIP_AFTER.test(after))) continue;
          if (!pct && Number(num.replace(/,/g, '')) <= 5) continue; // "two", "three": small counts are rarely a tooltip number
          if (has(all, num)) continue;
          problems.push(`${where}: ${num}${pct} is in no linked tooltip: "${s.slice(0, 110)}"`);
        }
      }
    }
  }
  return problems;
}
