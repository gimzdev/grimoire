import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import { AddonButton } from '@/components/addon-button';
import { Backdrop } from '@/components/backdrop';
import { BuildTree } from '@/components/build-tree';
import { WowIcon } from '@/components/icon';
import { BUTTON, Container, Panel } from '@/components/ui';
import { CLASS_ART } from '@/lib/art';
import { BUILD_GROUPS, buildGroup, roleTag } from '@/lib/build-groups';
import { ClassTrail } from '@/components/class-trail';
import { buildHref, buildPage, buildSlug, buildTitle, calculatorHref, kindLabel } from '@/lib/build-pages';
import { getBuilds, getMeta } from '@/lib/data';
import { newsDay } from '@/lib/news';
import { respecCost, respecName } from '@/lib/respec';
import { SITE, siteUrl } from '@/lib/site';
import type { BarSlot, Build } from '@/lib/types';

export const dynamicParams = false;

export function generateStaticParams() {
  return getBuilds().map((b) => ({ cls: b.cls, slug: buildSlug(b) }));
}

export async function generateMetadata({ params }: { params: Promise<{ cls: string; slug: string }> }): Promise<Metadata> {
  const { cls, slug } = await params;
  const p = buildPage(cls, slug);
  if (!p) return {};
  const description = p.b.summary.length > 158 ? `${p.b.summary.slice(0, 155).replace(/\s+\S*$/, '')}…` : p.b.summary;
  return {
    title: `${p.title}: WoW Forever`,
    description,
    alternates: { canonical: buildHref(p.b) },
    openGraph: { title: `${p.title}: WoW Forever`, description, type: 'article', siteName: SITE.name },
  };
}

const BAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

export default async function BuildPage({ params }: { params: Promise<{ cls: string; slug: string }> }) {
  const { cls, slug } = await params;
  const p = buildPage(cls, slug);
  if (!p) notFound();
  const { b, c, t, ranks, bar, steps, others, respec, title } = p;
  const group = BUILD_GROUPS.find((g) => g.key === buildGroup(b.kind))!.label;
  const role = roleTag(b);
  const calc = calculatorHref(b);
  const meta = getMeta();
  const base = siteUrl();
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Builds', item: `${base}/builds` },
      { '@type': 'ListItem', position: 2, name: `${c.name} builds`, item: `${base}/builds#${cls}` },
      { '@type': 'ListItem', position: 3, name: title, item: `${base}${buildHref(b)}` },
    ],
  };

  return (
    <div className="relative isolate">
      <Backdrop art={CLASS_ART[cls] ?? 'expanses'} strength={0.45} height={560} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      <Container className="relative pt-10">
        <nav aria-label="Breadcrumb" className="text-[14px] text-mist">
          <Link href="/builds" className="hover:text-vellum">
            Builds
          </Link>
          <span className="mx-2 text-fog">/</span>
          <Link href={`/builds#${cls}`} className="hover:text-vellum" style={{ color: c.color }}>
            {c.name}
          </Link>
        </nav>

        <header className="mt-4 max-w-3xl">
          <div className="text-[15px] font-medium" style={{ color: c.color }}>
            {c.name} · {group}
            {role ? ` ${role === 'DPS' ? role : role.toLowerCase()}` : ''}
          </div>
          <h1 className="mt-1 text-[2.3rem] leading-[1.05] text-vellum sm:text-[2.9rem]">{title}</h1>
          <p className="mt-4 text-[17.5px] leading-relaxed text-parch">{b.summary}</p>
          {b.for && (
            <p className="mt-3 text-[16px] leading-relaxed text-vellum">
              <span className="font-semibold text-gilt">For: </span>
              {b.for}
            </p>
          )}
          {respec && (
            <p className="mt-2 text-[16px] leading-relaxed text-vellum">
              <span className="font-semibold text-gilt">Respec: </span>
              At {respec.at}, respec into{' '}
              <Link href={buildHref(respec.into)} className="text-gilt-bright underline-offset-2 hover:underline">
                {respecName(respec.into)}
              </Link>
              : {respecCost(respec.at)}
            </p>
          )}
          <dl className="mt-5 flex flex-wrap gap-2">
            {t.trees.map((tree, i) => (
              <div key={tree.id} className={`frame flex items-center gap-2 px-3 py-1.5 ${b.points[i] ? '' : 'opacity-50'}`}>
                <dt className="flex items-center gap-2 text-[14.5px] text-mist">
                  <WowIcon icon={tree.icon} size={22} name={tree.name} decorative />
                  {tree.name}
                </dt>
                <dd className="num text-[16px] font-bold text-vellum">{b.points[i]}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={calc} className={`${BUTTON.base} ${BUTTON.primary}`}>
              Open in the calculator
            </Link>
            <AddonButton from="build" variant="ghost">
              Get it in game
            </AddonButton>
          </div>
          <p className="mt-3 text-[14.5px] text-mist">
            In game, the add-on’s Talents tab has this build: follow it and it shows each point as you level
            {respec ? `, then from ${respec.at} those of ${respecName(respec.into)} once you have respecced` : ''}
            {bar ? ', and it can put the build’s action bar on your main bar' : ''}.
          </p>
        </header>

        <section className="mt-12" aria-labelledby="tree">
          <h2 id="tree" className="mb-4 text-[1.7rem] text-vellum">
            The talents at 60
          </h2>
          <BuildTree t={t} ranks={ranks} color={c.color} />
        </section>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section aria-labelledby="order">
            <h2 id="order" className="text-[1.7rem] text-vellum">
              Points in order
            </h2>
            <p className="mt-1 text-[15px] text-mist">The first point at level 10, one more each level.</p>
            <ol className="frame mt-4 divide-y divide-iron/60">
              {steps.map((s) => (
                <Fragment key={`${s.from}-${s.talent.id}`}>
                  {respec && s.from === respec.at && (
                    <li className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3 bg-gilt/[0.07] px-4 py-2">
                      <span className="num text-[14.5px] font-semibold text-gilt-bright">{respec.at}</span>
                      <span className="text-[15.5px] text-vellum">
                        Respec into{' '}
                        <Link href={buildHref(respec.into)} className="text-gilt-bright underline-offset-2 hover:underline">
                          {respecName(respec.into)}
                        </Link>
                        , or keep this build with Secondary Talents:
                      </span>
                    </li>
                  )}
                  <li className="grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2">
                    <span className="num text-[14.5px] font-semibold text-gilt">{s.from === s.to ? s.from : `${s.from}–${s.to}`}</span>
                    <span data-tip={`spell:${s.talent.spells[s.rankTo - 1] ?? s.talent.spells[0]}`} tabIndex={0} className="inline-flex min-w-0 cursor-help items-center gap-2 text-[15.5px] text-vellum">
                      <WowIcon icon={s.talent.icon} size={24} name={s.talent.name} decorative />
                      <span className="truncate">{s.talent.name}</span>
                    </span>
                    <span className="num text-[14px] text-mist">
                      {s.rankFrom === s.rankTo ? s.rankTo : `${s.rankFrom}–${s.rankTo}`}/{s.talent.max}
                    </span>
                  </li>
                </Fragment>
              ))}
            </ol>
          </section>

          <div className="space-y-8">
            {b.notes && b.notes.length > 0 && (
              <section aria-labelledby="why">
                <h2 id="why" className="text-[1.7rem] text-vellum">
                  How it plays
                </h2>
                <div className="mt-4 space-y-4 text-[16.5px] leading-relaxed text-parch">
                  {b.notes.map((n, i) => (
                    <p key={i}>{n}</p>
                  ))}
                </div>
              </section>
            )}
            {bar && <ActionBar slots={bar} />}
            <Evidence b={b} gameBuild={meta.build} />
          </div>
        </div>

        {others.length > 0 && (
          <section className="mt-16" aria-labelledby="more">
            <h2 id="more" className="text-[1.7rem] text-vellum">
              More {c.name} builds
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((o) => (
                <li key={o.id}>
                  <Link href={buildHref(o)} className="frame flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-white/[0.16]">
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-medium text-vellum">{buildTitle(o, c)}</span>
                      <span className="text-[13.5px] text-mist">{kindLabel(o.kind)}</span>
                    </span>
                    <span className="num shrink-0 text-[14px] font-bold text-gilt-bright">{o.points.join(' / ')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <ClassTrail cls={b.cls} here="build" className="mt-14" />
      </Container>
    </div>
  );
}

// A mark only where it adds to the checks every build has: guides that agree, or play at these levels.
const MARK: Partial<Record<NonNullable<Build['confidence']>, { label: string; text: string }>> = {
  live: { label: 'Played', text: 'the sources below played or measured it at these levels, and Grimoire’s arithmetic agrees.' },
  consensus: { label: 'Two guides agree', text: 'two guides make the same main choices, and Grimoire’s arithmetic from the tooltips agrees.' },
};

/** What the build was checked against, when, and the guides to compare it with. */
function Evidence({ b, gameBuild }: { b: Build; gameBuild: string }) {
  const c = b.confidence ? MARK[b.confidence] : undefined;
  return (
    <Panel as="section" className="p-5">
      <h2 id="evidence" className="text-[1.25rem] text-vellum">
        What it was checked against
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-parch">
        {b.checked ? `Checked ${newsDay(b.checked)} on game build ${b.build ?? gameBuild}` : `Worked out on the trees of game build ${gameBuild}`}, point by point against the talents’ own tooltips and Blizzard’s hotfixes.
        {c && (
          <>
            {' '}
            <span className="font-semibold text-vellum">{c.label}:</span> {c.text}
          </>
        )}
      </p>
      {b.sources && b.sources.length > 0 && (
        <div className="mt-3">
          <h3 className="text-[14.5px] font-semibold text-mist">Compare with</h3>
          <ul className="mt-1.5 space-y-1 text-[14.5px]">
            {b.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} rel="noopener nofollow" target="_blank" className="text-gilt-bright underline-offset-2 hover:underline">
                  {s.name}
                </a>
                {s.date && <span className="text-fog"> · {newsDay(s.date)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/** The build's bar 1, keys 1 to =, with the level each spell is learned at. */
function ActionBar({ slots }: { slots: BarSlot[] }) {
  return (
    <Panel as="section" className="p-5">
      <h2 className="text-[1.25rem] text-vellum">Action bar</h2>
      <p className="mt-1 text-[14.5px] text-mist">The add-on puts these on your main bar, with a preview first and an undo after.</p>
      <ol className="mt-4 flex flex-wrap gap-1.5">
        {slots.map((s, i) => (
          <li key={i} className="relative" title={s ? `${BAR_KEYS[i]}: ${s.n}${s.lv && s.lv > 1 ? `, from level ${s.lv}` : ''}` : `${BAR_KEYS[i]}: free`}>
            {s ? <WowIcon icon={s.ic} size={40} name={s.n} /> : <span className="block size-10 rounded-[8px] bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]" />}
            <span className="num pointer-events-none absolute left-[4px] top-0.5 text-[11px] font-semibold text-vellum [text-shadow:0_1px_2px_rgb(0_0_0/0.9)]">{BAR_KEYS[i]}</span>
            <span className="sr-only">{s ? s.n : 'free'}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
