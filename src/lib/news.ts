// Forever's hotfixes as pages of their own (/news, /news/<date>, /feed.xml): one Markdown file per day Blizzard hotfixed
// the game, in content/news/<date>.md, written from Blizzard's notes in Grimoire's own words, with the classes and the
// Grimoire builds each one touches. A new hotfix is a new file.
import 'server-only';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getAbilities, getBuilds, getClasses, getTalents, parseFrontmatter } from './data';
import type { Build } from './types';

const NEWS_DIR = path.join(process.cwd(), 'content', 'news');

export interface NewsEntry {
  /** the day, 2026-11-10: also its address */
  date: string;
  title: string;
  description: string;
  /** Blizzard's post the page is written from */
  source: string;
  classes: string[];
  builds: Build[];
  body: string;
}

let cache: NewsEntry[] | null = null;
/** Every entry, newest first. */
export function getNews(): NewsEntry[] {
  if (cache) return cache;
  if (!existsSync(NEWS_DIR)) return (cache = []);
  const builds = new Map(getBuilds().map((b) => [b.id, b]));
  const list = (s: string | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  cache = readdirSync(NEWS_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => {
      const { data, body } = parseFrontmatter(readFileSync(path.join(NEWS_DIR, f), 'utf8'));
      return {
        date: f.slice(0, 10),
        title: data.title ?? f,
        description: data.description ?? '',
        source: data.source ?? '',
        classes: list(data.classes),
        builds: list(data.builds).map((id) => builds.get(id)).filter((b): b is Build => Boolean(b)),
        body,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  return cache;
}

export const getNewsEntry = (date: string) => getNews().find((n) => n.date === date);

/** "November 10, 2026" */
export const newsDay = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** What the hotfixes of one day changed for one class, in the lines of that day's page. */
export interface ClassChange {
  date: string;
  lines: string[];
}

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const names = (t: string, word: string) => new RegExp(`\\b${escape(word)}\\b`).test(t);

/**
 * Every day's changes for one class, newest first, taken from the pages' own lines and nothing else:
 * - a line under a heading that names only that class ("## Hunter");
 * - the part of a line marked with the class ("**Warrior:** Berserker Rage removes Sap."), or marked with something that
 *   is not a class and naming the class ("**Tooltips:** corrected for some Druid, Mage, Rogue and Warrior abilities.");
 * - under a heading that names several classes ("## Druid and Warrior"), a line that names a talent or an ability of
 *   that class and none of the others'.
 * Grimoire's own release notes on a page ("What changed in Grimoire") are left out.
 */
export function classChanges(cls: string): ClassChange[] {
  const classes = getClasses();
  const me = classes.find((c) => c.slug === cls);
  if (!me) return [];
  const spells = new Map<string, string[]>();
  const spellsOf = (slug: string) => {
    let list = spells.get(slug);
    if (!list) {
      const all = [...(getTalents(slug)?.trees.flatMap((t) => t.talents.map((x) => x.name)) ?? []), ...getAbilities(slug).map((a) => a.name)];
      spells.set(slug, (list = [...new Set(all)].filter((n) => n.length >= 4)));
    }
    return list;
  };
  const out: ClassChange[] = [];
  for (const n of getNews()) {
    if (!n.classes.includes(cls)) continue;
    const lines: string[] = [];
    let heading: string[] = [];
    let own = false;
    for (const raw of n.body.split('\n')) {
      const line = raw.trim();
      if (line.startsWith('## ')) {
        const title = line.slice(3);
        own = /^(What changed in Grimoire|Grimoire\b)/.test(title);
        heading = classes.filter((c) => names(title, c.name)).map((c) => c.slug);
        continue;
      }
      if (own || !line || line.startsWith('#')) continue;
      const text = line.replace(/^- /, '');
      const marks = [...text.matchAll(/\*\*([^*]+?):\*\*/g)];
      if (marks.length) {
        marks.forEach((m, i) => {
          const part = text.slice(m.index! + m[0].length, marks[i + 1]?.index ?? text.length).trim();
          if (m[1] === me.name) lines.push(part.charAt(0).toUpperCase() + part.slice(1));
          else if (!classes.some((c) => c.name === m[1]) && names(part, me.name)) lines.push(`${m[1]}: ${part}`);
        });
      } else if (heading.includes(cls)) {
        const others = heading.filter((h) => h !== cls);
        const mine = spellsOf(cls).some((s) => text.includes(s));
        if (!others.length || (mine && !others.some((o) => spellsOf(o).some((s) => text.includes(s))))) lines.push(text);
      }
    }
    if (lines.length) out.push({ date: n.date, lines });
  }
  return out;
}

