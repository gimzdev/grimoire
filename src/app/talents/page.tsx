import type { Metadata } from 'next';
import Link from 'next/link';
import { WowIcon } from '@/components/icon';
import { Container, Panel } from '@/components/ui';
import { Vista } from '@/components/vista';
import { getClasses, getMeta } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Talent calculator',
  description: 'World of Warcraft: Forever talent calculator for all nine classes, with point order, presets and every change from Classic marked.',
  alternates: { canonical: '/talents' },
};

export default function TalentsIndex() {
  const classes = getClasses();
  const meta = getMeta();
  const maxTotal = Math.max(...classes.map((c) => c.talentStats.total));
  return (
    <>
      <Vista art="expanses" title="Talent calculator" kicker={`${meta.counts.talents} talents across 27 trees`}>
        Every tree was rebuilt for Forever.
      </Vista>
      <Container>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => {
            const s = c.talentStats;
            return (
              <Link key={c.slug} href={`/talents/${c.slug}`} className="group">
                <Panel className="h-full p-5 transition-colors group-hover:border-gilt/50">
                  <div className="flex items-center gap-3.5">
                    <WowIcon icon={c.icon} size={46} name={c.name} />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[1.45rem] leading-tight" style={{ color: c.color }}>
                        {c.name}
                      </div>
                      <div className="mt-0.5 flex gap-1.5">
                        {c.specs.map((sp) => (
                          <span key={sp.slug} title={sp.name}>
                            <WowIcon icon={sp.icon} size={22} name={sp.name} />
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-abyss" style={{ width: `${(s.total / maxTotal) * 100}%` }} aria-hidden>
                      <span className="bg-leaf" style={{ width: `${(s.new / s.total) * 100}%` }} />
                      <span className="bg-gilt" style={{ width: `${(s.changed / s.total) * 100}%` }} />
                      <span className="bg-ash" style={{ width: `${(s.same / s.total) * 100}%` }} />
                    </div>
                    <p className="mt-2.5 text-[15px] text-mist">
                      <span className="text-leaf-bright">{s.new} new</span>, <span className="text-gilt-bright">{s.changed} reworked</span>, {s.same} unchanged,{' '}
                      <span className="text-[#ff8f86]">{s.removed} removed</span>
                    </p>
                  </div>
                </Panel>
              </Link>
            );
          })}
        </div>
      </Container>
    </>
  );
}
