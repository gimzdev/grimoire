// Turns a VMaNGOS spell description ("Increases your attack power by $s1 for $d.") into the words the 1.12 client prints.
// Durations and radii live in client tables VMaNGOS does not ship, so a phrase that needs one is left out rather than guessed.

function effectValue(sp, n) {
  const bp = sp[`effectBasePoints${n}`] ?? 0;
  const sides = sp[`effectDieSides${n}`] ?? 0;
  const min = Math.abs(bp + 1);
  const max = Math.abs(bp + Math.max(1, sides));
  return { min, max };
}

const fmt = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10));

function tokenValue(kind, n, sp) {
  if (!sp) return undefined;
  switch (kind) {
    case 's': {
      const { min, max } = effectValue(sp, n || 1);
      return min === max ? fmt(min) : `${fmt(Math.min(min, max))} to ${fmt(Math.max(min, max))}`;
    }
    case 'm':
      return fmt(effectValue(sp, n || 1).min);
    case 'M':
      return fmt(effectValue(sp, n || 1).max);
    case 't': {
      const a = sp[`effectAmplitude${n || 1}`];
      return a ? fmt(a / 1000) : undefined;
    }
    case 'h':
      return sp.procChance ? fmt(sp.procChance) : undefined;
    case 'x':
      return sp[`effectChainTarget${n || 1}`] ? fmt(sp[`effectChainTarget${n || 1}`]) : undefined;
    case 'u':
      return sp.stackAmount ? fmt(sp.stackAmount) : undefined;
    case 'n':
      return sp.procCharges ? fmt(sp.procCharges) : undefined;
    case 'b':
      return sp[`effectPointsPerComboPoint${n || 1}`] ? fmt(sp[`effectPointsPerComboPoint${n || 1}`]) : undefined;
    default:
      return undefined; // $d, $o and $a need client tables
  }
}

/** Phrases that only carry a duration or radius: dropped when the value is not known. */
const UNKNOWN_PHRASES = [
  /,? (?:for|lasting|over|within|every) \$(?:\d+)?[dDaA]\d?(?: (?:yards?|yds?|sec|seconds))?/g,
  /\s*Lasts \$(?:\d+)?[dD]\d?\.?/g,
  /\s*\(\$(?:\d+)?[dD]\d?\)/g,
];

export function spellText(text, sp, spells) {
  if (!text) return '';
  let s = text.replace(/\r/g, '');
  // $gmale:female; and $lsingular:plural;
  s = s.replace(/\$[gG]([^:;]*):([^;]*);/g, '$1');
  // $/10;s1 and $/1000;12345s1: a value divided
  s = s.replace(/\$\/(\d+);(\d*)([smMtbx])(\d?)/g, (all, div, other, kind, n) => {
    const v = tokenValue(kind, Number(n) || 1, other ? spells.get(Number(other)) : sp);
    if (v === undefined || /to/.test(v)) return all;
    return fmt(Number(v) / Number(div));
  });
  // $12345s1: a value from another spell
  s = s.replace(/\$(\d+)([smMtbhxun])(\d?)/g, (all, other, kind, n) => tokenValue(kind, Number(n) || 1, spells.get(Number(other))) ?? all);
  s = s.replace(/\$([smMtbhxun])(\d?)/g, (all, kind, n) => tokenValue(kind, Number(n) || 1, sp) ?? all);
  s = s.replace(/(\d+) \$[lL]([^:;]*):([^;]*);/g, (all, num, one, many) => `${num} ${Number(num) === 1 ? one : many}`);
  s = s.replace(/\$[lL]([^:;]*):([^;]*);/g, '$2');
  for (const re of UNKNOWN_PHRASES) s = s.replace(re, '');
  s = s.replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
  if (/\$/.test(s) || !s) return ''; // something only the client could fill in
  return s;
}
