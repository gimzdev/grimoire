import Link from 'next/link';
import type { ReactNode } from 'react';
import { WowIcon } from '@/components/icon';
import { ItemLink, SpellLink } from '@/components/links';
import { EntityLink, ItemRefLink, QuestLink } from '@/components/world-links';
import { getAbilities, getBuilds, getClass, getItem, getRaces, getSpellIndex, getTalents } from './data';
import { decodeBuild } from './talents';
import { CLASS_COLOR, CLASS_NAMES } from './wow';

/**
 * A small Markdown renderer for guides: headings, paragraphs, lists, quotes, tables and rules, plus live game links:
 * [[item:12640]], [[spell:10060]], [[talent:priest:Penance]], [[class:mage]] and [[build:priest-holy-heal]] (as a block).
 */

type Block =
  | { t: 'h'; level: 2 | 3; text: string; id: string }
  | { t: 'p'; text: string }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'quote'; text: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'hr' }
  | { t: 'build'; id: string };

export const headingId = (s: string) =>
  s
    .toLowerCase()
    .replace(/\[\[[^\]]+\]\]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r/g, '').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) {
      out.push({ t: 'h', level: h[1].length as 2 | 3, text: h[2].trim(), id: headingId(h[2]) });
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      out.push({ t: 'hr' });
      i++;
      continue;
    }
    const b = /^\[\[build:([a-z0-9-]+)\]\]\s*$/.exec(line.trim());
    if (b) {
      out.push({ t: 'build', id: b[1] });
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push({ t: 'quote', text: buf.join(' ') });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i++].replace(/^\s*[-*]\s+/, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(item);
      }
      out.push({ t: 'ul', items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        let item = lines[i++].replace(/^\s*\d+\.\s+/, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(item);
      }
      out.push({ t: 'ol', items });
      continue;
    }
    if (/^\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i++]
          .replace(/^\|/, '')
          .replace(/\|\s*$/, '')
          .split('|')
          .map((c) => c.trim());
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
        rows.push(cells);
      }
      out.push({ t: 'table', head: rows[0] ?? [], rows: rows.slice(1) });
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|>|\s*[-*]\s+|\s*\d+\.\s+|\||---)/.test(lines[i]) && !/^\[\[build:/.test(lines[i].trim())) buf.push(lines[i++].trim());
    out.push({ t: 'p', text: buf.join(' ') });
  }
  return out;
}

function gameLink(token: string, key: string): ReactNode {
  // Names can contain colons ("Shadow Word: Death"), so everything after the second colon is the name.
  const [kind, first, ...restParts] = token.split(':');
  const a = kind === 'racial' ? [first, ...restParts].join(':') : first;
  const b = kind === 'racial' ? undefined : restParts.length ? restParts.join(':') : undefined;
  if (kind === 'item') {
    const it = getItem(Number(a));
    if (it) return <ItemLink key={key} item={it} size={18} className="text-[0.95em]" />;
    return <ItemRefLink key={key} id={Number(a)} size={18} className="text-[0.95em]" />;
  }
  if (kind === 'quest') {
    return <QuestLink key={key} id={Number(a)} />;
  }
  if (kind === 'npc') {
    return <EntityLink key={key} kind="n" id={Number(a)} rank={false} />;
  }
  if (kind === 'spell') {
    const sp = getSpellIndex().get(Number(a));
    return sp ? <SpellLink key={key} id={sp.id} name={sp.name} icon={sp.icon} size={18} className="text-[0.95em]" /> : <span key={key}>{a}</span>;
  }
  if (kind === 'talent') {
    const data = getTalents(a);
    const t = data?.trees.flatMap((tr) => tr.talents).find((x) => x.name.toLowerCase() === (b ?? '').toLowerCase());
    if (!t) return <strong key={key}>{b}</strong>;
    return <SpellLink key={key} id={t.spells[t.max - 1]} name={t.name} icon={t.icon} href={`/talents/${a}?focus=${t.id}`} size={18} className="text-[0.95em]" />;
  }
  if (kind === 'ability') {
    const list = getAbilities(a).filter((x) => x.name.toLowerCase() === (b ?? '').toLowerCase());
    const top = list[list.length - 1];
    if (!top) return <strong key={key}>{b}</strong>;
    return <SpellLink key={key} id={top.id} name={top.name} icon={top.icon} href={`/abilities?class=${a}`} size={18} className="text-[0.95em]" />;
  }
  if (kind === 'racial') {
    const r = getRaces()
      .flatMap((x) => x.racials)
      .find((x) => x.name.toLowerCase() === (a ?? '').toLowerCase());
    if (!r) return <strong key={key}>{a}</strong>;
    return <SpellLink key={key} id={r.id} name={r.name} icon={r.icon} size={18} className="text-[0.95em]" />;
  }
  if (kind === 'class') {
    return (
      <Link key={key} href={`/classes/${a}`} className="font-semibold hover:underline" style={{ color: CLASS_COLOR[a] }}>
        {b ?? CLASS_NAMES[a] ?? a}
      </Link>
    );
  }
  return <span key={key}>{token}</span>;
}

export function inline(text: string, keyBase = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[\[([^\]]+)\]\]|\*\*(.+?)\*\*|_(.+?)_|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${k++}`;
    if (m[1]) out.push(gameLink(m[1], key));
    else if (m[2]) out.push(<strong key={key}>{inline(m[2], key)}</strong>);
    else if (m[3]) out.push(<em key={key}>{inline(m[3], key)}</em>);
    else if (m[4]) {
      const href = m[5];
      out.push(
        href.startsWith('/') ? (
          <Link key={key} href={href}>
            {m[4]}
          </Link>
        ) : (
          <a key={key} href={href} target="_blank" rel="noreferrer">
            {m[4]}
          </a>
        ),
      );
    } else if (m[6]) out.push(<code key={key}>{m[6]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const KIND_LABEL: Record<string, string> = { raid: 'Damage build', heal: 'Healing build', tank: 'Tanking build' };

function BuildCard({ id }: { id: string }) {
  const b = getBuilds().find((x) => x.id === id);
  if (!b) return null;
  const c = getClass(b.cls);
  const t = getTalents(b.cls);
  if (!t) return null;
  const main = t.trees[b.points.indexOf(Math.max(...b.points))];
  const ranks = decodeBuild(t.trees, b.code);
  const keys = t.trees.flatMap((tree) =>
    [...tree.talents].sort((x, y) => x.row - y.row || x.col - y.col).filter((x) => x.max === 1 && (ranks[x.id] ?? 0) > 0),
  );
  const href = `/talents/${b.cls}?b=${b.code}&o=${b.order}`;
  return (
    <div className="frame gilt not-prose my-7 overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <WowIcon icon={main?.icon} size={48} name={main?.name ?? b.name} />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px]" style={{ color: c?.color }}>
            {c?.name} {(KIND_LABEL[b.kind] ?? 'build').toLowerCase()}
          </div>
          <div className="font-display text-[1.4rem] leading-tight text-vellum">{b.name}</div>
        </div>
        <Link href={href} className="inline-flex h-10 items-center rounded-full bg-gilt shadow-[inset_0_1px_0_rgb(255_255_255/0.45)] hover:bg-gilt-bright px-5 font-semibold text-[#1a1204] no-underline">
          Open in calculator
        </Link>
      </div>
      <div className="grid grid-cols-3 border-y border-iron/70 bg-abyss/40">
        {t.trees.map((tree, i) => (
          <div key={tree.name} className={`flex items-center gap-2.5 px-4 py-3 ${i > 0 ? 'border-l border-iron/70' : ''} ${b.points[i] ? '' : 'opacity-45'}`}>
            <WowIcon icon={tree.icon} size={22} name={tree.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] text-mist">{tree.name}</div>
              <div className="mt-1 h-1 rounded-full bg-iron/70">
                <div className="h-1 rounded-full bg-gilt" style={{ width: `${Math.round((b.points[i] / 51) * 100)}%` }} />
              </div>
            </div>
            <div className="num text-[1.15rem] font-bold text-vellum">{b.points[i]}</div>
          </div>
        ))}
      </div>
      <div className="px-5 py-4">
        <p className="text-[15.5px] leading-relaxed text-parch">{b.summary}</p>
        {keys.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {keys.map((k) => (
              <SpellLink key={k.id} id={k.spells[k.max - 1]} name={k.name} icon={k.icon} href={`${href}&focus=${k.id}`} size={22} className="text-[14.5px]" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className="prose-grim">
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.t) {
          case 'h':
            return b.level === 2 ? (
              <h2 key={k} id={b.id} className="scroll-mt-6">
                {inline(b.text, k)}
              </h2>
            ) : (
              <h3 key={k} id={b.id} className="scroll-mt-6">
                {inline(b.text, k)}
              </h3>
            );
          case 'p':
            return <p key={k}>{inline(b.text, k)}</p>;
          case 'ul':
            return (
              <ul key={k}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, `${k}-${j}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={k}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, `${k}-${j}`)}</li>
                ))}
              </ol>
            );
          case 'quote':
            return <blockquote key={k}>{inline(b.text, k)}</blockquote>;
          case 'hr':
            return <hr key={k} />;
          case 'build':
            return <BuildCard key={k} id={b.id} />;
          case 'table':
            return (
              <div key={k} className="scroll-thin overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j}>{inline(h, `${k}-h${j}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, x) => (
                          <td key={x}>{inline(c, `${k}-${j}-${x}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}

export function tableOfContents(source: string) {
  return parseBlocks(source)
    .filter((b): b is Extract<Block, { t: 'h' }> => b.t === 'h' && b.level === 2)
    .map((b) => ({ id: b.id, text: b.text.replace(/\[\[(?:talent|ability|class):[^:\]]+:([^\]]*)\]\]/g, '$1').replace(/\[\[[^\]]*\]\]/g, '').replace(/\*\*|_/g, '').trim() }));
}
