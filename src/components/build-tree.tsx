import type { ClassTalents } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/wow';
import { WowIcon } from './icon';

/**
 * A build's three trees as they end, drawn on the server: every talent in its place, the ones the build takes lit with
 * their rank, the rest dimmed. Hovering a talent shows its text (the tooltip layer reads data-tip).
 */
export function BuildTree({ t, ranks, color }: { t: ClassTalents; ranks: Record<number, number>; color: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {t.trees.map((tree) => {
        const spent = tree.talents.reduce((n, x) => n + (ranks[x.id] ?? 0), 0);
        const rows = Math.max(...tree.talents.map((x) => x.row)) + 1;
        return (
          <section
            key={tree.id}
            aria-label={`${tree.name}: ${spent} points`}
            className={`frame overflow-hidden ${spent ? '' : 'opacity-70'}`}
            style={{ background: `radial-gradient(120% 60% at 50% 0%, ${color}1a, transparent 60%), linear-gradient(180deg, rgb(18 20 24 / .97), rgb(9 10 12 / .98))` }}
          >
            <header className="flex items-center gap-2.5 border-b border-iron/80 px-4 py-2.5">
              <WowIcon icon={tree.icon} size={28} name={tree.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[1.12rem] leading-tight text-vellum">{tree.name}</div>
                <div className="text-[12.5px] text-fog">{ROLE_LABEL[tree.role]}</div>
              </div>
              <span className="num text-[1.35rem] font-bold text-gilt-bright">{spent}</span>
            </header>
            <ol className="mx-auto grid w-fit grid-cols-[repeat(4,44px)] gap-x-3.5 gap-y-3 px-4 py-4" style={{ gridTemplateRows: `repeat(${rows}, 44px)` }}>
              {tree.talents.map((x) => {
                const r = ranks[x.id] ?? 0;
                const tone = r === 0 ? 'off' : r >= x.max ? 'max' : 'some';
                return (
                  <li
                    key={x.id}
                    data-tip={`spell:${x.spells[Math.max(r, 1) - 1] ?? x.spells[0]}`}
                    tabIndex={0}
                    aria-label={`${x.name}, ${r} of ${x.max}`}
                    className={`relative cursor-help rounded-[10px] outline-offset-2 ${tone === 'off' ? 'opacity-30 grayscale' : ''}`}
                    style={{ gridRow: x.row + 1, gridColumn: x.col + 1 }}
                  >
                    <WowIcon icon={x.icon} size={44} name={x.name} className={tone === 'max' ? 'ring-2 ring-[#ffd100]' : tone === 'some' ? 'ring-2 ring-[#1eff00]' : ''} />
                    {r > 0 && (
                      <span
                        className="num absolute -bottom-1.5 -right-1.5 rounded-md bg-abyss px-1 text-[11.5px] font-bold leading-[1.35] ring-1 ring-iron"
                        style={{ color: tone === 'max' ? '#ffd100' : '#1eff00' }}
                      >
                        {r}/{x.max}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
