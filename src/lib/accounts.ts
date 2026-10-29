/**
 * Accounts and saved builds, shared by the server and the browser.
 *
 * Accounts are optional. grimoire.sh switches them on (NEXT_PUBLIC_ACCOUNTS=1) once a database and a way to sign in
 * are set; without them the site has no Sign in button and every planner works exactly as before.
 *
 * The profile page is where a signed-in person keeps their specs and builds. A saved build is a link into a planner
 * (talent calculator, gear planner, raid composer or Legacy planner) that carries everything the planner shows, plus a name.
 */

export const ACCOUNTS = process.env.NEXT_PUBLIC_ACCOUNTS === '1';

export const BUILD_KINDS = ['talents', 'gear', 'raid', 'legacy'] as const;
export type BuildKind = (typeof BUILD_KINDS)[number];
export const KIND_LABEL: Record<BuildKind, string> = { talents: 'Talents', gear: 'Gear', raid: 'Raid', legacy: 'Legacy' };

/** Builds one person can keep. */
export const BUILD_LIMIT = 200;
export const NAME_MAX = 80;

/** A same-site path to go back to after signing in: no //, backslashes, control or non-ASCII characters ("/<tab>/evil" is "//evil"). */
export function safeNext(n?: string | null, fallback = '/profile') {
  if (!n || !/^\/(?![/\\])[^\x00-\x20\x7f-￿\\]*$/.test(n)) return fallback;
  // as a browser resolves it: "/.//evil.example" is "//evil.example", another site
  const u = new URL(n, 'https://grimoire.invalid');
  if (u.origin !== 'https://grimoire.invalid' || u.pathname.startsWith('//') || /^\/signin(?:\/|$)/.test(u.pathname)) return fallback;
  return u.pathname + u.search + u.hash;
}

/** A build's name as it is stored: one line, trimmed, at most NAME_MAX characters. */
export const cleanName = (s: unknown) =>
  typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '';

// ── Planner links ──
// Each planner keeps its state in the address. Only these parameters, in this order and with these values, are kept,
// so the same build always makes the same link (saved once) and nothing else can ride along.

type Rule = { path: RegExp; params: [key: string, value: RegExp][]; needs: string };
const RULES: Record<BuildKind, Rule> = {
  // /talents/mage?b=05-…&o=…&t=1   points by tree, the order they were spent in, the Talented perk
  talents: { path: /^\/talents\/[a-z-]{2,20}$/, params: [['b', /^[0-9-]{1,160}$/], ['o', /^[0-9A-Za-z]{1,160}$/], ['t', /^1$/]], needs: 'b' },
  // /tools/gear?class=warrior&spec=arms&lvl=60&src=…&side=…&g=…&w=…   class, spec, level, item pool, faction, items, stat weights
  gear: {
    path: /^\/tools\/gear$/,
    params: [
      ['class', /^[a-z-]{2,20}$/],
      ['spec', /^[a-z-]{2,30}$/],
      ['lvl', /^(?:[1-9]|[1-5][0-9]|60)$/],
      ['src', /^(?:forever|launch|all)$/],
      ['side', /^(?:alliance|horde)$/],
      ['g', /^[0-9.]{1,240}$/],
      ['w', /^[a-z0-9:.,-]{1,700}$/],
    ],
    needs: 'class',
  },
  // /tools/raid?size=20&r=…   raid size and who fills each slot
  raid: { path: /^\/tools\/raid$/, params: [['size', /^(?:10|20|40)$/], ['r', /^[0-9a-z-]{1,40}$/]], needs: 'r' },
  // /tools/legacy?tab=perks&p=…   the perk planner, one character per point in the order spent
  legacy: { path: /^\/tools\/legacy$/, params: [['tab', /^perks$/], ['p', /^[0-9A-Za-z]{1,64}$/]], needs: 'p' },
};

/** The planner link for a build in its one stored form, or null when it is not a link to that planner. */
export function buildPath(kind: BuildKind, raw: string): string | null {
  const rule = RULES[kind];
  if (!rule || typeof raw !== 'string' || raw.length > 2000) return null;
  let u: URL;
  try {
    u = new URL(raw, 'https://grimoire.invalid');
  } catch {
    return null;
  }
  if (u.origin !== 'https://grimoire.invalid' || !rule.path.test(u.pathname)) return null;
  const kept = new URLSearchParams();
  for (const [key, ok] of rule.params) {
    const v = u.searchParams.get(key);
    if (v && ok.test(v)) kept.set(key, v);
  }
  if (!kept.get(rule.needs)) return null;
  if (kind === 'raid' && !/[0-9a-z]/.test(kept.get('r') ?? '')) return null; // an empty roster
  if (kind === 'talents' && !/[1-9]/.test(kept.get('b') ?? '')) return null; // no points spent
  if (kind === 'legacy') return `${u.pathname}?tab=perks&p=${kept.get('p')}`; // always opens on the perk planner
  return `${u.pathname}?${kept.toString()}`;
}

// ── What the profile shows for each build (worked out on the server from the link and the game data) ──

export interface TileClass {
  slug: string;
  name: string;
  color: string;
  icon: string;
}
export interface Tile {
  id: string;
  kind: BuildKind;
  name: string;
  href: string;
  savedAt: string;
  updatedAt: string;
  /** The picture: the spec for talents and gear, a raid icon for raids, the main tree for Legacy builds. */
  icon: string;
  /** The class the build is for (raids have none). */
  cls?: TileClass;
  /** The spec it leans into: most points for talents, the chosen preset for gear, the main tree for Legacy builds. */
  spec?: string;
  /** Legacy builds: the name of Grimoire's build it is, if it is one. */
  ours?: string;
  /** Talent and Legacy builds: points per tree, in tree order. */
  trees?: { name: string; icon: string; points: number }[];
  /** Legacy builds: the perks with points, in tree order. */
  perks?: { icon: string; name: string; rank: number; max: number }[];
  /** Gear sets: the pieces, best first. */
  items?: { icon: string; q: number; name: string }[];
  /** A few short facts, most telling first: "Level 60", "16 items", "3 healers". */
  facts: string[];
  /** Raids: one class colour per slot in roster order, '' for an empty slot. */
  roster?: string[];
}
