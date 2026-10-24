import { Fragment, type ReactNode } from 'react';

/**
 * Renders game text: line breaks as in the client and WoW's own color escapes (|cffRRGGBB … |r).
 * Numbers can be highlighted so rank-to-rank differences stand out.
 */
export function GameText({ text, highlightNumbers = false, className }: { text: string; highlightNumbers?: boolean; className?: string }) {
  const lines = text.split('\n');
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {renderColors(line, highlightNumbers)}
        </Fragment>
      ))}
    </span>
  );
}

function renderColors(line: string, highlight: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\|c[fF]{2}([0-9a-fA-F]{6})(.*?)\|r/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(...renderNumbers(line.slice(last, m.index), highlight, k++));
    out.push(
      <span key={`c${k++}`} style={{ color: `#${m[1]}` }}>
        {m[2]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(...renderNumbers(line.slice(last), highlight, k++));
  return out;
}

function renderNumbers(s: string, highlight: boolean, key: number): ReactNode[] {
  if (!highlight) return [<Fragment key={`t${key}`}>{s}</Fragment>];
  const parts = s.split(/(\d+(?:\.\d+)?%?)/);
  return parts.map((p, i) =>
    /^\d/.test(p) ? (
      <span key={`n${key}-${i}`} className="text-tt-green">
        {p}
      </span>
    ) : (
      <Fragment key={`t${key}-${i}`}>{p}</Fragment>
    ),
  );
}

/** Plain text of a game string (for search snippets and meta descriptions). */
export function plainGameText(text: string) {
  return text.replace(/\|c[fF]{2}[0-9a-fA-F]{6}/g, '').replace(/\|r/g, '').replace(/\s*\n\s*/g, ' ').trim();
}
